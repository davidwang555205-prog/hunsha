-- 生成图缩略图访问路径（生图时生成缩略图对象存储到 OSS，列表/详情页用；历史图空值兜底 imageMogr2 实时/原图）
ALTER TABLE generation_images ADD COLUMN IF NOT EXISTS thumb_url VARCHAR DEFAULT '';
