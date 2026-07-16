-- bridal V3：模型线路稳定性统计（model_channels 累计字段）
-- runTask 每张图调用 wala 后原子累加，admin 列表展示成功率/平均耗时判断稳定性。
-- 对应 ent schema modelchannel.go 新增 4 个统计字段。

ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS total_requests integer NOT NULL DEFAULT 0;
ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS success_requests integer NOT NULL DEFAULT 0;
ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS failed_requests integer NOT NULL DEFAULT 0;
ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS total_latency_ms integer NOT NULL DEFAULT 0;
