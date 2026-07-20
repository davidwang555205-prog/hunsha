# 开发计划：个人中心 & 登录安全加固

> 创建时间：2026-07-20
> 分支：`dev-dao`
> 背景：code review 发现 team 登录 captcha 与发码逻辑矛盾；用户要求新增个人中心页面及信息管理功能。

---

## 任务总览

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 1 | 修复 team 登录 captcha 与发码逻辑矛盾 | ✅ 已完成 | 后端 + 前端均完成，lint/typecheck 通过 |
| 2 | 新增个人中心页面 `/profile` | ✅ 已完成 | 积分余额+消耗明细复用 credits API；Admin 入口/退出登录已迁入 |
| 3 | 信息管理：修改昵称 + 修改头像 | ✅ 已完成 | ProfilePage 内行内编辑；上传头像走 `/api/v1/uploader` |
| 4 | 信息管理：修改密码 | ✅ 已完成 | 链接复用已有 `/change-password` 页面 |
| 5 | 信息管理：变更邮箱 | ✅ 已完成 | 新增 `/profile/email` 页面；复用 `/api/v1/users/email/bind-request` |
| 6 | 信息管理：变更手机号 | ✅ 已完成 | **新增后端 `change_phone` 场景** + 新增 `/profile/phone` 页面 |

**总体进度：6/6 完成，lint + typecheck 通过。**

---

## 任务 #1：修复 team 登录 captcha 与发码逻辑矛盾 🟢

### 问题

`backend/biz/team/handler/http/v1/user.go` 中 `Login` 方法原来跳过了空 captcha_token：

```go
// 旧逻辑（有 bug）
if req.CaptchaToken != "" && !h.captcha.ValidateToken(ctx, req.CaptchaToken) {
    return errcode.ErrForbidden
}
```

但 `SendVerificationCode` 的逻辑是：`dev` 跳过、`prod` 强制校验。二者不一致导致 prod 环境登录可绕过人机验证。

### 修复

**后端** — `backend/biz/team/handler/http/v1/user.go`：

```go
// 新逻辑：与发码保持一致
if !h.config.Debug && !h.captcha.ValidateToken(ctx, req.CaptchaToken) {
    return errcode.ErrForbidden
}
```

**前端** — 两处改动：

- `src/context/AuthContext.tsx`：`login` 签名增加可选 `captchaToken?: string` 参数，透传至 `LoginRequest.captcha_token`
- `src/pages/LoginPage.tsx`：新增 `CaptchaWidget` 组件，提交前校验 captcha 已通过；账号变更时清空已通过的人机验证

> `LoginRequest.captcha_token` 字段早已在 `src/types/api.ts` 中存在，无需新增。

---

## 任务 #2：新增个人中心页面 `/profile` 🟢

### 路由

`/profile` — `RequireAuth` + `LazyPage`，无侧边栏（与 `/change-password` 模式一致）。

### 页面结构 (`src/pages/ProfilePage.tsx`)

- **顶部**：大号头像（可点击触发文件选择器）、昵称（行内编辑）、用户名、角色标签
- **账户信息卡**：手机号 + 邮箱，各带"变更"链接跳转对应子页
- **积分面板**：余额 + 消耗明细列表（复用 `listCreditTransactions`，展示全部记录）
- **安全与账户**：修改密码（链接 `/change-password`）、变更邮箱（`/profile/email`）、变更手机号（`/profile/phone`）、Admin 入口、退出登录

### 头像菜单改造 (`src/components/layout/AppHeader.tsx`)

- 头像按钮改为导航至 `/profile`（原下拉菜单已删除，Admin 入口+退出登录迁入 ProfilePage）
- 显示用户真实头像（`user.avatar_url || logo`）

---

## 任务 #3：信息管理：修改昵称 + 修改头像 🟢

### 后端

已有接口，无需改动：
- `PUT /api/v1/users` — 接收 `multipart/form-data`（`name` + `avatar_url`）
- `POST /api/v1/uploader` — 接收 `FormData`（`usage=avatar` + `file`），返回 `/api/v1/assets?key=...`

### 前端 (`src/pages/ProfilePage.tsx`)

