-- 回滚 000036：删除逻辑删除字段。
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS deleted;
ALTER TABLE generation_images DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE generation_images DROP COLUMN IF EXISTS deleted;
