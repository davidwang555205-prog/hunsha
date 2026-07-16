-- 回滚 bridal V2：异步任务逐张进度 + 积分系统

DROP TABLE IF EXISTS credit_transactions;
DROP INDEX IF EXISTS idx_credit_transactions_user_created;
DROP INDEX IF EXISTS idx_credit_transactions_task;

ALTER TABLE users DROP COLUMN IF EXISTS credits;

ALTER TABLE generation_images DROP COLUMN IF EXISTS latency_ms;
ALTER TABLE generation_images DROP COLUMN IF EXISTS error;
ALTER TABLE generation_images DROP COLUMN IF EXISTS status;

ALTER TABLE generation_tasks DROP COLUMN IF EXISTS completed_at;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS started_at;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS estimated_seconds;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS channel_id;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS category_id;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS completed_count;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS total_count;
