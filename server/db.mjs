// PostgreSQL 数据访问层
// 替代原 db.json 的 readDb/writeDb，所有 users/history 读写经此模块。
import pg from "pg";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "schema.sql");

export const maxDailyImageLimit = 1000;
const defaultDailyImageLimit = (() => {
  const value = Number(process.env.DEFAULT_DAILY_IMAGE_LIMIT || 20);
  return Number.isFinite(value) ? Math.max(0, Math.min(maxDailyImageLimit, Math.floor(value))) : 20;
})();

let pool = null;
function getPool() {
  if (pool) return pool;
  pool = new Pool({
    host: process.env.PG_HOST || "127.0.0.1",
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DB || "bridal",
    user: process.env.PG_USER || "bridal",
    password: process.env.PG_PASSWORD || "change_me",
    max: 10,
    idleTimeoutMillis: 30000
  });
  pool.on("error", (err) => console.error("[pg:error]", err.message));
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export function nowIso() {
  return new Date().toISOString();
}

// ===== 密码（scrypt，与原实现兼容，存量 hash 直接可用）=====
export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

// ===== 用户纯函数 =====
export function normalizeDailyImageLimit(value, fallback = defaultDailyImageLimit) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(0, Math.min(maxDailyImageLimit, Math.floor(limit)));
}

export function hasUnlimitedImageGeneration(user) {
  return user.role === "admin";
}

export function makeUser(id, username, displayName, role, password, dailyImageLimit = defaultDailyImageLimit) {
  const { salt, hash } = hashPassword(password);
  return {
    id,
    username,
    displayName,
    role,
    dailyImageLimit: normalizeDailyImageLimit(dailyImageLimit),
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: nowIso()
  };
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    dailyImageLimit: normalizeDailyImageLimit(user.dailyImageLimit),
    hasUnlimitedImageGeneration: hasUnlimitedImageGeneration(user)
  };
}

// ===== 时区（上海 UTC+8，与原 shanghaiDateKey 一致）=====
export function shanghaiDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ===== schema 初始化 =====
export async function ensureSchema() {
  const sql = readFileSync(schemaPath, "utf8");
  await query(sql);
  await ensureInitialUsers();
}

async function ensureInitialUsers() {
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM users");
  if (rows[0].count > 0) return;
  const admin = makeUser("admin", "admin", "管理员", "admin", process.env.APP_ADMIN_PASSWORD || "admin123");
  const wang = makeUser("wang", "wang", "wang", "user", process.env.APP_USER_PASSWORD || "user123");
  await query(
    `INSERT INTO users (id, username, display_name, role, daily_image_limit, password_salt, password_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8),($9,$10,$11,$12,$13,$14,$15,$16)`,
    [admin.id, admin.username, admin.displayName, admin.role, admin.dailyImageLimit, admin.passwordSalt, admin.passwordHash, admin.createdAt,
     wang.id, wang.username, wang.displayName, wang.role, wang.dailyImageLimit, wang.passwordSalt, wang.passwordHash, wang.createdAt]
  );
  console.log("[db] 初始账号 admin/wang 已创建");
}

// ===== 用户查询 =====
export async function findUserByName(username) {
  const { rows } = await query("SELECT * FROM users WHERE username = $1", [username]);
  return rowToUser(rows[0]);
}

export async function getUserById(id) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
  return rowToUser(rows[0]);
}

export async function createUser(user) {
  await query(
    `INSERT INTO users (id, username, display_name, role, daily_image_limit, password_salt, password_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [user.id, user.username, user.displayName, user.role, user.dailyImageLimit, user.passwordSalt, user.passwordHash, user.createdAt]
  );
}

export async function updateUser(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (fields.dailyImageLimit !== undefined) { sets.push(`daily_image_limit = $${i++}`); vals.push(fields.dailyImageLimit); }
  if (fields.passwordSalt !== undefined) { sets.push(`password_salt = $${i++}`); vals.push(fields.passwordSalt); }
  if (fields.passwordHash !== undefined) { sets.push(`password_hash = $${i++}`); vals.push(fields.passwordHash); }
  if (!sets.length) return;
  vals.push(id);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

export async function listUsers() {
  const { rows } = await query("SELECT * FROM users ORDER BY created_at");
  return rows.map(rowToUser);
}

// ===== history =====
export async function insertHistory(record) {
  await query(
    `INSERT INTO history (id, user_id, username, created_at, status, model, mode, title, body, tags, topic, images, error, prompt_hash, uploaded_image_count, latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [record.id, record.userId, record.username, record.createdAt, record.status, record.model, record.mode,
     record.title, record.body, JSON.stringify(record.tags), record.topic, JSON.stringify(record.images),
     record.error || "", record.promptHash, record.uploadedImageCount, record.latencyMs]
  );
}

export async function listHistoryForUser(userId, role, limit = 100) {
  const sql = role === "admin"
    ? `SELECT * FROM history ORDER BY created_at DESC LIMIT $1`
    : `SELECT * FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`;
  const params = role === "admin" ? [limit] : [userId, limit];
  const { rows } = await query(sql, params);
  return rows.map(rowToHistory);
}

export async function countImagesForDate(userId, dateKey = shanghaiDateKey()) {
  const { rows } = await query("SELECT images, created_at FROM history WHERE user_id = $1", [userId]);
  return rows.reduce((count, r) => {
    const images = parseJsonb(r.images);
    return shanghaiDateKey(r.created_at) === dateKey ? count + (images?.length || 0) : count;
  }, 0);
}

export async function purgeExpiredHistory(retentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await query("DELETE FROM history WHERE created_at < $1", [cutoff]);
}

export async function buildAccountSummaries() {
  const users = await listUsers();
  const { rows } = await query("SELECT * FROM history");
  const todayKey = shanghaiDateKey();
  return users.map((user) => {
    const records = rows
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const successful = records.filter((r) => r.status === "success");
    const imageCount = (list) => list.reduce((c, r) => c + (parseJsonb(r.images)?.length || 0), 0);
    return {
      user: publicUser(user),
      requestCount: records.length,
      successCount: successful.length,
      failedCount: records.length - successful.length,
      generatedImageCount: imageCount(records),
      dailyGeneratedImageCount: imageCount(records.filter((r) => shanghaiDateKey(r.created_at) === todayKey)),
      lastGeneratedAt: records[0]?.created_at || null
    };
  });
}

// ===== 行映射（snake_case -> camelCase）=====
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    dailyImageLimit: row.daily_image_limit,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at
  };
}

function rowToHistory(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    createdAt: row.created_at,
    status: row.status,
    model: row.model,
    mode: row.mode,
    title: row.title,
    body: row.body,
    tags: parseJsonb(row.tags) || [],
    topic: row.topic,
    images: parseJsonb(row.images) || [],
    error: row.error || "",
    promptHash: row.prompt_hash,
    uploadedImageCount: row.uploaded_image_count || 0,
    latencyMs: row.latency_ms || 0
  };
}

function parseJsonb(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value; // pg 对 jsonb 默认返回已解析对象
}
