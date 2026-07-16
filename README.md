# Bridal & Dress Content Studio

婚纱、礼服和裙装内容生成工作台。

## 已实现

- 账号密码登录（自定义 HMAC token，24 小时 TTL）
- 管理员查看各账号生图使用情况
- 管理员可在后台修改使用者账号密码、调整每日额度、管理积分
- 新账号默认每日生成图片上限 20 张，管理员不限量
- 上传参考图（1–4 张），**生图参数全部内置**（无需手动选参）
- 服务端代理调用 WalaAPI（GPT Image-2）生图，异步任务 + 进度轮询
- 隐藏生图 Prompt，不在前台展示关键词
- 按配图数量一键生成 3 张或 5 张图片，结果区 skeleton 逐张填充
- 一键下载全部生成图片，也支持逐张下载
- 一键复制标题、正文、标签
- 生图历史记录保存于 PostgreSQL，默认保留 180 天（后台可配）

## V2 UI/UX 重构（2026-07）

- **布局**：左侧菜单栏可折叠（220px/64px + 图标 + localStorage 记忆），统一 BaseLayout 合并主站/后台壳
- **弹窗**：统一 Modal 组件（createPortal 到 body + z-index token），根治 FadeIn 层叠上下文导致的遮挡；StudioPage/用户/线路/类目/引擎/积分弹窗全部 Modal 化
- **StudioPage**：参考图全宽 + 生成结果下移与小红书内容合并 + 补回「内容逻辑」模块（V2 漏渲染的 note）
- **换一版**：随机选「账号+类目+主题+篇次」下未用过的变体（localStorage 去重，用尽轮换）
- **Admin 总览**：当前账号积分余额卡片 + 数据保留可配（system_settings 表 + /api/admin/settings）
- **用户管理**：列表分页 + 搜索 + 积分列点击跳转该用户积分流水（/admin/credits?userId=）
- **模型线路**：加 protocol 字段（openai/预留）+ 弹窗化
- **类目管理**：加 description 简介 + 弹窗化 + engine 下拉从内容引擎 API 拉 + 修前后端 engine 不一致
- **内容引擎配置化（分阶段）**：content_engines 表 + /admin/engines 页面 + 主题覆盖文案后台 JSON 可编辑 + 运行时 setTopicOverrides 覆盖代码默认（带降级，不阻塞生图）；核心算法保留代码
- **积分记录**：join users 显示用户名 + 按用户/类型/时间筛选 + URL 参数预设
- **工具首页**：类目入口卡片重构（图标+名称+简介+悬停动效）
- **配色**：禁用 AI 渐变，统一 token + 模块间 gap-8 留白；修 SpotlightCard overflow 裁剪 HistoryCard 下拉
- **bug 修复**：fittingPrep.promptLine 前后端统一 appointment-card

## 技术栈

- **后端**：Go 1.25 + Echo + ent + viper + samber/do（`backend/`，:8888）
- **前端**：React 19 + Vite + TypeScript + Tailwind（:5173）
- **数据层**：PostgreSQL 16 + Redis + MinIO（Docker，端口仅绑 127.0.0.1）
- **设计**：品牌靛紫 #4334b6 + 粉红辅助，借鉴 react-bits 动效组件

## 环境变量

复制 `.env.example` 为 `.env` 后填真实值（Go 后端与前端共用，`config.go` 的 `applyBridalEnvDefaults` 回退读 Node 命名变量）：

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
APP_SESSION_SECRET=         # 生产必配，缺省回退 admin 密码
```

默认账号在首次启动时写入数据库：

- `admin` / `APP_ADMIN_PASSWORD`，管理员（不限量）
- `wang` / `APP_USER_PASSWORD`，普通账号

单张生图默认最多等待 180 秒，遇上游 429/502/503/504 或负载饱和提示时默认重试 3 次（指数退避）；多图按配图方案逐张调用，首张成功图回传为后续的连续性参考图。

## 本地运行

```bash
# 1. 数据层
docker compose up -d            # PostgreSQL + Redis + MinIO

# 2. 建独立库（Go migration 与 Node schema 不兼容，不能用旧 bridal 库）
docker exec bridal-postgres psql -U bridal -d postgres -c "CREATE DATABASE bridal_go OWNER bridal;"

# 3. 配置 Go 后端
cp backend/config/server/config.yaml.example backend/config/server/config.yaml
#   编辑 config.yaml：database.master 指向 bridal_go、redis.pass 填 compose redis 密码（默认 change_me）

# 4. 启动 Go 后端（:8888）
cd backend && go run ./cmd/server

# 5. 启动前端（:5173，/api 代理到 :8888）
npm install && npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

## 检查

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src/
npm run test        # vitest run
```

## API 说明

服务端读取 `WALA_API_KEY` 后调用 WalaAPI：

- `POST /v1/images/edits`：上传参考图后的图生图 / 图片编辑
- `POST /v1/images/generations`：无参考图时文生图

生图为**异步任务**：前端 `POST /api/v1/generation` 提交任务获取 taskId，每 3s 轮询 `GET /api/v1/generation/tasks/:id` 获取逐张生成进度。前台要求至少上传一张参考图后再生成，符合"上传图片后一键生图"流程。一次生成按配图数量保留 3 张或 5 张结果。

## 遗留代码

Node.js 旧后端已归档到 `archive/legacy-node-backend/`（含 `server/` 与旧部署脚本），不再使用，仅作参考保留。
