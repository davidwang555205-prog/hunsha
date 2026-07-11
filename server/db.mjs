// PostgreSQL 数据访问层
// 替代原 db.json 的 readDb/writeDb，所有 users/history/credits/channels/categories/tasks 读写经此模块。
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

/** 单事务内执行多条语句（回调传入 client） */
export async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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

// V2 角色体系：super_admin > admin > user。保留 admin 作为旧 token 兼容别名。
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
export function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}
export function isSuperAdminRole(role) {
  return role === "super_admin";
}

export function hasUnlimitedImageGeneration(user) {
  return isAdminRole(user.role);
}

export function makeUser(id, username, displayName, role, password, dailyImageLimit = defaultDailyImageLimit, credits = 0) {
  const { salt, hash } = hashPassword(password);
  return {
    id,
    username,
    displayName,
    role,
    dailyImageLimit: normalizeDailyImageLimit(dailyImageLimit),
    credits: Math.max(0, Math.floor(Number(credits) || 0)),
    isDisabled: false,
    allowedChannels: null,
    lastActiveAt: null,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: nowIso()
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    dailyImageLimit: normalizeDailyImageLimit(user.dailyImageLimit),
    credits: user.credits ?? 0,
    isDisabled: Boolean(user.isDisabled),
    allowedChannels: user.allowedChannels ?? null,
    lastActiveAt: user.lastActiveAt ?? null,
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
  await migrateLegacyRoles();
  await ensureInitialUsers();
  await ensureDefaultChannel();
  await ensureDefaultCategory();
}

// 旧库 admin 升级为 super_admin（V2 角色体系）
async function migrateLegacyRoles() {
  await query("UPDATE users SET role = 'super_admin' WHERE role = 'admin'");
}

async function ensureInitialUsers() {
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM users");
  if (rows[0].count > 0) return;
  const admin = makeUser("admin", "admin", "管理员", "super_admin", process.env.APP_ADMIN_PASSWORD || "admin123", 0);
  const wang = makeUser("wang", "wang", "wang", "user", process.env.APP_USER_PASSWORD || "user123", 100);
  await query(
    `INSERT INTO users (id, username, display_name, role, daily_image_limit, credits, password_salt, password_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9),($10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [admin.id, admin.username, admin.displayName, admin.role, admin.dailyImageLimit, admin.credits, admin.passwordSalt, admin.passwordHash, admin.createdAt,
     wang.id, wang.username, wang.displayName, wang.role, wang.dailyImageLimit, wang.credits, wang.passwordSalt, wang.passwordHash, wang.createdAt]
  );
  console.log("[db] 初始账号 admin/wang 已创建");
}

// 默认模型线路：从现有 .env 的 WalaAPI 配置派生，保证 V1 行为不变
async function ensureDefaultChannel() {
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM model_channels");
  if (rows[0].count > 0) return;
  const id = "wala-gpt-image-2";
  await query(
    `INSERT INTO model_channels (id, name, api_base_url, api_key, model_id, supported_sizes, default_quality, is_enabled, is_default, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true,true,0)`,
    [
      id,
      "WalaAPI GPT Image-2",
      process.env.WALA_API_BASE_URL || "https://walaapi.net/v1",
      process.env.WALA_API_KEY || "",
      "gpt-image-2",
      JSON.stringify(["1152x1536", "1024x1024", "1024x1536", "1536x1024"]),
      "medium"
    ]
  );
  console.log("[db] 默认模型线路 wala-gpt-image-2 已创建");
}

// 默认类目：婚纱-小红书，engine=bridal_fashion（对应现有内容引擎）
async function ensureDefaultCategory() {
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM categories");
  if (rows[0].count > 0) return;
  await query(
    `INSERT INTO categories (id, name, icon, engine, sort_order, is_enabled, config)
     VALUES ($1,$2,$3,$4,0,true,$5)`,
    ["bridal-xiaohongshu", "婚纱-小红书", "👰", "bridal_fashion", JSON.stringify({ defaultSize: "1152x1536" })]
  );
  console.log("[db] 默认类目 婚纱-小红书 已创建");
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
    `INSERT INTO users (id, username, display_name, role, daily_image_limit, credits, is_disabled, allowed_channels, password_salt, password_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      user.id, user.username, user.displayName, user.role, user.dailyImageLimit, user.credits ?? 0,
      Boolean(user.isDisabled), user.allowedChannels ? JSON.stringify(user.allowedChannels) : null,
      user.passwordSalt, user.passwordHash, user.createdAt
    ]
  );
}

export async function updateUser(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  const columnMap = {
    dailyImageLimit: "daily_image_limit",
    credits: "credits",
    role: "role",
    isDisabled: "is_disabled",
    displayName: "display_name",
    passwordSalt: "password_salt",
    passwordHash: "password_hash",
    lastActiveAt: "last_active_at"
  };
  for (const [key, column] of Object.entries(columnMap)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      vals.push(fields[key]);
    }
  }
  if (Object.prototype.hasOwnProperty.call(fields, "allowedChannels")) {
    sets.push(`allowed_channels = $${i++}`);
    vals.push(fields.allowedChannels ? JSON.stringify(fields.allowedChannels) : null);
  }
  if (!sets.length) return;
  sets.push(`updated_at = now()`);
  vals.push(id);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

export async function deleteUser(id) {
  await query("DELETE FROM users WHERE id = $1", [id]);
}

export async function listUsers() {
  const { rows } = await query("SELECT * FROM users ORDER BY created_at");
  return rows.map(rowToUser);
}

/** 更新最后活跃时间（登录/请求时调用，限频避免每次写库） */
export async function touchUserActiveAt(userId) {
  await query("UPDATE users SET last_active_at = now() WHERE id = $1", [userId]);
}

// ===== 积分（事务安全）=====
/**
 * 消费积分：成功 1 张扣 1。
 * 事务内 SELECT ... FOR UPDATE 锁行，余额不足抛错（余额不变）。
 * 返回扣减后的新余额。
 */
export async function consumeCredits(userId, amount, description, relatedTaskId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT credits FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!rows.length) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
    const current = Number(rows[0].credits) || 0;
    const next = current - amount;
    if (next < 0) {
      throw Object.assign(new Error("积分余额不足。"), { statusCode: 402 });
    }
    await client.query("UPDATE users SET credits = $1 WHERE id = $2", [next, userId]);
    const txId = crypto.randomUUID();
    await client.query(
      `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, related_task_id, created_at)
       VALUES ($1,$2,'consume',$3,$4,$5,$6,now())`,
      [txId, userId, -amount, next, description || "生图消费", relatedTaskId || null]
    );
    return next;
  });
}

