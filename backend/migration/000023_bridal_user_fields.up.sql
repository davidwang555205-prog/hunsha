-- bridal 专属认证字段：在 MonkeyCode users 表基础上追加
-- bridal 认证层（biz/bridalauth）用 scrypt + HMAC token，独立于 MonkeyCode 的 bcrypt + cookie session
-- 原 password 字段保留（MonkeyCode team 链路 M4 复用），bridal 认证使用独立的 password_salt/password_hash

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_image_limit int NOT NULL DEFAULT 20 CHECK (daily_image_limit BETWEEN 0 AND 1000);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- username 登录账号名唯一索引（仅非空行）
CREATE UNIQUE INDEX IF NOT EXISTS unique_idx_users_username
    ON users (username)
    WHERE (deleted_at IS NULL AND username IS NOT NULL AND username <> '');
