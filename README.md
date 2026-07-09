# Bridal & Dress Content Studio

婚纱、礼服和裙装内容生成工作台。

## 已实现

- 账号密码登录
- 管理员查看各账号生图使用情况
- 管理员可在后台修改使用者账号密码
- 新账号默认每日生成图片上限 20 张，管理员可在后台调整
- 上传参考图
- 服务端代理调用 WalaAPI 生图接口
- 隐藏生图 Prompt，不在前台展示关键词
- 按前台“配图数量”一键生成 3 张或 5 张图片
- 一键下载全部生成图片，也支持逐张下载
- 一键复制标题、正文、标签
- 生图历史记录本地保存，默认 180 天，并保留每次生成的全部图片

## 环境变量

复制 `.env.example` 后配置真实值，完整 API Key 不要提交到仓库。

```bash
WALA_API_KEY=replace_with_walaapi_key
WALA_API_BASE_URL=https://walaapi.net/v1
WALA_IMAGE_MODEL=gpt-image-2
WALA_IMAGE_QUALITY=medium
APP_ADMIN_PASSWORD=admin123
APP_USER_PASSWORD=user123
DEFAULT_DAILY_IMAGE_LIMIT=20
HISTORY_RETENTION_DAYS=180
WALA_IMAGE_TIMEOUT_MS=180000
WALA_IMAGE_RETRY_ATTEMPTS=3
PORT=8787
```

默认账号在首次启动服务时写入本地数据库：

- `admin` / `APP_ADMIN_PASSWORD`，管理员
- `wang` / `APP_USER_PASSWORD`，普通账号

运行后数据保存在 `server/data/`，该目录已加入 `.gitignore`。
单张生图请求默认最多等待 180 秒，遇到上游 429/502/503/504 或负载饱和提示时默认重试 3 次；多图生成会按配图方案逐张调用。

## 本地运行

```bash
npm install
npm run build
npm run start
```

打开：

```text
http://127.0.0.1:8787/
```

## 检查

```bash
npm run typecheck
npm run build
```

## API 说明

服务端读取 `WALA_API_KEY` 后调用：

- `POST /v1/images/edits`：上传参考图后的图生图 / 图片编辑
- `POST /v1/images/generations`：无参考图时文生图

当前前台要求至少上传一张参考图后再生成，符合客户“上传图片后一键生图”的流程。一次生成会按选择的配图数量保留 3 张或 5 张结果。
