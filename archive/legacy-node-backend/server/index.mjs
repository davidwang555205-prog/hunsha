import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { generatePrompt } from "./prompt.mjs";
import {
  ensureSchema,
  findUserByName,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  insertHistory,
  listHistoryForUser,
  queryHistoryPaged,
  countImagesForDate,
  purgeExpiredHistory,
  buildAccountSummaries,
  verifyPassword,
  hashPassword,
  makeUser,
  publicUser,
  normalizeDailyImageLimit,
  hasUnlimitedImageGeneration,
  isAdminRole,
  isSuperAdminRole,
  maxDailyImageLimit,
  nowIso,
  touchUserActiveAt,
  consumeCredits,
  adjustCredits,
  listCreditTransactions,
  listChannels,
  getChannel,
  getDefaultChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  setDefaultChannel,
  listChannelsForUser,
  getChannelStats,
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  insertTask,
  updateTask,
  getTask,
  listTasks,
  countActiveTasks
} from "./db.mjs";
import { configureTaskWorker, enqueueTask, cancelTask, queueLength } from "./tasks.mjs";
import { ensureBucket, putImage, getImageStream } from "./storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

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
const sessionTtlMs = 24 * 60 * 60 * 1000;
const sessionSecret =
  process.env.APP_SESSION_SECRET || process.env.APP_ADMIN_PASSWORD || "bridal-content-studio-session-secret";

// 配置异步任务 worker
configureTaskWorker({ timeoutMs: imageTimeoutMs, retryAttempts: imageRetryAttempts });

// ===== 通用工具 =====
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
    JSON.stringify({ userId, expiresAt: Date.now() + sessionTtlMs }),
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

async function getSessionUser(req) {
  const token = getBearerToken(req);
  const session = parseSessionToken(token);
  if (!session) return null;
  return await getUserById(session.userId);
}

/** 鉴权：要求登录 */
async function requireUser(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    sendError(res, 401, "登录已失效。");
    return null;
  }
  if (user.isDisabled) {
    sendError(res, 403, "账号已被禁用，请联系管理员。");
    return null;
  }
  return user;
}

/** 鉴权：要求管理员（admin/super_admin） */
async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!isAdminRole(user.role)) {
    sendError(res, 403, "需要管理员权限。");
    return null;
  }
  return user;
}

/** 鉴权：要求超级管理员 */
async function requireSuperAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!isSuperAdminRole(user.role)) {
    sendError(res, 403, "需要超级管理员权限。");
    return null;
  }
  return user;
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
    uploadedImageCount: record.uploadedImageCount || 0,
    channelId: record.channelId || null
  };
}

function sanitizeChannel(channel, includeKey = false) {
  if (!channel) return null;
  return {
    id: channel.id,
    name: channel.name,
    apiBaseUrl: channel.apiBaseUrl,
    modelId: channel.modelId,
    supportedSizes: channel.supportedSizes,
    defaultQuality: channel.defaultQuality,
    isEnabled: channel.isEnabled,
    isDefault: channel.isDefault,
    sortOrder: channel.sortOrder,
    apiKey: includeKey ? channel.apiKey : undefined,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt
  };
}

function sanitizeTask(task) {
  return {
    id: task.id,
    userId: task.userId,
    categoryId: task.categoryId,
    channelId: task.channelId,
    status: task.status,
    title: task.title,
    body: task.body,
    tags: task.tags,
    topic: task.topic,
    resultImages: task.resultImages || [],
    subTaskStatus: task.subTaskStatus || [],
    error: task.error || "",
    totalCount: task.totalCount,
    completedCount: task.completedCount,
    estimatedSeconds: task.estimatedSeconds,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt
  };
}

function parseDataUrl(file) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(file.dataUrl || "");
  if (!match) throw Object.assign(new Error(`图片 ${file.name || ""} 格式不正确。`), { statusCode: 400 });
  return { type: match[1], buffer: Buffer.from(match[2], "base64") };
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
  const maxContinuityReferenceBytes = 20 * 1024 * 1024;
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

async function callWalaApi({ prompt, files, size, quality }) {
  const apiKey = process.env.WALA_API_KEY;
  if (!apiKey) throw Object.assign(new Error("服务端缺少 WALA_API_KEY 环境变量。"), { statusCode: 500 });
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
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: imageModel, prompt, size: size || "1152x1536", quality: resolvedQuality }),
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

// ============================================================
// Handlers
// ============================================================

