-- bridal V2：异步任务逐张进度 + 积分系统
-- 1. generation_tasks 加异步任务字段（worker 逐张进度，sub_task_status 由 generation_images 派生）
-- 2. generation_images 加逐张状态字段
-- 3. users 加积分余额字段
-- 4. 新建 credit_transactions 积分变动记录表

-- 1. generation_tasks 加异步任务字段
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS total_count int NOT NULL DEFAULT 0;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS completed_count int NOT NULL DEFAULT 0;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS channel_id uuid;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS estimated_seconds int NOT NULL DEFAULT 0;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 2. generation_images 加逐张状态字段
ALTER TABLE generation_images ADD COLUMN IF NOT EXISTS status character varying NOT NULL DEFAULT 'pending';
ALTER TABLE generation_images ADD COLUMN IF NOT EXISTS error text NOT NULL DEFAULT '';
ALTER TABLE generation_images ADD COLUMN IF NOT EXISTS latency_ms int NOT NULL DEFAULT 0;

-- 3. users 加积分余额字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits int NOT NULL DEFAULT 0;

-- 4. 积分变动记录表
CREATE TABLE IF NOT EXISTS credit_transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    user_id uuid NOT NULL,
    type character varying NOT NULL DEFAULT 'consume',
    amount int NOT NULL DEFAULT 0,
    balance_after int NOT NULL DEFAULT 0,
    description text NOT NULL DEFAULT '',
    related_task_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_task ON credit_transactions (related_task_id) WHERE related_task_id IS NOT NULL;
