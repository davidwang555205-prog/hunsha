import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

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
const imageModel = process.env.WALA_IMAGE_MODEL || "gpt-image-2";
const supportedImageQualities = new Set(["low", "medium", "high", "auto"]);
const defaultImageQuality = supportedImageQualities.has(process.env.WALA_IMAGE_QUALITY)
  ? process.env.WALA_IMAGE_QUALITY
  : "medium";
const retentionDays = Number(process.env.HISTORY_RETENTION_DAYS || 180);
const imageTimeoutMs = Number(process.env.WALA_IMAGE_TIMEOUT_MS || 180000);
const maxBodyBytes = 80 * 1024 * 1024;
const sessionTtlMs = 24 * 60 * 60 * 1000;

const sessions = new Map();

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

function makeUser(id, username, displayName, role, password) {
  const passwordParts = hashPassword(password);
  return {
    id,
    username,
    displayName,
    role,
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
  return purgeExpiredHistory(db);
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

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };
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

function getSessionUser(req, db) {
  const token = getBearerToken(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }

  const user = db.users.find((candidate) => candidate.id === session.userId);
  return user || null;
}

function historyForUser(db, user) {
  if (user.role === "admin") return db.history;
  return db.history.filter((record) => record.userId === user.id);
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
      generatedImageCount: successfulRecords.reduce((count, record) => count + (record.images?.length || 0), 0),
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

async function saveGeneratedImages(recordId, images) {
  const saved = [];

  for (const [index, image] of images.entries()) {
    if (image.url) {
      saved.push({
        id: `${recordId}-${index + 1}`,
        url: image.url,
        downloadUrl: image.url,
        source: "remote"
      });
      continue;
    }

    const base64 = image.b64.replace(/^data:[^;]+;base64,/i, "");
    const filename = `${recordId}-${index + 1}.png`;
    const filePath = path.join(generatedDir, filename);
    await writeFile(filePath, Buffer.from(base64, "base64"));
    saved.push({
      id: `${recordId}-${index + 1}`,
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
      form.append("size", size || "1024x1024");
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
        size: size || "1024x1024",
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

async function handleLogin(req, res) {
  const db = await readDb();
  const body = await parseJsonBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const user = db.users.find((candidate) => candidate.username === username);

  if (!user || !verifyPassword(password, user)) {
    return sendError(res, 401, "账号或密码不正确。");
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + sessionTtlMs });

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
  const prompt = String(body.prompt || "").trim();
  const title = String(body.title || "").trim();
  const textBody = String(body.body || "").trim();
  const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)).filter(Boolean).slice(0, 20) : [];
  const files = Array.isArray(body.referenceImages) ? body.referenceImages.slice(0, 4) : [];

  if (!prompt) return sendError(res, 400, "缺少生图参数。");
  if (!title || !textBody || !tags.length) return sendError(res, 400, "缺少标题、正文或标签。");

  const recordId = crypto.randomUUID();
  const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");
  const startedAt = Date.now();
  const mode = files.length ? "image-edit" : "text-to-image";
  console.log(`[generate:start] id=${recordId} user=${user.username} mode=${mode} files=${files.length} model=${imageModel}`);

  try {
    const apiResponse = await callWalaApi({
      prompt,
      files,
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
      throw Object.assign(new Error(message), { statusCode: apiResponse.status });
    }

    const generatedImages = extractGeneratedImages(responsePayload);
    if (!generatedImages.length) {
      throw Object.assign(new Error("生图接口未返回图片。"), { statusCode: 502 });
    }

    const savedImages = await saveGeneratedImages(recordId, generatedImages);
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
      images: [],
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
