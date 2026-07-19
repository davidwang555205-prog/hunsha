-- 每条生图线路独立控制单次上游请求超时；0 时兼容使用全局 bridal.wala_image_timeout_ms。
ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS request_timeout_ms INTEGER NOT NULL DEFAULT 0;
