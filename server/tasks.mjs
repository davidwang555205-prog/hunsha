// 异步生图任务队列 + worker
//
// 职责：
// 1. 内存任务队列（数组 + 串行 worker，保持和现有串行生图一致，不引入 Redis）
// 2. 复用 index.mjs 的生图核心能力（WalaAPI 调用、重试、图组连续性、图片保存）
// 3. 每完成一张子图：更新 generation_tasks.sub_task_status + 扣 1 积分（事务）
// 4. 任务完成写 history；失败也记录
// 5. 支持取消（设 cancel 标志，worker 在下一张前检查）
//
// 图组连续性设计（与同步 handleGenerate 完全一致）：首张成功图回传场景参考图，
// 含人物时回传人物参考图，作为后续请求额外参考图，保证人物/场景/手机型号跨图一致。
import crypto from "node:crypto";
import {
  query,
  withTransaction,
  updateTask,
  getTask,
  insertHistory,
  consumeCredits
} from "./db.mjs";
import { putImage } from "./storage.mjs";
import { generatePrompt } from "./prompt.mjs";

// ===== 配置（从 index.mjs 注入，避免循环依赖与重复读 env）=====
let config = null;
export function configureTaskWorker(cfg) {
  config = cfg;
}

function cfg() {
  if (!config) throw new Error("tasks worker 未配置，请先调用 configureTaskWorker");
  return config;
}

// ===== 内存队列 + 取消标志 =====
const queue = [];
const cancelFlags = new Map(); // taskId -> boolean
let workerRunning = false;

/** 提交任务到队列 */
export function enqueueTask(taskId) {
  queue.push(taskId);
  ensureWorker();
}

/** 标记任务取消（worker 在下一张子图前检查） */
export function cancelTask(taskId) {
  cancelFlags.set(taskId, true);
}

/** 当前队列长度（监控用） */
export function queueLength() {
  return queue.length;
}

async function ensureWorker() {
  if (workerRunning) return;
  workerRunning = true;
  void runWorker().catch((err) => console.error("[tasks:worker] 致命错误:", err.message));
}

async function runWorker() {
  while (queue.length) {
    const taskId = queue.shift();
    try {
      const task = await getTask(taskId);
      if (!task || task.status === "cancelled") continue;
      if (task.status !== "queued") continue;
      await processTask(task);
    } catch (err) {
      console.error(`[tasks:worker] 任务 ${taskId} 异常:`, err.message);
      await markTaskFailed(taskId, err.message || "任务处理异常。").catch(() => {});
    }
  }
  workerRunning = false;
}

// ===== 生图核心（从 index.mjs 抽取，保持行为一致）=====
const maxContinuityReferenceBytes = 20 * 1024 * 1024;

function extensionFromMime(type) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

function parseDataUrl(file) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(file.dataUrl || "");
  if (!match) throw Object.assign(new Error(`图片 ${file.name || ""} 格式不正确。`), { statusCode: 400 });
  return { type: match[1], buffer: Buffer.from(match[2], "base64") };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt) {
  return Math.min(30000, 4000 * 2 ** (attempt - 1));
}

function isRetryableWalaResponse(status, bodyText = "") {
  if ([429, 502, 503, 504].includes(status)) return true;
  return bodyText.includes("当前分组上游负载已饱和") || bodyText.includes("当前分组负载已饱和");
}

function buildWalaOverloadMessage(message) {
  const prefix = `WalaAPI 上游负载已饱和，已自动重试 ${cfg().retryAttempts} 次仍未成功。请稍后再试，或在 WalaAPI 后台切换可用分组/模型后重试。`;
  return message ? `${prefix} 原始错误：${message}` : prefix;
}

function extractGeneratedImages(payload) {
  const candidates = [];
  if (Array.isArray(payload?.data)) candidates.push(...payload.data);
  else if (payload?.data) candidates.push(payload.data);
  else if (payload?.b64_json || payload?.url) candidates.push(payload);
  return candidates
    .map((item) => ({
      b64: item.b64_json || item.image_base64 || item.base64 || "",
      url: item.url || "",
      revisedPrompt: item.revised_prompt || ""
    }))
    .filter((item) => item.b64 || item.url);
}

