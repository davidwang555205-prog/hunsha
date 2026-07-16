-- bridal V2：模型线路管理（channels）
-- 管理后台配 WalaAPI 线路，生图按 channel 配置调用（apiBaseUrl/apiKey/modelId）。
-- 对应 ent schema modelchannel.go，前端 Channel 类型（src/types/api.ts）。

CREATE TABLE IF NOT EXISTS model_channels (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    name text NOT NULL DEFAULT '',
    api_base_url text NOT NULL DEFAULT '',
    api_key text NOT NULL DEFAULT '',
    model_id text NOT NULL DEFAULT 'gpt-image-2',
    supported_sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
    default_quality text NOT NULL DEFAULT 'medium',
    is_enabled boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_channels_enabled_sort ON model_channels (is_enabled, sort_order);
