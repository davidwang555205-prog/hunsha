-- 小红书笔记数据采集改为后台自动调度（立即首次 + 1/7/15 天节奏持续）：
-- tracking 加 next_refresh_at（后台调度依据，NULL=历史数据不再自动采）+ link_epoch（链接版本号，区分改链接前后快照）；
-- snapshot 加 link_epoch 与 tracking 对齐，旧快照保留入库、前端按当前 epoch 展示。
ALTER TABLE generation_task_xhs_notes ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMPTZ;
ALTER TABLE generation_task_xhs_notes ADD COLUMN IF NOT EXISTS link_epoch INT NOT NULL DEFAULT 1;
ALTER TABLE generation_task_xhs_snapshots ADD COLUMN IF NOT EXISTS link_epoch INT NOT NULL DEFAULT 1;