async function generatedImageToReferenceFile(image, recordId, referenceKind) {
  let type = "image/png";
  let buffer;
  if (image.b64) {
    const dataUrlMatch = /^data:([^;]+);base64,(.+)$/s.exec(image.b64);
    if (dataUrlMatch) {
      type = dataUrlMatch[1];
      buffer = Buffer.from(dataUrlMatch[2], "base64");
    } else {
      buffer = Buffer.from(image.b64, "base64");
    }
  } else if (image.url) {
    const response = await fetch(image.url);
    if (!response.ok) {
      throw Object.assign(new Error(`无法读取首张${referenceKind}参考图，图组连续性生成已停止。`), { statusCode: 502 });
    }
    type = response.headers.get("content-type")?.split(";")[0] || type;
    buffer = Buffer.from(await response.arrayBuffer());
  }
  if (!buffer?.length || buffer.length > maxContinuityReferenceBytes) {
    throw Object.assign(new Error(`首张${referenceKind}参考图无效或超过 20MB，图组连续性生成已停止。`), { statusCode: 502 });
  }
  return {
    name: `${recordId}-${referenceKind === "人物" ? "identity" : "scene"}.${extensionFromMime(type)}`,
    type,
    size: buffer.length,
    dataUrl: `data:${type};base64,${buffer.toString("base64")}`
  };
}

async function saveGeneratedImages(recordId, images, startIndex, imageName) {
  const saved = [];
  for (const [index, image] of images.entries()) {
    const imageNumber = startIndex + index + 1;
    const name = imageName || `图片 ${imageNumber}`;
    if (image.url) {
      saved.push({ id: `${recordId}-${imageNumber}`, name, url: image.url, downloadUrl: image.url, source: "remote" });
      continue;
    }
    const base64 = image.b64.replace(/^data:[^;]+;base64,/i, "");
    const key = `${recordId}-${imageNumber}.png`;
    await putImage(key, Buffer.from(base64, "base64"), "image/png");
    saved.push({
      id: `${recordId}-${imageNumber}`,
      name,
      url: `/api/generated/${key}`,
      downloadUrl: `/api/generated/${key}`,
      source: "local"
    });
  }
  return saved;
}