/** 充值/调整积分（admin 手动），amount 正负均可 */
export async function adjustCredits(userId, amount, type, description, operatorId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT credits FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!rows.length) throw Object.assign(new Error("用户不存在。"), { statusCode: 404 });
    const current = Number(rows[0].credits) || 0;
    const next = current + amount;
    if (next < 0) {
      throw Object.assign(new Error("调整后积分不能为负。"), { statusCode: 400 });
    }
    await client.query("UPDATE users SET credits = $1 WHERE id = $2", [next, userId]);
    const txId = crypto.randomUUID();
    await client.query(
      `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [txId, userId, type || "adjust", amount, next, description || (operatorId ? `管理员 ${operatorId} 调整` : "积分调整")]
    );
    return next;
  });
}

export async function listCreditTransactions(userId, limit = 50, offset = 0) {
  const { rows } = await query(
    "SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset]
  );
  return rows.map(rowToCreditTx);
}

// ===== history =====
export async function insertHistory(record) {
  await query(
    `INSERT INTO history (id, user_id, username, created_at, status, model, mode, title, body, tags, topic, images, error, prompt_hash, uploaded_image_count, latency_ms, channel_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [record.id, record.userId, record.username, record.createdAt, record.status, record.model, record.mode,
     record.title, record.body, JSON.stringify(record.tags), record.topic, JSON.stringify(record.images),
     record.error || "", record.promptHash, record.uploadedImageCount, record.latencyMs, record.channelId || null]
  );
}

