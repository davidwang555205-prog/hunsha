ALTER TABLE generation_task_xhs_snapshots DROP COLUMN IF EXISTS link_epoch;
ALTER TABLE generation_task_xhs_notes DROP COLUMN IF EXISTS link_epoch;
ALTER TABLE generation_task_xhs_notes DROP COLUMN IF EXISTS next_refresh_at;
