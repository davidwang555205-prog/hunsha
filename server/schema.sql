-- Bridal Content Studio - PostgreSQL schema
-- Node/Go 共用。由 server/db.mjs 的 ensureSchema() 幂等执行。
-- 手动执行：docker compose exec -T postgres psql -U bridal -d bridal < server/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  display_name text,
  role text NOT NULL,
  daily_image_limit int NOT NULL DEFAULT 20,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_history_user_created ON history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);