export async function listHistoryForUser(userId, role, limit = 100) {
  const sql = isAdminRole(role)
    ? `SELECT * FROM history ORDER BY created_at DESC LIMIT $1`
    : `SELECT * FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`;
  const params = isAdminRole(role) ? [limit] : [userId, limit];
  const { rows } = await query(sql, params);
  return rows.map(rowToHistory);
}

/**
 * 分页查询历史（V2）。
 * @param {object} opts - { userId, role, page, pageSize, status, startDate, endDate, q }
 * @returns {Promise<{ items, total, page, pageSize }>}
 */
export async function queryHistoryPaged(opts) {
  const { userId, role, page = 1, pageSize = 20, status, startDate, endDate, q } = opts;
  const conditions = [];
  const params = [];
  let i = 1;

  if (!isAdminRole(role)) {
    conditions.push(`user_id = $${i++}`);
    params.push(userId);
  }
  if (status) {
    conditions.push(`status = $${i++}`);
    params.push(status);
  }
  if (startDate) {
    conditions.push(`created_at >= $${i++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`created_at < $${i++}`);
    params.push(endDate);
  }
  if (q) {
    conditions.push(`(title ILIKE $${i++} OR body ILIKE $${i++} OR tags::text ILIKE $${i++})`);
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));
  const offset = (safePage - 1) * safeSize;

  const countSql = `SELECT COUNT(*)::int AS total FROM history ${where}`;
  const { rows: countRows } = await query(countSql, params);
  const total = countRows[0]?.total || 0;

  const listSql = `SELECT * FROM history ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
  const { rows } = await query(listSql, [...params, safeSize, offset]);
  return { items: rows.map(rowToHistory), total, page: safePage, pageSize: safeSize };
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
      lastGeneratedAt: records[0]?.created_at || null,
      credits: user.credits ?? 0,
      lastActiveAt: user.lastActiveAt ?? null
    };
  });
}

// ===== 模型线路 =====
export async function listChannels() {
  const { rows } = await query("SELECT * FROM model_channels ORDER BY sort_order, created_at");
  return rows.map(rowToChannel);
}

export async function getChannel(id) {
  const { rows } = await query("SELECT * FROM model_channels WHERE id = $1", [id]);
  return rowToChannel(rows[0]);
}

export async function getDefaultChannel() {
  const { rows } = await query("SELECT * FROM model_channels WHERE is_default = true LIMIT 1");
  if (rows.length) return rowToChannel(rows[0]);
  const { rows: fallback } = await query("SELECT * FROM model_channels WHERE is_enabled = true ORDER BY sort_order LIMIT 1");
  return rowToChannel(fallback[0]);
}

