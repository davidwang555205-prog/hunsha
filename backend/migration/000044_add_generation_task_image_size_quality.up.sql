-- 单张重试需恢复原任务生图尺寸/质量，保证补图与已成功图尺寸一致。
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS image_size VARCHAR DEFAULT '';
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS image_quality VARCHAR DEFAULT '';