async function handleLogin(req, res) {
  const body = await parseJsonBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const user = await findUserByName(username);

  if (!user || !verifyPassword(password, user)) {
    return sendError(res, 401, "账号或密码不正确。");
  }
  if (user.isDisabled) {
    return sendError(res, 403, "账号已被禁用，请联系管理员。");
  }

  await touchUserActiveAt(user.id);
  const token = createSessionToken(user.id);
  return sendJson(res, 200, {
    token,
    user: publicUser(user),
    accounts: isAdminRole(user.role) ? await buildAccountSummaries() : undefined
  });
}

async function handleMe(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const records = await listHistoryForUser(user.id, user.role);
  return sendJson(res, 200, {
    user: publicUser(user),
    accounts: isAdminRole(user.role) ? await buildAccountSummaries() : undefined,
    summary: {
      requestCount: records.length,
      successCount: records.filter((record) => record.status === "success").length,
      generatedImageCount: records.reduce((count, record) => count + (record.images?.length || 0), 0),
      retentionDays
    }
  });
}

// ===== 用户管理（admin+）=====

async function handleListUsers(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const accounts = await buildAccountSummaries();
  return sendJson(res, 200, { accounts });
}

async function handleCreateUser(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const body = await parseJsonBody(req);
  const username = normalizeUsername(body.username);
  const displayName = String(body.displayName || username).trim() || username;
  const password = String(body.password || "");
  const dailyImageLimit = normalizeDailyImageLimit(body.dailyImageLimit);
  const credits = Math.max(0, Math.floor(Number(body.credits) || 0));
  const role = ["super_admin", "admin", "user"].includes(body.role) ? body.role : "user";
  const allowedChannels = Array.isArray(body.allowedChannels) ? body.allowedChannels.filter(Boolean) : null;

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return sendError(res, 400, "账号只能使用 3-32 位小写字母、数字、下划线、点或短横线。");
  }
  if (password.length < 6 || password.length > 72) {
    return sendError(res, 400, "初始密码长度需要在 6-72 位之间。");
  }
  if (role === "super_admin" && !isSuperAdminRole(admin.role)) {
    return sendError(res, 403, "仅超级管理员可创建超级管理员账号。");
  }

  const existing = await findUserByName(username);
  if (existing) return sendError(res, 409, "该账号已存在。");

  const user = makeUser(crypto.randomUUID(), username, displayName.slice(0, 40), role, password, dailyImageLimit, credits);
  user.allowedChannels = allowedChannels;
  await createUser(user);

  return sendJson(res, 201, {
    user: publicUser(user),
    accounts: await buildAccountSummaries()
  });
}

async function handleUpdateUser(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const targetUser = await getUserById(userId);
  if (!targetUser) return sendError(res, 404, "账号不存在。");

  const body = await parseJsonBody(req);
  const fields = {};

  if (Object.prototype.hasOwnProperty.call(body, "dailyImageLimit")) {
    if (hasUnlimitedImageGeneration(targetUser)) {
      return sendError(res, 400, "管理员账号不受每日生图数量限制，无需设置额度。");
    }
    const rawLimit = Number(body.dailyImageLimit);
    if (!Number.isFinite(rawLimit) || rawLimit < 0 || rawLimit > maxDailyImageLimit) {
      return sendError(res, 400, `每日生成图片上限需要在 0-${maxDailyImageLimit} 之间。`);
    }
    fields.dailyImageLimit = normalizeDailyImageLimit(rawLimit);
  }

  if (Object.prototype.hasOwnProperty.call(body, "credits")) {
    const credits = Number(body.credits);
    if (!Number.isFinite(credits) || credits < 0) {
      return sendError(res, 400, "积分余额需要为非负数。");
    }
    fields.credits = Math.floor(credits);
  }

  if (Object.prototype.hasOwnProperty.call(body, "role")) {
    const role = body.role;
    if (!["super_admin", "admin", "user"].includes(role)) {
      return sendError(res, 400, "角色无效。");
    }
    if (role === "super_admin" && !isSuperAdminRole(admin.role)) {
      return sendError(res, 403, "仅超级管理员可设置超级管理员角色。");
    }
    fields.role = role;
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayName")) {
    fields.displayName = String(body.displayName || "").trim().slice(0, 40);
  }

  if (Object.prototype.hasOwnProperty.call(body, "isDisabled")) {
    if (targetUser.id === admin.id && body.isDisabled) {
      return sendError(res, 400, "不能禁用当前登录账号。");
    }
    fields.isDisabled = Boolean(body.isDisabled);
  }

  if (Object.prototype.hasOwnProperty.call(body, "allowedChannels")) {
    fields.allowedChannels = Array.isArray(body.allowedChannels) ? body.allowedChannels.filter(Boolean) : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "password")) {
    const password = String(body.password || "");
    if (password.length < 6 || password.length > 72) {
      return sendError(res, 400, "新密码长度需要在 6-72 位之间。");
    }
    const passwordParts = hashPassword(password);
    fields.passwordSalt = passwordParts.salt;
    fields.passwordHash = passwordParts.hash;
  }

  await updateUser(userId, fields);
  const updated = await getUserById(userId);
  return sendJson(res, 200, {
    user: publicUser(updated),
    accounts: await buildAccountSummaries()
  });
}

