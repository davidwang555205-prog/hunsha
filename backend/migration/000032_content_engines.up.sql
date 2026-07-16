-- bridal V2：内容引擎配置（content_engines）
-- 后台可配的内容引擎（key/name/description/config）。config 存可编辑素材（如主题覆盖文案）。
-- categories.engine 引用 content_engines.key。运行时拉 config 覆盖代码默认素材（带降级）。
-- 对应 ent schema contentengine.go。

CREATE TABLE IF NOT EXISTS content_engines (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    key text NOT NULL UNIQUE,
    name text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_enabled boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_engines_enabled_sort ON content_engines (is_enabled, sort_order);

-- 初始化默认婚纱内容引擎（config 空，运行时降级用代码默认素材）
INSERT INTO content_engines (key, name, description, config) VALUES
  ('bridal', '婚纱礼服内容引擎', '婚纱礼服行业小红书内容生成，覆盖试纱、客照、门店等场景。', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
