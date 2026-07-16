-- bridal V2：模型线路加 protocol 字段（调用协议：openai 兼容，预留扩展）
ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS protocol text NOT NULL DEFAULT 'openai';
