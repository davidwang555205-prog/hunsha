DROP INDEX IF EXISTS unique_idx_users_username;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS password_salt;
ALTER TABLE users DROP COLUMN IF EXISTS daily_image_limit;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
ALTER TABLE users DROP COLUMN IF EXISTS username;
