-- bridal V2：类目加 description 字段（类目简介，首页卡片展示）
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