export async function createChannel(channel) {
  await query(
    `INSERT INTO model_channels (id, name, api_base_url, api_key, model_id, supported_sizes, default_quality, is_enabled, is_default, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      channel.id, channel.name, channel.apiBaseUrl, channel.apiKey, channel.modelId,
      JSON.stringify(channel.supportedSizes || []), channel.defaultQuality || "medium",
      channel.isEnabled !== false, channel.isDefault === true, channel.sortOrder || 0
    ]
  );
  if (channel.isDefault) await setDefaultChannel(channel.id);
  return getChannel(channel.id);
}

export async function updateChannel(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  const map = {
    name: "name",
    apiBaseUrl: "api_base_url",
    apiKey: "api_key",
    modelId: "model_id",
    defaultQuality: "default_quality",
    isEnabled: "is_enabled",
    sortOrder: "sort_order"
  };
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      vals.push(fields[key]);
    }
  }
  if (fields.supportedSizes !== undefined) {
    sets.push(`supported_sizes = $${i++}`);
    vals.push(JSON.stringify(fields.supportedSizes));
  }
  if (!sets.length) return getChannel(id);
  sets.push(`updated_at = now()`);
  vals.push(id);
  await query(`UPDATE model_channels SET ${sets.join(", ")} WHERE id = $${i}`, vals);
  if (fields.isDefault === true) await setDefaultChannel(id);
  return getChannel(id);
}

export async function deleteChannel(id) {
  // 设为默认的线路不可删除
  const ch = await getChannel(id);
  if (ch?.isDefault) throw Object.assign(new Error("默认线路不可删除，请先切换默认线路。"), { statusCode: 400 });
  await query("DELETE FROM model_channels WHERE id = $1", [id]);
}

export async function setDefaultChannel(id) {
  await withTransaction(async (client) => {
    await client.query("UPDATE model_channels SET is_default = false");
    await client.query("UPDATE model_channels SET is_default = true, updated_at = now() WHERE id = $1", [id]);
  });
}

/** 用户可选线路（受 allowed_channels 限制），含统计 */
export async function listChannelsForUser(user) {
  const all = await listChannels();
  const enabled = all.filter((c) => c.isEnabled);
  const allowed = user.allowedChannels?.length ? enabled.filter((c) => user.allowedChannels.includes(c.id)) : enabled;
  const stats = await getChannelStats();
  return allowed.map((c) => ({ ...c, stats: stats[c.id] || null }));
}

/** 线路统计：成功率/平均耗时/调用次数（从 history 聚合） */
export async function getChannelStats() {
  const { rows } = await query(
    `SELECT channel_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'success')::int AS success,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
            COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
     FROM history
     WHERE channel_id IS NOT NULL
     GROUP BY channel_id`
  );
  const map = {};
  for (const r of rows) {
    const total = r.total || 0;
    const success = r.success || 0;
    map[r.channel_id] = {
      totalRequests: total,
      successRequests: success,
      failedRequests: r.failed || 0,
      successRate: total ? Math.round((success / total) * 1000) / 10 : 0,
      avgLatencyMs: r.avg_latency_ms || 0
    };
  }
  return map;
}

// ===== 类目 =====
export async function listCategories(enabledOnly = false) {
  const sql = enabledOnly
    ? "SELECT * FROM categories WHERE is_enabled = true ORDER BY sort_order, created_at"
    : "SELECT * FROM categories ORDER BY sort_order, created_at";
  const { rows } = await query(sql);
  return rows.map(rowToCategory);
}

export async function getCategory(id) {
  const { rows } = await query("SELECT * FROM categories WHERE id = $1", [id]);
  return rowToCategory(rows[0]);
}

export async function createCategory(category) {
  await query(
    `INSERT INTO categories (id, name, icon, engine, sort_order, is_enabled, config)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      category.id, category.name, category.icon || null, category.engine,
      category.sortOrder || 0, category.isEnabled !== false, JSON.stringify(category.config || {})
    ]
  );
  return getCategory(category.id);
}

export async function updateCategory(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  const map = { name: "name", icon: "icon", engine: "engine", sortOrder: "sort_order", isEnabled: "is_enabled" };
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      vals.push(fields[key]);
    }
  }
  if (fields.config !== undefined) {
    sets.push(`config = $${i++}`);
    vals.push(JSON.stringify(fields.config));
  }
  if (!sets.length) return getCategory(id);
  sets.push(`updated_at = now()`);
  vals.push(id);
  await query(`UPDATE categories SET ${sets.join(", ")} WHERE id = $${i}`, vals);
  return getCategory(id);
}

export async function deleteCategory(id) {
  await query("DELETE FROM categories WHERE id = $1", [id]);
}