async function callWalaApi({ prompt, files, size, quality, channel }) {
  const apiKey = channel?.apiKey || process.env.WALA_API_KEY;
  if (!apiKey) throw Object.assign(new Error("服务端缺少 API Key。"), { statusCode: 500 });
  const baseUrl = (channel?.apiBaseUrl || process.env.WALA_API_BASE_URL || "https://walaapi.net/v1").replace(/\/+$/, "");
  const model = channel?.modelId || "gpt-image-2";
  const supportedQualities = new Set(["low", "medium", "high", "auto"]);
  const resolvedQuality = supportedQualities.has(quality) ? quality : channel?.defaultQuality || "medium";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), cfg().timeoutMs);

  const useEdits = files.length > 0;
  try {
    if (useEdits) {
      const form = new FormData();
      for (const file of files) {
        const parsed = parseDataUrl(file);
        form.append("image", new Blob([parsed.buffer], { type: parsed.type }), file.name || `reference.${extensionFromMime(parsed.type)}`);
      }
      form.append("prompt", prompt);
      form.append("model", model);
      form.append("size", size || "1152x1536");
      form.append("quality", resolvedQuality);
      return await fetch(`${baseUrl}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal
      });
    }
    return await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: size || "1152x1536", quality: resolvedQuality }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw Object.assign(new Error(`生图接口超过 ${Math.round(cfg().timeoutMs / 1000)} 秒未返回，已中断。`), { statusCode: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callWalaApiWithRetries(request, channel) {
  for (let attempt = 1; attempt <= cfg().retryAttempts; attempt += 1) {
    try {
      const response = await callWalaApi({ ...request, channel });
      if (response.ok || attempt >= cfg().retryAttempts) return response;
      const bodyText = await response.clone().text();
      if (!isRetryableWalaResponse(response.status, bodyText)) return response;
      const waitMs = retryDelayMs(attempt);
      console.log(`[wala:retry] attempt=${attempt}/${cfg().retryAttempts} status=${response.status} waitMs=${waitMs}`);
      await delay(waitMs);
    } catch (error) {
      if (attempt >= cfg().retryAttempts || !isRetryableWalaResponse(error.statusCode || 500, error.message || "")) {
        throw error;
      }
      const waitMs = retryDelayMs(attempt);
      console.log(`[wala:retry] attempt=${attempt}/${cfg().retryAttempts} status=${error.statusCode || 500} waitMs=${waitMs}`);
      await delay(waitMs);
    }
  }
  throw Object.assign(new Error(buildWalaOverloadMessage("")), { statusCode: 503 });
}

// ===== 任务处理主流程 =====
async function processTask(task) {
  await updateTask(task.id, { status: "processing", startedAt: new Date().toISOString() });

  const channel = task.channelId ? (await query("SELECT * FROM model_channels WHERE id = $1", [task.channelId])).rows[0] : null;
  const channelObj = channel
    ? { apiKey: channel.api_key, apiBaseUrl: channel.api_base_url, modelId: channel.model_id, defaultQuality: channel.default_quality }
    : null;

  const promptParamsList = task.promptParamsList || [];
  const files = (task.referenceImages || []).slice(0, 4);
  const recordId = task.id;

  const personImageTypes = new Set(["产品上身图", "对镜穿搭图", "生活场景图"]);
  const leadPersonIndex = promptParamsList.findIndex((p) => personImageTypes.has(p.imageType));
  const leadPhoneIndex = promptParamsList.findIndex((p) => p.bridalKeywordProfileId === "phoneMirrorSelfieFitting");
  const leadParams = promptParamsList[leadPersonIndex >= 0 ? leadPersonIndex : 0];
  const sharedScenePreference = leadParams?.scenePreference || "自动匹配";
  const sharedModelChoice = leadParams?.modelChoice;
  const normalizedList = promptParamsList.map((p) => ({
    ...p,
    scenePreference: sharedScenePreference,
    modelChoice: personImageTypes.has(p.imageType) ? sharedModelChoice : p.modelChoice
  }));
  const promptPlans = normalizedList.map((p, index) => ({
    prompt: generatePrompt(p, { index, total: normalizedList.length, leadPersonIndex, leadPhoneIndex }),
    includesPerson: personImageTypes.has(p.imageType),
    name: String(p.generatedImageName || `图片 ${index + 1}`).trim().slice(0, 60) || `图片 ${index + 1}`
  }));

  const subTaskStatus = promptPlans.map((_, index) => ({ index, status: "pending", image: null, error: null, latencyMs: 0 }));
  const savedImages = [];
  let sceneContinuityReference = null;
  let identityContinuityReference = null;
  const startedAt = Date.now();
  const totalCount = promptPlans.length;

  await updateTask(task.id, { totalCount, subTaskStatus, estimatedSeconds: totalCount * 90 });

  console.log(`[task:start] id=${task.id} user=${task.userId} prompts=${totalCount} channel=${task.channelId || "default"}`);

  for (const [promptIndex, promptPlan] of promptPlans.entries()) {
    if (cancelFlags.get(task.id)) {
      subTaskStatus[promptIndex].status = "cancelled";
      await updateTask(task.id, { status: "cancelled", subTaskStatus, completedAt: new Date().toISOString() });
      console.log(`[task:cancelled] id=${task.id} at ${promptIndex}/${totalCount}`);
      cancelFlags.delete(task.id);
      return;
    }

    subTaskStatus[promptIndex].status = "processing";
    await updateTask(task.id, { subTaskStatus });
    const subStartedAt = Date.now();

    try {
      const continuityReferences = [
        identityContinuityReference,
        sceneContinuityReference && sceneContinuityReference !== identityContinuityReference ? sceneContinuityReference : null
      ].filter(Boolean);
      const requestFiles =
        promptIndex === 0
          ? files
          : [...continuityReferences, ...files.slice(0, Math.max(0, 4 - continuityReferences.length))].slice(0, 4);

      const apiResponse = await callWalaApiWithRetries(
        { prompt: promptPlan.prompt, files: requestFiles, size: task.size, quality: task.quality },
        channelObj
      );
      const responseText = await apiResponse.text();
      let responsePayload = {};
      try {
        responsePayload = JSON.parse(responseText);
      } catch {
        responsePayload = { raw: responseText };
      }

      if (!apiResponse.ok) {
        const message = responsePayload?.error?.message || responsePayload?.message || responseText || "生图接口调用失败。";
        const friendly = isRetryableWalaResponse(apiResponse.status, message) ? buildWalaOverloadMessage(message) : message;
        throw Object.assign(new Error(friendly), { statusCode: apiResponse.status });
      }

      const generatedImages = extractGeneratedImages(responsePayload);
      if (!generatedImages.length) {
        throw Object.assign(new Error(`第 ${promptIndex + 1} 张图未返回图片。`), { statusCode: 502 });
      }

      if (promptPlans.length > 1 && !sceneContinuityReference) {
        sceneContinuityReference = await generatedImageToReferenceFile(generatedImages[0], recordId, "场景");
      }
      if (promptPlans.length > 1 && promptPlan.includesPerson && !identityContinuityReference) {
        identityContinuityReference =
          promptIndex === 0 ? sceneContinuityReference : await generatedImageToReferenceFile(generatedImages[0], recordId, "人物");
      }

      const nextImages = await saveGeneratedImages(recordId, generatedImages, savedImages.length, promptPlan.name);
      savedImages.push(...nextImages);

      subTaskStatus[promptIndex].status = "success";
      subTaskStatus[promptIndex].image = nextImages[0] || null;
      subTaskStatus[promptIndex].latencyMs = Date.now() - subStartedAt;

      // 扣 1 积分（事务，管理员不限）
      if (task.role !== "super_admin" && task.role !== "admin") {
        try {
          await consumeCredits(task.userId, 1, `生图消费：${promptPlan.name}`, task.id);
        } catch (creditErr) {
          subTaskStatus[promptIndex].error = creditErr.message;
          await updateTask(task.id, { subTaskStatus });
          throw creditErr;
        }
      }

      await updateTask(task.id, {
        subTaskStatus,
        resultImages: savedImages,
        completedCount: savedImages.length
      });
    } catch (err) {
      subTaskStatus[promptIndex].status = "failed";
      subTaskStatus[promptIndex].error = err.message || "生图失败。";
      subTaskStatus[promptIndex].latencyMs = Date.now() - subStartedAt;
      await updateTask(task.id, { subTaskStatus, resultImages: savedImages, completedCount: savedImages.length });
      await markTaskFailed(task.id, err.message || "生图失败。", savedImages, subTaskStatus, startedAt, channel?.model_id);
      console.log(`[task:failed] id=${task.id} at ${promptIndex}/${totalCount} err=${err.message}`);
      return;
    }
  }

  await completeTask(task, savedImages, subTaskStatus, startedAt, channel?.model_id, files.length);
}

async function completeTask(task, savedImages, subTaskStatus, startedAt, model, uploadedImageCount) {
  const latencyMs = Date.now() - startedAt;
  const record = {
    id: task.id,
    userId: task.userId,
    username: task.username,
    createdAt: new Date().toISOString(),
    status: "success",
    model: model || "gpt-image-2",
    mode: uploadedImageCount ? "image-edit" : "text-to-image",
    title: task.title,
    body: task.body,
    tags: task.tags || [],
    topic: task.topic || "",
    images: savedImages,
    promptHash: "",
    uploadedImageCount,
    latencyMs,
    channelId: task.channelId || null
  };
  await insertHistory(record);
  await updateTask(task.id, {
    status: "completed",
    resultImages: savedImages,
    subTaskStatus,
    completedCount: savedImages.length,
    completedAt: new Date().toISOString()
  });
  console.log(`[task:success] id=${task.id} images=${savedImages.length} latencyMs=${latencyMs}`);
}

async function markTaskFailed(taskId, errorMessage, savedImages = [], subTaskStatus = [], startedAt = 0, model) {
  const latencyMs = startedAt ? Date.now() - startedAt : 0;
  const task = await getTask(taskId);
  const record = {
    id: taskId,
    userId: task?.userId,
    username: task?.username,
    createdAt: new Date().toISOString(),
    status: "failed",
    model: model || "gpt-image-2",
    mode: "image-edit",
    title: task?.title || "",
    body: task?.body || "",
    tags: task?.tags || [],
    topic: task?.topic || "",
    images: savedImages,
    promptHash: "",
    uploadedImageCount: task?.referenceImages?.length || 0,
    error: errorMessage,
    latencyMs,
    channelId: task?.channelId || null
  };
  await insertHistory(record);
  await updateTask(taskId, {
    status: "failed",
    error: errorMessage,
    resultImages: savedImages,
    subTaskStatus,
    completedAt: new Date().toISOString()
  });
}
