# src/api 模块指南

前后端 API 契约层。统一 fetch 封装 + 各业务端点。类型从 `src/types/api.ts`（单一事实源）导入。

## 关键文件

- `client.ts` - 统一请求封装 `apiRequest<T>`
  - token 注入：`setTokenGetter`（AuthContext 启动时注入，避免闭包读旧值）
  - 401 拦截：`setUnauthorizedHandler`（统一登出，避免 4+ 处重复）
  - AbortController + 超时（默认 30s，生图接口显式更长，见 generation.ts）
  - 错误归一化：抛 `ApiError { statusCode, message }`
  - 响应体：识别 team `web.Resp { code, message, data? }`（失败时 `data` 可省略）；8 模块走扁平 JSON，错误体 `{ error: "中文文案" }`
- `auth.ts` - 登录/登出/me
- `generation.ts` - 生图任务（`POST /api/v1/generation`、轮询 `GET /api/v1/generation/tasks/:id`）
- `admin.ts` - 管理端（channels / categories / credits / users / engines）
- `credits.ts` - 积分交易

## 核心约束

- `src/types/api.ts` 是前后端单一事实源，从 Go struct 1:1 推导：
  - `bridalauth/types.go` -> `ApiUser` / `AccountSummary`
  - `generation/usecase.go` -> `GenerateReq` / `SanitizedTask` / `GenerateResp`
  - `generation/prompt/prompt.go` -> `Params`（对应前端 `PromptParams`）
- 改 Go struct 必须同步 `src/types/api.ts`，否则类型漂移。
- client 不直接 import context（避免循环依赖），靠注入回调通信。

## 相关

- token 存取：`src/context/AuthContext.tsx`（localStorage key `bridal-content-studio-session`）
- 后端路由：`backend/biz/generation/handler.go`、`backend/biz/bridalauth/handler.go`
- 类型源：`src/types/api.ts`
