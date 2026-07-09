import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { generatePrompt } from "./prompt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const dataDir = path.join(__dirname, "data");
const generatedDir = path.join(dataDir, "generated");
const dbPath = path.join(dataDir, "db.json");

function applyDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

applyDotEnv(path.join(rootDir, ".env"));

const port = Number(process.env.PORT || 8787);
const apiBaseUrl = (process.env.WALA_API_BASE_URL || "https://walaapi.net/v1").replace(/\/+$/, "");
const imageModel = "gpt-image-2";
const supportedImageQualities = new Set(["low", "medium", "high", "auto"]);
const defaultImageQuality = supportedImageQualities.has(process.env.WALA_IMAGE_QUALITY)
  ? process.env.WALA_IMAGE_QUALITY
  : "medium";
const retentionDays = Number(process.env.HISTORY_RETENTION_DAYS || 180);
const imageTimeoutMs = Number(process.env.WALA_IMAGE_TIMEOUT_MS || 180000);
const imageRetryAttempts = Math.max(1, Number(process.env.WALA_IMAGE_RETRY_ATTEMPTS || 3));
const maxBodyBytes = 80 * 1024 * 1024;
const maxContinuityReferenceBytes = 20 * 1024 * 1024;
const sessionTtlMs = 24 * 60 * 60 * 1000;
const maxDailyImageLimit = 1000;
const defaultDailyImageLimit = (() => {
  const value = Number(process.env.DEFAULT_DAILY_IMAGE_LIMIT || 20);
  return Number.isFinite(value) ? Math.max(0, Math.min(maxDailyImageLimit, Math.floor(value))) : 20;
})();
const sessionSecret =
  process.env.APP_SESSION_SECRET || process.env.APP_ADMIN_PASSWORD || "bridal-content-studio-session-secret";

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function normalizeDailyImageLimit(value, fallback = defaultDailyImageLimit) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(0, Math.min(maxDailyImageLimit, Math.floor(limit)));
}

function hasUnlimitedImageGeneration(user) {
  return user.role === "admin";
}

function makeUser(id, username, displayName, role, password, dailyImageLimit = defaultDailyImageLimit) {
  const passwordParts = hashPassword(password);
  return {
    id,
    username,
    displayName,
    role,
    dailyImageLimit: normalizeDailyImageLimit(dailyImageLimit),
    passwordSalt: passwordParts.salt,
    passwordHash: passwordParts.hash,
    createdAt: nowIso()
  };
}

async function ensureDataFiles() {
  await mkdir(generatedDir, { recursive: true });
  if (existsSync(dbPath)) return;

  const db = {
    users: [
      makeUser("admin", "admin", "管理员", "admin", process.env.APP_ADMIN_PASSWORD || "admin123"),
      makeUser("wang", "wang", "wang", "user", process.env.APP_USER_PASSWORD || "user123")
    ],
    history: []
  };
  await writeDb(db);
}

async function readDb() {
  await ensureDataFiles();
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  const normalizedDb = purgeExpiredHistory(normalizeDb(db));
  if (normalizedDb.__changed) {
    delete normalizedDb.__changed;
    await writeDb(normalizedDb);
  }
  return normalizedDb;
}

async function writeDb(db) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function purgeExpiredHistory(db) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  db.history = (db.history || []).filter((record) => new Date(record.createdAt).getTime() >= cutoff);
  return db;
}

function normalizeDb(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.history = Array.isArray(db.history) ? db.history : [];
  for (const user of db.users) {
    const nextLimit = normalizeDailyImageLimit(user.dailyImageLimit);
    if (user.dailyImageLimit !== nextLimit) {
      user.dailyImageLimit = nextLimit;
      db.__changed = true;
    }
  }
  return db;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    dailyImageLimit: normalizeDailyImageLimit(user.dailyImageLimit),
    hasUnlimitedImageGeneration: hasUnlimitedImageGeneration(user)
  };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

