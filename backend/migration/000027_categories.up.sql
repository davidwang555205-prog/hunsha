-- bridal V2：内容类目管理（categories）
-- 按产品类目组织工具首页（目前仅婚纱类，engine=bridal）。
-- 对应 ent schema category.go，前端 Category 类型（src/types/api.ts）。

CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    name text NOT NULL DEFAULT '',
    icon text NOT NULL DEFAULT '',
    engine text NOT NULL DEFAULT 'bridal',
    sort_order int NOT NULL DEFAULT 0,
    is_enabled boolean NOT NULL DEFAULT true,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_enabled_sort ON categories (is_enabled, sort_order);