async function handleDeleteUser(req, res, userId) {
  const admin = await requireSuperAdmin(req, res);
  if (!admin) return;
  if (userId === admin.id) return sendError(res, 400, "不能删除当前登录账号。");
  const targetUser = await getUserById(userId);
  if (!targetUser) return sendError(res, 404, "账号不存在。");
  await deleteUser(userId);
  return sendJson(res, 200, { accounts: await buildAccountSummaries() });
}

async function handleAdjustCredits(req, res, userId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const targetUser = await getUserById(userId);
  if (!targetUser) return sendError(res, 404, "账号不存在。");

  const body = await parseJsonBody(req);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return sendError(res, 400, "积分调整数量需为非零数字。");
  }
  const type = ["recharge", "adjust"].includes(body.type) ? body.type : "adjust";
  const description = String(body.description || "").trim() || undefined;
  const balanceAfter = await adjustCredits(userId, Math.floor(amount), type, description, admin.id);
  const updated = await getUserById(userId);
  return sendJson(res, 200, {
    user: publicUser(updated),
    balance: balanceAfter,
    accounts: await buildAccountSummaries()
  });
}

async function handleListCreditTransactions(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const url = new URL(req.url, "http://localhost");
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 50);
  const items = await listCreditTransactions(user.id, pageSize, (Math.max(1, page) - 1) * pageSize);
  return sendJson(res, 200, { transactions: items });
}

// ===== 模型线路（admin+）=====

async function handleListChannels(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const channels = await listChannels();
  const stats = await getChannelStats();
  return sendJson(res, 200, {
    channels: channels.map((c) => ({ ...sanitizeChannel(c, true), stats: stats[c.id] || null }))
  });
}

async function handleListPublicChannels(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const channels = await listChannelsForUser(user);
  return sendJson(res, 200, {
    channels: channels.map((c) => ({ ...sanitizeChannel(c, false), stats: c.stats || null }))
  });
}

async function handleCreateChannel(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await parseJsonBody(req);
  if (!body.name || !body.apiBaseUrl || !body.apiKey || !body.modelId) {
    return sendError(res, 400, "缺少 name / apiBaseUrl / apiKey / modelId。");
  }
  const channel = await createChannel({
    id: body.id || crypto.randomUUID(),
    name: String(body.name).slice(0, 60),
    apiBaseUrl: String(body.apiBaseUrl),
    apiKey: String(body.apiKey),
    modelId: String(body.modelId),
    supportedSizes: Array.isArray(body.supportedSizes) ? body.supportedSizes : [],
    defaultQuality: body.defaultQuality || "medium",
    isEnabled: body.isEnabled !== false,
    isDefault: body.isDefault === true,
    sortOrder: Number(body.sortOrder) || 0
  });
  return sendJson(res, 201, { channel: sanitizeChannel(channel, true) });
}

async function handleUpdateChannel(req, res, channelId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const existing = await getChannel(channelId);
  if (!existing) return sendError(res, 404, "线路不存在。");
  const body = await parseJsonBody(req);
  const fields = {};
  for (const key of ["name", "apiBaseUrl", "apiKey", "modelId", "defaultQuality", "isEnabled", "sortOrder", "supportedSizes"]) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  const channel = await updateChannel(channelId, fields);
  if (body.isDefault === true) await setDefaultChannel(channelId);
  return sendJson(res, 200, { channel: sanitizeChannel(channel, true) });
}

async function handleDeleteChannel(req, res, channelId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  await deleteChannel(channelId);
  return sendJson(res, 200, { ok: true });
}

// ===== 类目 =====