- **昵称**：行内编辑模式。点击"修改昵称"→ 输入框 + 保存/取消。保存调用 `updateCurrentUser({ name })` → `refreshUser(updated)`
- **头像**：点击头像打开文件选择器 → 前端校验（image/*、≤5MB）→ `uploadAvatar(file)` 得 URL → `updateCurrentUser({ avatar_url: url })` → `refreshUser(updated)`

### 新增 API client (`src/api/users.ts`)

```ts
updateCurrentUser(req: UpdateCurrentUserRequest) → PUT /api/v1/users  (multipart/form-data)
uploadAvatar(file: File)                    → POST /api/v1/uploader  (usage=avatar)
```

---

## 任务 #4：信息管理：修改密码 🟢

直接复用已有页面 `/change-password`（`src/pages/ChangePasswordPage.tsx`）。

ProfilePage 通过 `<Link to="/change-password">修改密码</Link>` 跳转。

---

## 任务 #5：信息管理：变更邮箱 🟢

### 后端

已有接口，无需改动：
- `PUT /api/v1/users/email/bind-request` — 接收 `{ email }`，发验证邮件（含链接）
- `GET /api/v1/users/email/verify?token=...` — 邮箱内点链接完成验证，回跳应用

### 前端 (`src/pages/ChangeEmailPage.tsx`)

- 路由 `/profile/email`
- 输入新邮箱 → 校验格式 + 不与当前邮箱相同 → 调 `sendBindEmailVerification({ email })`
- 成功后展示"验证邮件已发送，请查收"，引导用户返回个人中心

### 新增 API client

```ts
// src/api/auth.ts
sendBindEmailVerification(req: { email: string }) → PUT /api/v1/users/email/bind-request
```

> 该接口不要求 captcha（后端 `SendBindEmailVerification` handler 不做 captcha 校验）。

---

## 任务 #6：信息管理：变更手机号 🟢

### 后端变更（最大改动量）

| 层 | 文件 | 改动 |
|----|------|------|
| Scene 常量 | `pkg/sms/code.go` | 新增 `SceneChangePhone Scene = "change_phone"`，加入 `Valid()` |
| Scene 常量 | `pkg/verify/channel.go` | 同上（独立包） |
| 领域接口 | `domain/user.go` | `UserUsecase` 新增 `ChangePhoneByCode`；`UserRepo` 新增 `SetPhone`；新增 `ChangePhoneByCodeReq` 结构体 |
| 仓储实现 | `biz/user/repo/user.go` | 实现 `SetPhone`（`UpdateOneID().SetPhone()`） |
| 用例层 | `biz/user/usecase/user.go` | 实现 `ChangePhoneByCode`（验证码校验 → 新号占用查重 → 更新手机号）；`precheckVerificationTarget` 新增 `SceneChangePhone` 分支 |
| 接口层 | `biz/user/handler/v1/auth.go` | 新增 `ChangePhone` handler + 路由 `PUT /api/v1/users/phone`；`SendVerificationCode` 场景白名单增加 `change_phone` |

编译验证：`go build ./biz/user/... ./pkg/verify/... ./pkg/sms/... ./domain/...` 通过。

### 前端

- 路由 `/profile/phone`
- 页面 (`src/pages/ChangePhonePage.tsx`)：输入新手机号 → 人机验证 Cap.js → 获取验证码（scene=`change_phone`）→ 填码 → 确认变更 → `refreshStatus()` → 跳转 `/profile`
- 若短信通道不可用（10648），直接报错（变更手机号无法降级到邮箱）
- 若手机号已被占用（10647 → PhoneTaken），明确提示

### 新增/扩展前端类型与 API

```ts
// src/types/api.ts
SendVerificationCodeRequest.scene 联合类型增加 "change_phone"
ChangePhoneRequest 类型新增  (phone/email/code/channel)
UpdateCurrentUserRequest 类型新增 (name/avatar_url)

// src/api/auth.ts
changePhone(req: ChangePhoneRequest) → PUT /api/v1/users/phone
```

---

## 文件变更清单

### 新增文件（6 个）

| 文件 | 用途 |
|------|------|
| `src/api/users.ts` | `updateCurrentUser` / `uploadAvatar` |
| `src/pages/ProfilePage.tsx` | 个人中心页 |
| `src/pages/ChangeEmailPage.tsx` | 变更邮箱页 |
| `src/pages/ChangePhonePage.tsx` | 变更手机号页 |
| `DEV_PLAN.md` | 本文件 |

### 修改文件（11 个）

| 文件 | 改动 |
|------|------|
| `backend/biz/team/handler/http/v1/user.go` | Team Login captcha 校验逻辑修正 |
| `backend/pkg/sms/code.go` | `SceneChangePhone` 常量 |
| `backend/pkg/verify/channel.go` | `SceneChangePhone` 常量 |
| `backend/domain/user.go` | 接口 + 结构体新增 |
| `backend/biz/user/repo/user.go` | `SetPhone` 实现 |
| `backend/biz/user/usecase/user.go` | `ChangePhoneByCode` 实现 + precheck 扩展 |
| `backend/biz/user/handler/v1/auth.go` | `ChangePhone` handler + 路由 + 场景白名单 |
| `src/context/AuthContext.tsx` | `login` 签名增加 `captchaToken` |
| `src/pages/LoginPage.tsx` | 接入 `CaptchaWidget` |
| `src/components/layout/AppHeader.tsx` | 头像导航至 `/profile` + 显示真实头像；移除原下拉菜单 |
| `src/App.tsx` | 新增 `/profile` `/profile/email` `/profile/phone` 路由 |
| `src/types/api.ts` | `SendVerificationCodeRequest` scene 扩展 + 新增类型 |
| `src/api/auth.ts` | `changePhone` / `sendBindEmailVerification` |

---

## 验证状态

| 检查项 | 状态 |
|--------|------|
| Go build（受影响包） | ✅ 通过 |
| TypeScript typecheck (`tsc --noEmit`) | ✅ 通过 |
| ESLint (`eslint src/`) | ✅ 通过 |
| 后端 go test（未跑） | ⚠️ 建议后续跑 |
| 前端 vitest（未跑） | ⚠️ 建议后续跑 |
| 本地联调验证 | ⚠️ 需 `docker compose up -d` + `dev-startup` 后手动验证 |

---

## 后续建议

1. **运行测试**：`cd backend && go test ./...` 和 `npm test`，确认无回归。
2. **本地联调**：启动后依次验证登录 captcha → 个人中心 avatar/nickname/phone 变更全流程。
3. **连续集成**：不自动 commit/push（项目硬规则），待确认后手动操作。
