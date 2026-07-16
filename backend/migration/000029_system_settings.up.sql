-- bridal V2：系统设置（system_settings）
-- 后台可配的运行时配置（key-value），如 retention_days 数据保留天数。
-- 对应 ent schema systemsetting.go。bridalauth.Summary.retentionDays 优先读此表，
-- 缺省回退 config.yaml bridal.history_retention_days。

CREATE TABLE IF NOT EXISTS system_settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings (key);

-- 初始化默认数据保留天数（与 config 默认 180 对齐，可后台改）
INSERT INTO system_settings (key, value) VALUES ('retention_days', '{"days": 180}'::jsonb)
ON CONFLICT (key) DO NOTHING;