async function handleListCategories(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const categories = isAdminRole(user.role) ? await listCategories(false) : await listCategories(true);
  return sendJson(res, 200, { categories });
}

async function handleCreateCategory(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = await parseJsonBody(req);
  if (!body.name || !body.engine) {
    return sendError(res, 400, "缺少 name / engine。");
  }
  const category = await createCategory({
    id: body.id || crypto.randomUUID(),
    name: String(body.name).slice(0, 60),
    icon: body.icon || "",
    engine: String(body.engine),
    sortOrder: Number(body.sortOrder) || 0,
    isEnabled: body.isEnabled !== false,
    config: body.config || {}
  });
  return sendJson(res, 201, { category });
}

async function handleUpdateCategory(req, res, categoryId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const existing = await getCategory(categoryId);
  if (!existing) return sendError(res, 404, "类目不存在。");
  const body = await parseJsonBody(req);
  const fields = {};
  for (const key of ["name", "icon", "engine", "sortOrder", "isEnabled", "config"]) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  const category = await updateCategory(categoryId, fields);
  return sendJson(res, 200, { category });
}

async function handleDeleteCategory(req, res, categoryId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  await deleteCategory(categoryId);
  return sendJson(res, 200, { ok: true });
}

// ===== 异步生图任务 =====

async function handleCreateTask(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = await parseJsonBody(req);
  const promptParamsList = Array.isArray(body.promptParamsList)
    ? body.promptParamsList.filter((item) => item && typeof item === "object").slice(0, 5)
    : [];
  const title = String(body.title || "").trim();
  const textBody = String(body.body || "").trim();
  const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)).filter(Boolean).slice(0, 20) : [];
  const files = Array.isArray(body.referenceImages) ? body.referenceImages.slice(0, 4) : [];
  const categoryId = String(body.categoryId || "").trim() || null;
  const channelId = String(body.channelId || "").trim() || null;

  if (!promptParamsList.length) return sendError(res, 400, "缺少生图参数。");
  if (!title || !textBody || !tags.length) return sendError(res, 400, "缺少标题、正文或标签。");

  // 积分校验：非管理员需有足够积分
  if (!hasUnlimitedImageGeneration(user)) {
    if ((user.credits || 0) < promptParamsList.length) {
      return sendError(
        res,
        402,
        `积分余额不足。当前余额 ${user.credits || 0}，本次需要 ${promptParamsList.length} 积分。请联系管理员充值。`
      );
    }
  }

  // 模型线路校验
  if (channelId) {
    const channel = await getChannel(channelId);
    if (!channel || !channel.isEnabled) return sendError(res, 400, "所选模型线路不可用。");
    if (user.allowedChannels?.length && !user.allowedChannels.includes(channelId)) {
      return sendError(res, 403, "无权使用该模型线路。");
    }
  }

  // 限流：每个用户最多 3 个进行中任务
  const activeCount = await countActiveTasks(user.id);
  if (activeCount >= 3) {
    return sendError(res, 429, "已有 3 个任务进行中，请等待完成后再提交。");
  }

  const taskId = crypto.randomUUID();
  const defaultChannel = await getDefaultChannel();
  const task = {
    id: taskId,
    userId: user.id,
    username: user.username,
    role: user.role,
    categoryId,
    channelId: channelId || defaultChannel?.id || null,
    status: "queued",
    title,
    body: textBody,
    tags,
    topic: String(body.topic || ""),
    promptParamsList,
    referenceImages: files,
    size: body.size,
    quality: body.quality,
    totalCount: promptParamsList.length,
    completedCount: 0,
    estimatedSeconds: promptParamsList.length * 90,
    createdAt: nowIso()
  };
  await insertTask(task);
  enqueueTask(taskId);

  console.log(`[task:queued] id=${taskId} user=${user.username} count=${promptParamsList.length} queue=${queueLength()}`);
  return sendJson(res, 202, {
    taskId,
    status: "queued",
    totalCount: promptParamsList.length,
    estimatedSeconds: task.estimatedSeconds
  });
}

async function handleListTasks(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const url = new URL(req.url, "http://localhost");
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 20);
  const status = url.searchParams.get("status") || undefined;
  const result = await listTasks(user.id, user.role, page, pageSize, status);
  return sendJson(res, 200, {
    tasks: result.items.map(sanitizeTask),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize
  });
}

