-- Bridal Content Studio - PostgreSQL schema (V2)
-- Node 后端专用。由 server/db.mjs 的 ensureSchema() 幂等执行。
-- 手动执行：docker compose exec -T postgres psql -U bridal -d bridal < server/schema.sql

-- ============================================================
-- users：基础账号表（V1 既有，V2 增列）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  display_name text,
  role text NOT NULL,                       -- super_admin / admin / user
  daily_image_limit int NOT NULL DEFAULT 20, -- 兼容保留，主要用积分控制
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- V2 新增列（IF NOT EXISTS 保证幂等）
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_channels jsonb; -- null = 全部可用
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- ============================================================
-- history：生图历史（V1 既有，V2 增 channel_id）
-- ============================================================
CREATE TABLE IF NOT EXISTS history (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text,
  model text,
  mode text,
  title text,
  body text,
  tags jsonb,
  topic text,
  images jsonb,
  error text,
  prompt_hash text,
  uploaded_image_count int,
  latency_ms int
);

ALTER TABLE history ADD COLUMN IF NOT EXISTS channel_id text;

CREATE INDEX IF NOT EXISTS idx_history_user_created ON history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);

-- ============================================================
-- model_channels：模型线路配置（V2 新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS model_channels (
  id text PRIMARY KEY,
  name text NOT NULL,                       -- "WalaAPI GPT Image-2"
  api_base_url text NOT NULL,
  api_key text NOT NULL,
  model_id text NOT NULL,                   -- "gpt-image-2"
  supported_sizes jsonb,                    -- ["1152x1536", "1024x1024"]
  default_quality text NOT NULL DEFAULT 'medium',
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- credit_transactions：积分变动记录（V2 新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  type text NOT NULL,                       -- recharge / consume / adjust
  amount int NOT NULL,                      -- 正=充值/调整，负=消费
  balance_after int NOT NULL,
  description text,
  related_task_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);

-- ============================================================
-- categories：内容类目（V2 新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL,                       -- "婚纱-小红书"
  icon text,
  engine text NOT NULL,                     -- "bridal_fashion"（对应现有引擎）
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb,                             -- 类目特有配置（提示词模板等）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- generation_tasks：异步生图任务（V2 新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_tasks (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  category_id text,
  channel_id text,                          -- 使用的模型线路
  status text NOT NULL DEFAULT 'queued',    -- queued / processing / completed / failed / cancelled
  title text,
  body text,
  tags jsonb,
  topic text,
  prompt_params_list jsonb,
  reference_images jsonb,
  result_images jsonb,                      -- 生成结果
  sub_task_status jsonb,                    -- [{index, status, image, error, latencyMs}]
  error text,
  total_count int NOT NULL DEFAULT 0,
  completed_count int NOT NULL DEFAULT 0,
  estimated_seconds int,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON generation_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON generation_tasks(status);

-- ============================================================
-- channel_stats：模型线路日维度统计（V2 新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS channel_stats (
  channel_id text NOT NULL,
  date_key text NOT NULL,
  total_requests int NOT NULL DEFAULT 0,
  success_requests int NOT NULL DEFAULT 0,
  failed_requests int NOT NULL DEFAULT 0,
  total_latency_ms int NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, date_key)
);
