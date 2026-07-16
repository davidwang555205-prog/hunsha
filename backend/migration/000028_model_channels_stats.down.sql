-- 回滚模型线路稳定性统计字段
ALTER TABLE model_channels DROP COLUMN IF EXISTS total_requests;
ALTER TABLE model_channels DROP COLUMN IF EXISTS success_requests;
ALTER TABLE model_channels DROP COLUMN IF EXISTS failed_requests;
ALTER TABLE model_channels DROP COLUMN IF EXISTS total_latency_ms;