async function handleGetTask(req, res, taskId) {
  const user = await requireUser(req, res);
  if (!user) return;
  const task = await getTask(taskId);
  if (!task) return sendError(res, 404, "任务不存在。");
  if (!isAdminRole(user.role) && task.userId !== user.id) {
    return sendError(res, 403, "无权查看该任务。");
  }
  return sendJson(res, 200, { task: sanitizeTask(task) });
}

async function handleCancelTask(req, res, taskId) {
  const user = await requireUser(req, res);
  if (!user) return;
  const task = await getTask(taskId);
  if (!task) return sendError(res, 404, "任务不存在。");
  if (!isAdminRole(user.role) && task.userId !== user.id) {
    return sendError(res, 403, "无权取消该任务。");
  }
  if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
    return sendError(res, 400, `任务已${task.status === "completed" ? "完成" : task.status === "failed" ? "失败" : "取消"}，无法取消。`);
  }
  cancelTask(taskId);
  if (task.status === "queued") {
    await updateTask(taskId, { status: "cancelled", completedAt: nowIso() });
  }
  return sendJson(res, 200, { ok: true, status: "cancelled" });
}

// ===== 历史 =====

async function handleHistory(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const records = await listHistoryForUser(user.id, user.role);
  return sendJson(res, 200, { history: records.slice(0, 100).map(sanitizeHistory) });
}

async function handleHistoryPaged(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const url = new URL(req.url, "http://localhost");
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 20);
  const status = url.searchParams.get("status") || undefined;
  const q = url.searchParams.get("q") || undefined;
  let startDate = url.searchParams.get("startDate") || undefined;
  let endDate = url.searchParams.get("endDate") || undefined;
  if (startDate) startDate = new Date(startDate).toISOString();
  if (endDate) {
    const d = new Date(endDate);
    d.setDate(d.getDate() + 1);
    endDate = d.toISOString();
  }
  const result = await queryHistoryPaged({ userId: user.id, role: user.role, page, pageSize, status, startDate, endDate, q });
  return sendJson(res, 200, {
    history: result.items.map(sanitizeHistory),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize
  });
}

// ===== 同步生图（保留兼容）=====

