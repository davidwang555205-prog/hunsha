-- bridal 生图历史表（对应 Node history 表，Go 用独立表 generation_tasks/generation_images）
-- 与 Node 的 history 表分离：Go 阶段不直接复用 Node history 表，数据迁移留 M4/M5。

CREATE TABLE IF NOT EXISTS generation_tasks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    user_id uuid NOT NULL,
    username character varying DEFAULT '',
    status character varying DEFAULT '',
    model character varying DEFAULT '',
    mode character varying DEFAULT '',
    title text DEFAULT '',
    body text DEFAULT '',
    tags jsonb DEFAULT '[]'::jsonb,
    topic text DEFAULT '',
    error text DEFAULT '',
    prompt_hash character varying DEFAULT '',
    uploaded_image_count int DEFAULT 0,
    latency_ms int DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_created ON generation_tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_created ON generation_tasks (created_at DESC);

CREATE TABLE IF NOT EXISTS generation_images (
    id character varying PRIMARY KEY,
    task_id uuid NOT NULL,
    name text DEFAULT '',
    url text DEFAULT '',
    download_url text DEFAULT '',
    source character varying DEFAULT 'local',
    image_number int DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generation_images_task ON generation_images (task_id);
