-- 000035: generation_tasks 加 feedback 字段（小红书发布反馈：笔记链接 + 阅读/点赞/收藏/评论）。
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS feedback jsonb;