async function parseJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw Object.assign(new Error("请求内容过大。"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("请求 JSON 格式不正确。"), { statusCode: 400 });
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function signSessionPayload(payload) {
  return crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function createSessionToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      expiresAt: Date.now() + sessionTtlMs
    }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signSessionPayload(payload)}`;
}

function parseSessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signSessionPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.userId || !session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function getSessionUser(req, db) {
  const token = getBearerToken(req);
  const session = parseSessionToken(token);
  if (!session) return null;

  const user = db.users.find((candidate) => candidate.id === session.userId);
  return user || null;
}

function historyForUser(db, user) {
  if (user.role === "admin") return db.history;
  return db.history.filter((record) => record.userId === user.id);
}

function shanghaiDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function generatedImagesForDate(db, userId, dateKey = shanghaiDateKey()) {
  return (db.history || [])
    .filter((record) => record.userId === userId && shanghaiDateKey(record.createdAt) === dateKey)
    .reduce((count, record) => count + (record.images?.length || 0), 0);
}

function buildAccountSummaries(db) {
  return db.users.map((user) => {
    const records = db.history.filter((record) => record.userId === user.id);
    const successfulRecords = records.filter((record) => record.status === "success");
    return {
      user: publicUser(user),
      requestCount: records.length,
      successCount: successfulRecords.length,
      failedCount: records.length - successfulRecords.length,
      generatedImageCount: records.reduce((count, record) => count + (record.images?.length || 0), 0),
      dailyGeneratedImageCount: generatedImagesForDate(db, user.id),
      lastGeneratedAt: records[0]?.createdAt || null
    };
  });
}

function sanitizeHistory(record) {
  return {
    id: record.id,
    userId: record.userId,
    username: record.username,
    createdAt: record.createdAt,
    status: record.status,
    model: record.model,
    mode: record.mode,
    title: record.title,
    body: record.body,
    tags: record.tags,
    topic: record.topic,
    images: record.images || [],
    error: record.error || "",
    uploadedImageCount: record.uploadedImageCount || 0
  };
}

function parseDataUrl(file) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(file.dataUrl || "");
  if (!match) {
    throw Object.assign(new Error(`图片 ${file.name || ""} 格式不正确。`), { statusCode: 400 });
  }

  return {
    type: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function extensionFromMime(type) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

function resolveImageQuality(quality) {
  return supportedImageQualities.has(quality) ? quality : defaultImageQuality;
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
  const prefix = `WalaAPI 上游负载已饱和，已自动重试 ${imageRetryAttempts} 次仍未成功。请稍后再试，或在 WalaAPI 后台切换可用分组/模型后重试。`;
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

async function saveGeneratedImages(recordId, images, startIndex = 0, imageName = "") {
  const saved = [];

  for (const [index, image] of images.entries()) {
    const imageNumber = startIndex + index + 1;
    const name = imageName || `图片 ${imageNumber}`;
    if (image.url) {
      saved.push({
        id: `${recordId}-${imageNumber}`,
        name,
        url: image.url,
        downloadUrl: image.url,
        source: "remote"
      });
      continue;
    }

    const base64 = image.b64.replace(/^data:[^;]+;base64,/i, "");
    const filename = `${recordId}-${imageNumber}.png`;
    const filePath = path.join(generatedDir, filename);
    await writeFile(filePath, Buffer.from(base64, "base64"));
    saved.push({
      id: `${recordId}-${imageNumber}`,
      name,
      url: `/api/generated/${filename}`,
      downloadUrl: `/api/generated/${filename}`,
      source: "local"
    });
  }

  return saved;
}

async function callWalaApi({ prompt, files, size, quality }) {
  const apiKey = process.env.WALA_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("服务端缺少 WALA_API_KEY 环境变量。"), { statusCode: 500 });
  }

  const resolvedQuality = resolveImageQuality(quality);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), imageTimeoutMs);

  if (files.length) {
    try {
      const form = new FormData();
      for (const file of files) {
        const parsed = parseDataUrl(file);
        form.append("image", new Blob([parsed.buffer], { type: parsed.type }), file.name || `reference.${extensionFromMime(parsed.type)}`);
      }
      form.append("prompt", prompt);
      form.append("model", imageModel);
      form.append("size", size || "1152x1536");
      form.append("quality", resolvedQuality);

      return await fetch(`${apiBaseUrl}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw Object.assign(new Error(`生图接口超过 ${Math.round(imageTimeoutMs / 1000)} 秒未返回，已中断。`), { statusCode: 504 });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    return await fetch(`${apiBaseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        size: size || "1152x1536",
        quality: resolvedQuality
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw Object.assign(new Error(`生图接口超过 ${Math.round(imageTimeoutMs / 1000)} 秒未返回，已中断。`), { statusCode: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callWalaApiWithRetries(request) {
  for (let attempt = 1; attempt <= imageRetryAttempts; attempt += 1) {
    try {
      const response = await callWalaApi(request);
      if (response.ok || attempt >= imageRetryAttempts) return response;

      const bodyText = await response.clone().text();
      if (!isRetryableWalaResponse(response.status, bodyText)) return response;

      const waitMs = retryDelayMs(attempt);
      console.log(`[wala:retry] attempt=${attempt}/${imageRetryAttempts} status=${response.status} waitMs=${waitMs}`);
      await delay(waitMs);
    } catch (error) {
      if (attempt >= imageRetryAttempts || !isRetryableWalaResponse(error.statusCode || 500, error.message || "")) {
        throw error;
      }

      const waitMs = retryDelayMs(attempt);
      console.log(`[wala:retry] attempt=${attempt}/${imageRetryAttempts} status=${error.statusCode || 500} waitMs=${waitMs}`);
      await delay(waitMs);
    }
  }

  throw Object.assign(new Error(buildWalaOverloadMessage("")), { statusCode: 503 });
}

async function handleLogin(req, res) {
  const db = await readDb();
  const body = await parseJsonBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const user = db.users.find((candidate) => candidate.username === username);

  if (!user || !verifyPassword(password, user)) {
    return sendError(res, 401, "账号或密码不正确。");
  }

  const token = createSessionToken(user.id);

  return sendJson(res, 200, {
    token,
    user: publicUser(user),
    accounts: user.role === "admin" ? buildAccountSummaries(db) : undefined
  });
}

async function handleMe(req, res) {
  const db = await readDb();
  const user = getSessionUser(req, db);
  if (!user) return sendError(res, 401, "登录已失效。");

  const records = historyForUser(db, user);
  return sendJson(res, 200, {
    user: publicUser(user),
    accounts: user.role === "admin" ? buildAccountSummaries(db) : undefined,
    summary: {
      requestCount: records.length,
      successCount: records.filter((record) => record.status === "success").length,
      generatedImageCount: records.reduce((count, record) => count + (record.images?.length || 0), 0),
      retentionDays
    }
  });
}

async function handleCreateUser(req, res) {
  const db = await readDb();
  const currentUser = getSessionUser(req, db);
  if (!currentUser) return sendError(res, 401, "登录已失效。");
  if (currentUser.role !== "admin") return sendError(res, 403, "只有管理员可以开通使用者账号。");

  const body = await parseJsonBody(req);
  const username = normalizeUsername(body.username);
  const displayName = String(body.displayName || username).trim() || username;
  const password = String(body.password || "");
  const dailyImageLimit = normalizeDailyImageLimit(body.dailyImageLimit);

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return sendError(res, 400, "账号只能使用 3-32 位小写字母、数字、下划线、点或短横线。");
  }

  if (password.length < 6 || password.length > 72) {
    return sendError(res, 400, "初始密码长度需要在 6-72 位之间。");
  }

  if (db.users.some((user) => normalizeUsername(user.username) === username)) {
    return sendError(res, 409, "该账号已存在。");
  }

  const user = makeUser(crypto.randomUUID(), username, displayName.slice(0, 40), "user", password, dailyImageLimit);
  db.users.push(user);
  await writeDb(db);

  return sendJson(res, 201, {
    user: publicUser(user),
    accounts: buildAccountSummaries(db)
  });
}

async function handleUpdateUser(req, res, userId) {
  const db = await readDb();
  const currentUser = getSessionUser(req, db);
  if (!currentUser) return sendError(res, 401, "登录已失效。");
  if (currentUser.role !== "admin") return sendError(res, 403, "只有管理员可以修改账号设置。");

  const targetUser = db.users.find((user) => user.id === userId);
  if (!targetUser) return sendError(res, 404, "账号不存在。");

  const body = await parseJsonBody(req);
  if (Object.prototype.hasOwnProperty.call(body, "dailyImageLimit")) {
    if (hasUnlimitedImageGeneration(targetUser)) {
      return sendError(res, 400, "管理员账号不受每日生图数量限制，无需设置额度。");
    }
    const rawLimit = Number(body.dailyImageLimit);
    if (!Number.isFinite(rawLimit) || rawLimit < 0 || rawLimit > maxDailyImageLimit) {
      return sendError(res, 400, `每日生成图片上限需要在 0-${maxDailyImageLimit} 之间。`);
    }
    targetUser.dailyImageLimit = normalizeDailyImageLimit(rawLimit);
  }

  if (Object.prototype.hasOwnProperty.call(body, "password")) {
    const password = String(body.password || "");
    if (password.length < 6 || password.length > 72) {
      return sendError(res, 400, "新密码长度需要在 6-72 位之间。");
    }
    const passwordParts = hashPassword(password);
    targetUser.passwordSalt = passwordParts.salt;
    targetUser.passwordHash = passwordParts.hash;
  }
  await writeDb(db);

  return sendJson(res, 200, {
    user: publicUser(targetUser),
    accounts: buildAccountSummaries(db)
  });
}

async function handleHistory(req, res) {
  const db = await readDb();
  const user = getSessionUser(req, db);
  if (!user) return sendError(res, 401, "登录已失效。");

  return sendJson(res, 200, {
    history: historyForUser(db, user).slice(0, 100).map(sanitizeHistory)
  });
}

async function handleGenerate(req, res) {
  const db = await readDb();
  const user = getSessionUser(req, db);
  if (!user) return sendError(res, 401, "登录已失效。");

  const body = await parseJsonBody(req);
  const promptParamsList = Array.isArray(body.promptParamsList)
    ? body.promptParamsList.filter((item) => item && typeof item === "object").slice(0, 5)
    : body.promptParams && typeof body.promptParams === "object"
      ? [body.promptParams]
      : [];
  const title = String(body.title || "").trim();
  const textBody = String(body.body || "").trim();
  const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)).filter(Boolean).slice(0, 20) : [];
  const files = Array.isArray(body.referenceImages) ? body.referenceImages.slice(0, 4) : [];

  if (!promptParamsList.length) return sendError(res, 400, "缺少生图参数。");
  if (!title || !textBody || !tags.length) return sendError(res, 400, "缺少标题、正文或标签。");

  const dailyImageLimit = normalizeDailyImageLimit(user.dailyImageLimit);
  const generatedToday = generatedImagesForDate(db, user.id);
  const requestedImageCount = promptParamsList.length;
  if (!hasUnlimitedImageGeneration(user) && generatedToday + requestedImageCount > dailyImageLimit) {
    const remaining = Math.max(0, dailyImageLimit - generatedToday);
    return sendError(
      res,
      429,
      `今日生成图片额度不足。当前账号每日上限 ${dailyImageLimit} 张，今日已生成 ${generatedToday} 张，剩余 ${remaining} 张，本次需要 ${requestedImageCount} 张。请联系管理员调整上限或明天再试。`
    );
  }

  const recordId = crypto.randomUUID();
  const personImageTypes = new Set(["产品上身图", "对镜穿搭图", "生活场景图"]);
  const leadPersonIndex = promptParamsList.findIndex((promptParams) => personImageTypes.has(promptParams.imageType));
  const leadParams = promptParamsList[leadPersonIndex >= 0 ? leadPersonIndex : 0];
  const sharedScenePreference = leadParams.scenePreference || "自动匹配";
  const sharedModelChoice = leadParams.modelChoice;
  const normalizedPromptParamsList = promptParamsList.map((promptParams) => ({
    ...promptParams,
    scenePreference: sharedScenePreference,
    modelChoice: personImageTypes.has(promptParams.imageType) ? sharedModelChoice : promptParams.modelChoice
  }));
  const promptPlans = normalizedPromptParamsList.map((promptParams, index) => ({
    prompt: generatePrompt(promptParams, {
      index,
      total: normalizedPromptParamsList.length,
      leadPersonIndex
    }),
    includesPerson: personImageTypes.has(promptParams.imageType),
    name: String(promptParams.generatedImageName || `图片 ${index + 1}`).trim().slice(0, 60) || `图片 ${index + 1}`
  }));
  const prompts = promptPlans.map((plan) => plan.prompt);
  const promptHash = crypto.createHash("sha256").update(prompts.join("\n---\n")).digest("hex");
  const startedAt = Date.now();
  const mode = files.length ? "image-edit" : "text-to-image";
  const savedImages = [];
  let sceneContinuityReference = null;
  let identityContinuityReference = null;
  console.log(
    `[generate:start] id=${recordId} user=${user.username} mode=${mode} files=${files.length} prompts=${prompts.length} model=${imageModel}`
  );

  try {
    for (const [promptIndex, promptPlan] of promptPlans.entries()) {
      const continuityReferences = [
        identityContinuityReference,
        sceneContinuityReference && sceneContinuityReference !== identityContinuityReference ? sceneContinuityReference : null
      ].filter(Boolean);
      const requestFiles =
        promptIndex === 0
          ? files
          : [...continuityReferences, ...files.slice(0, Math.max(0, 4 - continuityReferences.length))].slice(0, 4);
      const apiResponse = await callWalaApiWithRetries({
        prompt: promptPlan.prompt,
        files: requestFiles,
        size: body.size,
        quality: body.quality
      });
      const responseText = await apiResponse.text();
      let responsePayload = {};
      try {
        responsePayload = JSON.parse(responseText);
      } catch {
        responsePayload = { raw: responseText };
      }

      if (!apiResponse.ok) {
        const message = responsePayload?.error?.message || responsePayload?.message || responseText || "生图接口调用失败。";
        const friendlyMessage = isRetryableWalaResponse(apiResponse.status, message) ? buildWalaOverloadMessage(message) : message;
        throw Object.assign(new Error(friendlyMessage), { statusCode: apiResponse.status });
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
          promptIndex === 0
            ? sceneContinuityReference
            : await generatedImageToReferenceFile(generatedImages[0], recordId, "人物");
      }

      const nextImages = await saveGeneratedImages(recordId, generatedImages, savedImages.length, promptPlan.name);
      savedImages.push(...nextImages);
    }

    const record = {
      id: recordId,
      userId: user.id,
      username: user.username,
      createdAt: nowIso(),
      status: "success",
      model: imageModel,
      mode,
      title,
      body: textBody,
      tags,
      topic: String(body.topic || ""),
      images: savedImages,
      promptHash,
      uploadedImageCount: files.length,
      latencyMs: Date.now() - startedAt
    };

    db.history.unshift(record);
    await writeDb(purgeExpiredHistory(db));
    console.log(`[generate:success] id=${recordId} images=${savedImages.length} latencyMs=${record.latencyMs}`);
    return sendJson(res, 200, { record: sanitizeHistory(record) });
  } catch (error) {
    const record = {
      id: recordId,
      userId: user.id,
      username: user.username,
      createdAt: nowIso(),
      status: "failed",
      model: imageModel,
      mode,
      title,
      body: textBody,
      tags,
      topic: String(body.topic || ""),
      images: savedImages,
      promptHash,
      uploadedImageCount: files.length,
      error: error.message || "生图失败。",
      latencyMs: Date.now() - startedAt
    };
    db.history.unshift(record);
    await writeDb(purgeExpiredHistory(db));
    console.log(`[generate:failed] id=${recordId} status=${error.statusCode || 500} latencyMs=${record.latencyMs} error=${record.error}`);
    return sendError(res, error.statusCode || 500, record.error);
  }
}

async function serveGenerated(req, res, pathname) {
  const filename = path.basename(pathname.replace("/api/generated/", ""));
  const filePath = path.join(generatedDir, filename);
  if (!filePath.startsWith(generatedDir) || !existsSync(filePath)) {
    res.writeHead(404);
    return res.end("Not found");
  }

  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "private, max-age=31536000"
  });
  return createReadStream(filePath).pipe(res);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

async function serveStatic(res, pathname) {
  let filePath = path.join(distDir, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (!existsSync(filePath)) {
    filePath = path.join(distDir, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("请先运行 npm run build。");
  }

  const info = await stat(filePath);
  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Content-Length": info.size
  });
  return createReadStream(filePath).pipe(res);
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      return res.end();
    }

    if (url.pathname === "/api/login" && req.method === "POST") return await handleLogin(req, res);
    if (url.pathname === "/api/me" && req.method === "GET") return await handleMe(req, res);
    if (url.pathname === "/api/admin/users" && req.method === "POST") return await handleCreateUser(req, res);
    if (url.pathname.startsWith("/api/admin/users/") && req.method === "PATCH") {
      const userId = decodeURIComponent(url.pathname.slice("/api/admin/users/".length));
      return await handleUpdateUser(req, res, userId);
    }
    if (url.pathname === "/api/history" && req.method === "GET") return await handleHistory(req, res);
    if (url.pathname === "/api/generate" && req.method === "POST") return await handleGenerate(req, res);
    if (url.pathname.startsWith("/api/generated/") && req.method === "GET") return await serveGenerated(req, res, url.pathname);
    if (url.pathname.startsWith("/api/")) return sendError(res, 404, "接口不存在。");

    return await serveStatic(res, decodeURIComponent(url.pathname));
  } catch (error) {
    if (error instanceof SyntaxError) return sendError(res, 400, "请求 JSON 格式不正确。");
    return sendError(res, error.statusCode || 500, error.message || "服务器错误。");
  }
}

await ensureDataFiles();

createServer(handleRequest).listen(port, "0.0.0.0", () => {
  console.log(`Bridal content studio listening on http://127.0.0.1:${port}`);
});