async function handleGenerate(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

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

  const recordId = crypto.randomUUID();
  const personImageTypes = new Set(["产品上身图", "对镜穿搭图", "生活场景图"]);
  const leadPersonIndex = promptParamsList.findIndex((p) => personImageTypes.has(p.imageType));
  const leadPhoneIndex = promptParamsList.findIndex((p) => p.bridalKeywordProfileId === "phoneMirrorSelfieFitting");
  const leadParams = promptParamsList[leadPersonIndex >= 0 ? leadPersonIndex : 0];
  const sharedScenePreference = leadParams.scenePreference || "自动匹配";
  const sharedModelChoice = leadParams.modelChoice;
  const normalizedPromptParamsList = promptParamsList.map((p) => ({
    ...p,
    scenePreference: sharedScenePreference,
    modelChoice: personImageTypes.has(p.imageType) ? sharedModelChoice : p.modelChoice
  }));
  const promptPlans = normalizedPromptParamsList.map((p, index) => ({
    prompt: generatePrompt(p, { index, total: normalizedPromptParamsList.length, leadPersonIndex, leadPhoneIndex }),
    includesPerson: personImageTypes.has(p.imageType),
    name: String(p.generatedImageName || `图片 ${index + 1}`).trim().slice(0, 60) || `图片 ${index + 1}`
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
          promptIndex === 0 ? sceneContinuityReference : await generatedImageToReferenceFile(generatedImages[0], recordId, "人物");
      }

      const nextImages = await saveGeneratedImages(recordId, generatedImages, savedImages.length, promptPlan.name);
      savedImages.push(...nextImages);

      // 积分扣减（非管理员，每张成功扣 1）
      if (!hasUnlimitedImageGeneration(user)) {
        try {
          await consumeCredits(user.id, 1, `生图消费：${promptPlan.name}`, recordId);
        } catch (creditErr) {
          if (creditErr.statusCode === 402) {
            throw Object.assign(new Error("积分余额不足，生图已中止。"), { statusCode: 402 });
          }
          throw creditErr;
        }
      }
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
    await insertHistory(record);
    await purgeExpiredHistory(retentionDays);
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
    await insertHistory(record);
    await purgeExpiredHistory(retentionDays);
    console.log(`[generate:failed] id=${recordId} status=${error.statusCode || 500} latencyMs=${record.latencyMs} error=${record.error}`);
    return sendError(res, error.statusCode || 500, record.error);
  }
}

async function serveGenerated(req, res, pathname) {
  const key = path.basename(pathname.replace("/api/generated/", ""));
  try {
    const stream = await getImageStream(key);
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000" });
    stream.pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
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
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      return res.end();
    }

    const p = url.pathname;
    const m = req.method;

    // 认证
    if (p === "/api/login" && m === "POST") return await handleLogin(req, res);
    if (p === "/api/me" && m === "GET") return await handleMe(req, res);

    // 用户管理
    if (p === "/api/admin/users" && m === "GET") return await handleListUsers(req, res);
    if (p === "/api/admin/users" && m === "POST") return await handleCreateUser(req, res);
    if (p.startsWith("/api/admin/users/") && m === "PATCH") {
      const rest = decodeURIComponent(p.slice("/api/admin/users/".length));
      if (rest.endsWith("/credits")) return await handleAdjustCredits(req, res, rest.slice(0, -"/credits".length));
      return await handleUpdateUser(req, res, rest);
    }
    if (p.startsWith("/api/admin/users/") && m === "DELETE") {
      const userId = decodeURIComponent(p.slice("/api/admin/users/".length));
      return await handleDeleteUser(req, res, userId);
    }
    // 积分记录
    if (p === "/api/credits/transactions" && m === "GET") return await handleListCreditTransactions(req, res);

    // 模型线路
    if (p === "/api/channels" && m === "GET") return await handleListPublicChannels(req, res);
    if (p === "/api/admin/channels" && m === "GET") return await handleListChannels(req, res);
    if (p === "/api/admin/channels" && m === "POST") return await handleCreateChannel(req, res);
    if (p.startsWith("/api/admin/channels/") && m === "PATCH") {
      const channelId = decodeURIComponent(p.slice("/api/admin/channels/".length));
      return await handleUpdateChannel(req, res, channelId);
    }
    if (p.startsWith("/api/admin/channels/") && m === "DELETE") {
      const channelId = decodeURIComponent(p.slice("/api/admin/channels/".length));
      return await handleDeleteChannel(req, res, channelId);
    }

    // 类目
    if (p === "/api/categories" && m === "GET") return await handleListCategories(req, res);
    if (p === "/api/admin/categories" && m === "POST") return await handleCreateCategory(req, res);
    if (p.startsWith("/api/admin/categories/") && m === "PATCH") {
      const categoryId = decodeURIComponent(p.slice("/api/admin/categories/".length));
      return await handleUpdateCategory(req, res, categoryId);
    }
    if (p.startsWith("/api/admin/categories/") && m === "DELETE") {
      const categoryId = decodeURIComponent(p.slice("/api/admin/categories/".length));
      return await handleDeleteCategory(req, res, categoryId);
    }

    // 异步生图任务
    if (p === "/api/v1/generation" && m === "POST") return await handleCreateTask(req, res);
    if (p === "/api/v1/generation/tasks" && m === "GET") return await handleListTasks(req, res);
    if (p.startsWith("/api/v1/generation/tasks/") && p.endsWith("/cancel") && m === "POST") {
      const taskId = decodeURIComponent(p.slice("/api/v1/generation/tasks/".length, -"/cancel".length));
      return await handleCancelTask(req, res, taskId);
    }
    if (p.startsWith("/api/v1/generation/tasks/") && m === "GET") {
      const taskId = decodeURIComponent(p.slice("/api/v1/generation/tasks/".length));
      return await handleGetTask(req, res, taskId);
    }

    // 历史
    if (p === "/api/history" && m === "GET") return await handleHistory(req, res);
    if (p === "/api/v1/generation/history" && m === "GET") return await handleHistoryPaged(req, res);

    // 同步生图（保留兼容）
    if (p === "/api/generate" && m === "POST") return await handleGenerate(req, res);

    if (p.startsWith("/api/generated/") && m === "GET") return await serveGenerated(req, res, p);
    if (p.startsWith("/api/")) return sendError(res, 404, "接口不存在。");

    return await serveStatic(res, decodeURIComponent(p));
  } catch (error) {
    if (error instanceof SyntaxError) return sendError(res, 400, "请求 JSON 格式不正确。");
    return sendError(res, error.statusCode || 500, error.message || "服务器错误。");
  }
}

await ensureSchema();
await ensureBucket();

createServer(handleRequest).listen(port, "0.0.0.0", () => {
  console.log(`Bridal content studio (V2) listening on http://127.0.0.1:${port}`);
});
