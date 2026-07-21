-- bridal：客服信息表（customer_service_infos）
-- 管理后台系统配置维护客服名片（昵称/电话/微信号/二维码），用户端顶栏客服入口展示生效客服。
CREATE TABLE IF NOT EXISTS customer_service_infos (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v1(),
    nickname text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    wechat_id text NOT NULL DEFAULT '',
    qrcode_url text NOT NULL DEFAULT '',
    sort_order int NOT NULL DEFAULT 0,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_service_infos_enabled_sort
    ON customer_service_infos (is_enabled, sort_order);
