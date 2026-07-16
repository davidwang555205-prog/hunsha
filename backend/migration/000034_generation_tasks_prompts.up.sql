-- 000034: generation_tasks 加 prompts 字段（每张图给大模型的英文提示词，管理员复盘用）。
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS prompts jsonb;