// ===== 异步生图任务 =====
export async function insertTask(task) {
  await query(
    `INSERT INTO generation_tasks
     (id, user_id, category_id, channel_id, status, title, body, tags, topic, prompt_params_list, reference_images, result_images, sub_task_status, error, total_count, completed_count, estimated_seconds, created_at, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      task.id, task.userId, task.categoryId || null, task.channelId || null, task.status || "queued",
      task.title || null, task.body || null, JSON.stringify(task.tags || []), task.topic || null,
      JSON.stringify(task.promptParamsList || []), JSON.stringify(task.referenceImages || []),
      JSON.stringify(task.resultImages || []), JSON.stringify(task.subTaskStatus || []),
      task.error || null, task.totalCount || 0, task.completedCount || 0, task.estimatedSeconds || null,
      task.createdAt || nowIso(), task.startedAt || null, task.completedAt || null
    ]
  );
}

export async function updateTask(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  const map = {
    status: "status",
    channelId: "channel_id",
    error: "error",
    totalCount: "total_count",
    completedCount: "completed_count",
    estimatedSeconds: "estimated_seconds",
    startedAt: "started_at",
    completedAt: "completed_at"
  };
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      vals.push(fields[key]);
    }
  }
  if (fields.resultImages !== undefined) {
    sets.push(`result_images = $${i++}`);
    vals.push(JSON.stringify(fields.resultImages));
  }
  if (fields.subTaskStatus !== undefined) {
    sets.push(`sub_task_status = $${i++}`);
    vals.push(JSON.stringify(fields.subTaskStatus));
  }
  if (!sets.length) return;
  vals.push(id);
  await query(`UPDATE generation_tasks SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

export async function getTask(id) {
  const { rows } = await query("SELECT * FROM generation_tasks WHERE id = $1", [id]);
  return rowToTask(rows[0]);
}

export async function listTasks(userId, role, page = 1, pageSize = 20, status) {
  const conditions = [];
  const params = [];
  let i = 1;
  if (!isAdminRole(role)) {
    conditions.push(`user_id = $${i++}`);
    params.push(userId);
  }
  if (status) {
    conditions.push(`status = $${i++}`);
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));
  const offset = (safePage - 1) * safeSize;
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM generation_tasks ${where}`, params);
  const total = countRows[0]?.total || 0;
  const { rows } = await query(
    `SELECT * FROM generation_tasks ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, safeSize, offset]
  );
  return { items: rows.map(rowToTask), total, page: safePage, pageSize: safeSize };
}

/** 用户进行中任务数（限流：避免堆积） */
export async function countActiveTasks(userId) {
  const { rows } = await query(
    "SELECT COUNT(*)::int AS total FROM generation_tasks WHERE user_id = $1 AND status IN ('queued','processing')",
    [userId]
  );
  return rows[0]?.total || 0;
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
    credits: row.credits ?? 0,
    isDisabled: row.is_disabled ?? false,
    allowedChannels: parseJsonb(row.allowed_channels) ?? null,
    lastActiveAt: row.last_active_at ?? null,
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
    latencyMs: row.latency_ms || 0,
    channelId: row.channel_id || null
  };
}

function rowToChannel(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    apiBaseUrl: row.api_base_url,
    apiKey: row.api_key,
    modelId: row.model_id,
    supportedSizes: parseJsonb(row.supported_sizes) || [],
    defaultQuality: row.default_quality || "medium",
    isEnabled: row.is_enabled ?? true,
    isDefault: row.is_default ?? false,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToCreditTx(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    description: row.description || "",
    relatedTaskId: row.related_task_id || null,
    createdAt: row.created_at
  };
}

function rowToCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || "",
    engine: row.engine,
    sortOrder: row.sort_order || 0,
    isEnabled: row.is_enabled ?? true,
    config: parseJsonb(row.config) || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id || null,
    channelId: row.channel_id || null,
    status: row.status,
    title: row.title || "",
    body: row.body || "",
    tags: parseJsonb(row.tags) || [],
    topic: row.topic || "",
    promptParamsList: parseJsonb(row.prompt_params_list) || [],
    referenceImages: parseJsonb(row.reference_images) || [],
    resultImages: parseJsonb(row.result_images) || [],
    subTaskStatus: parseJsonb(row.sub_task_status) || [],
    error: row.error || "",
    totalCount: row.total_count || 0,
    completedCount: row.completed_count || 0,
    estimatedSeconds: row.estimated_seconds || null,
    createdAt: row.created_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null
  };
}

function parseJsonb(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value; // pg 对 jsonb 默认返回已解析对象
}
