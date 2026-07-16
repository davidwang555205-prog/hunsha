-- 000036: 历史逻辑删除字段（定时清理过期历史时标记 deleted=true，对象存储 MinIO 文件保留）。
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE generation_images ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE generation_images ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
