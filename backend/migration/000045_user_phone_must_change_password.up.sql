-- 用户表加手机号（短信验证码注册的账号标识）与初始密码标记（admin 建号首登强制改密）。
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
-- 部分唯一索引：phone 非空时唯一，允许多个 NULL（老 email 用户无手机号，不受约束）。
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users(phone) WHERE phone IS NOT NULL;
