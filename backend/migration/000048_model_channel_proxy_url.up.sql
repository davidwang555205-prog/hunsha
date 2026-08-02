-- bridal：模型线路前向代理（model_channels.proxy_url）
-- 指定线路的生图请求与生成图回源下载走该代理（如被墙上游 image2）；空 = 直连，其余线路/业务不受影响。
ALTER TABLE model_channels ADD COLUMN IF NOT EXISTS proxy_url character varying(512) NOT NULL DEFAULT '';
