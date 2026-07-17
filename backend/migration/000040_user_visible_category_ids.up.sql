-- 用户类目可见范围：空数组代表全部启用类目，避免升级后影响已有账号。
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS visible_category_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
