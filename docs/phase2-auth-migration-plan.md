# 阶段2：认证切换 MonkeyCode cookie session + team 成员管理

> 目标：拆掉 bridalauth 这层额外认证，让已完整迁移的 MonkeyCode team 模块成为唯一认证 + 账号管理链路。登录改为 email + captcha + cookie session，账号管理改为 team 路由。

## 一、现状盘点（调查结论）

### 1. bridal 已具备的基础设施（全部就绪，无需迁移）

| 组件 | 位置 | 状态 |
|---|---|---|
| team 路由 | `/api/v1/teams/users/*`（login/logout/status/passwords/change/MemberList/reset/update/delete）+ `/api/v1/teams/admin` + `/api/v1/teams/groups/*` | ✅ 已挂载 |
| team Login | `repo.Login` 用 `user.Email(req.Email)` 查 + bcrypt 校验 | ✅ email 登录 |
| InitTeam | `crypto.HashPassword`（bcrypt）建 team + enterprise admin + subaccount member + 默认 group | ✅ |
| MonkeyCode middleware | `backend/middleware/auth.go`：`Auth()`/`Check()`/`TeamAuth()`/`TeamAuthCheck()`/`TeamAdminAuth` + `GetUser`/`SetUser` | ✅ cookie session |
| session 包 | `backend/pkg/session`（Redis Hash） | ✅ |
| captcha 包 | `backend/pkg/captcha`，`TeamGroupUserHandler` 已注入 | ✅ |
| user schema 合并 | `ent/schema/user.go` 同表同时有 team 字段（email/password/role）+ bridal 业务字段（daily_image_limit/credits/username/display_name） | ✅ |

### 2. bridalauth 与 team 并存（bridalauth 是额外加的一层）

- **bridalauth**（待删）：`/api/login`（username+scrypt+HMAC token+Bearer）、`/api/me`、`/api/admin/users`、8 模块鉴权 `BridalAuth()`、role=admin/user
- **team**（待启用）：`/api/v1/teams/users/login`（email+bcrypt+cookie session+captcha）、成员管理全套、role=individual/enterprise/subaccount/admin、`MemberManager` 是 noop（AddUser/AddAdmin 三个路由返回 not implemented）

### 3. 关键 gap

| gap | 影响 | 处理 |
|---|---|---|
| `domain.User` 缺 DailyImageLimit/Credits/Username/DisplayName + `HasUnlimitedImageGeneration()` 方法 | team.Login 返回的 user 不带额度，generation 校验不了 | ✅ Task 1 已补 |
| team 请求结构缺 dailyImageLimit/credits（`AddTeamUserReq`/`UpdateTeamUserReq`/`AddTeamAdminReq` 都没有） | 管理员无法通过 team 路由调整成员额度/积分 | Task 5 补字段 |
| `MemberManager` 是 noop（AddUser/AddUserWithPassword/AddAdmin） | 管理员后台加成员/管理员 404 | Task 6 实现 |
| 无全局 admin 中间件 | credits/engines/categories/channels/syssetting 的 admin 路由是全局的（不绑 team），team 只有 `TeamAdminAuth`（绑 team） | Task 4 加 `middleware.AdminAuth()` |
| `bridalauth.HistoryStats` 适配器 | bridalauth 删了就没消费者 | ✅ Task 2 已去依赖（stats.go 保留统计方法，去掉接口实现） |
| `credits.authRepo`（bridalauth.Repo）查用户 | bridalauth 删了就没法查 | Task 3 改用 db.User 直接查 |

## 二、角色映射（关键决策）

bridalauth 角色 -> team 角色：

| bridalauth | team | 语义 |
|---|---|---|
| `admin`（不限额度 + 管理账号 + 看全部任务） | `enterprise`（InitTeam 建的团队所有者）+ `admin`（系统管理员） | 不限额度、全局 admin |
| `user`（受 dailyImageLimit 限制） | `subaccount`（AddUser 建的团队成员） | 受限 |

`HasUnlimitedImageGeneration()` 判断：`role == enterprise || role == admin`（✅ Task 1 已实现于 `domain.User`）。

**单团队语义**：bridal 实际是"单团队"（InitTeam 建一个 team，所有用户都在里面）。bridal 的 admin = 团队所有者（enterprise）。

## 三、任务进度

### ✅ Task 1：扩展 domain.User 承载 bridal 业务字段（已完成）

**文件**：`backend/domain/user.go`

改动：
- `User` 结构加 `Username`/`DisplayName`/`DailyImageLimit`/`Credits` 字段
- `From(src *db.User)` 映射这 4 个字段
- 加 `HasUnlimitedImageGeneration()` 方法（role==enterprise||admin）
- 加 `MaxDailyImageLimit`/`DefaultDailyImageLimit` 常量 + `NormalizeDailyImageLimit()` 函数（从 bridalauth 搬来）

验证：`go build ./...` 通过，未破坏现有。

### ✅ Task 2：generation 模块切 domain.User（已完成）

**文件**：`backend/biz/generation/` 5 文件

改动：
- `handler.go`：删 `bridalauth` import 加 `middleware`；删死字段 `auth *bridalauth.Handler`；鉴权 `bridalAuthMiddleware(i)` -> `middleware.AuthMiddleware.Auth()`；删 `bridalAuthMiddleware` 函数；`bridalauth.CurrentUser(c)` -> `middleware.GetUser(c)`（5处）；`user.Role == bridalauth.RoleAdmin` -> `user.HasUnlimitedImageGeneration()`（3处）
- `usecase.go`：删 `bridalauth` import 加 `domain`；删死字段 `authRepo *bridalauth.Repo`；`Generate`/`ListHistory` 参数 `*bridalauth.User` -> `*domain.User`；`bridalauth.NormalizeDailyImageLimit` -> `domain.NormalizeDailyImageLimit`；`user.Role == bridalauth.RoleAdmin` -> `user.HasUnlimitedImageGeneration()`
- `usecase_async.go`：`runTask` 参数 `*bridalauth.User` -> `*domain.User`
- `register.go`：删 `bridalauth` import + 删 `HistoryStats` Provide
- `stats.go`：去 `bridalauth.HistoryStats` 接口实现，`NewStatsAdapter` 返回 `*statsAdapter`，保留统计方法供未来复用

验证：`go build ./...` 通过。

### ◻ Task 3：credits 模块切 domain.User + 新账号查询

**文件**：`backend/biz/credits/usecase.go` + `handler.go`

改动点：
- `usecase.go`：
  - 删 `authRepo *bridalauth.Repo` 字段 + inject
  - `ListAllTransactions`：`u.authRepo.ListAllUsers(ctx)` -> 用 `u.repo.db.User.Query().All(ctx)` 查全部用户，建 map（`*db.User` -> `*domain.User` 转换）
  - `Adjust`：`u.authRepo.GetByID(ctx, targetID)` -> `u.repo.db.User.Get(ctx, targetID)` + `domain.User.From()`
  - `AdjustResp`：`bridalauth.PublicUser` -> `*domain.User`；`bridalauth.AccountSummary` -> 删（或改 `[]string` 占位）
  - `map[uuid.UUID]*bridalauth.User` -> `map[uuid.UUID]*domain.User`
- `handler.go`：
  - 删 `bridalauth` import 加 `middleware`
  - `authH.BridalAuth()` -> `middleware.AuthMiddleware.Auth()`
  - `authH.RequireAdmin()` -> `middleware.AuthMiddleware.AdminAuth()`（Task 4 新增）
  - `bridalauth.CurrentUser(c)` -> `middleware.GetUser(c)`（2处）

**注意**：`/api/admin/users/:id/credits` 和 `/api/admin/credits/transactions` 是 bridal 定制 admin 路径，保留路径不变，只换鉴权中间件。

### ◻ Task 4：engines/categories/syssetting/channels 鉴权切 middleware.Auth + 加全局 AdminAuth

**文件**：`backend/middleware/auth.go` + 4 模块 handler.go

改动点：
- `middleware/auth.go`：加 `AdminAuth()` 方法，判断 `GetUser(c).HasUnlimitedImageGeneration()`（enterprise+admin 为全局 admin）
- `engines/handler.go`、`categories/handler.go`、`channels/handler.go`、`syssetting/handler.go`：
  - `authH := do.MustInvoke[*bridalauth.Handler](i)` -> `authMw := do.MustInvoke[*middleware.AuthMiddleware](i)`
  - `authH.BridalAuth()` -> `authMw.Auth()`
  - `authH.RequireAdmin()` -> `authMw.AdminAuth()`
- `syssetting/register.go`：删 `bridalauth.SettingProvider` Provide（ bridalauth 删了就不需要桥接，syssetting 直接被调用）

### ◻ Task 5：team 请求结构 + repo 支持额度字段

**文件**：`backend/domain/team.go` + `backend/biz/team/repo/user.go`

改动点：
- `domain/team.go`：
  - `UpdateTeamUserReq` 加 `DailyImageLimit *int` + `Credits *int`
  - `AddTeamAdminReq` 加 `DailyImageLimit int`（可选）
  - `AddTeamUserReq` 加 `DailyImageLimit int`（可选，对批量成员生效）
- `team/repo/user.go`：
  - `UpdateUser`：支持写 `DailyImageLimit`/`Credits`
  - `InitTeam`/`ensureInitTeamMember`：支持写 `DailyImageLimit`
  - `AddUser` 相关（如果有）支持写 `DailyImageLimit`

### ◻ Task 6：实现 MemberManager 替代 noop

**文件**：新建 `backend/biz/member/manager.go`（或放 `biz/team/member.go`）+ `backend/biz/register.go`

改动点：
- 实现接口（`domain.MemberManager`）：
  - `AddUser`：批量建 subaccount 成员（bcrypt 随机密码或邀请）+ 设 DailyImageLimit
  - `AddUserWithPassword`：批量建 subaccount 成员 + 指定密码
  - `AddAdmin`：建 enterprise 管理员 + 随机密码
  - `AutoCreateOIDCMember`：OIDC 自动建号（bridal 暂不用，返回 not implemented 或复用 AddUser 逻辑）
- `register.go`：删 `noopMemberManager`，注册真实实现

**注意**：MonkeyCode 代码库内也没有 MemberManager 真实实现（靠 host 进程 `WithMemberManager` 注入），所以**无现成代码可抄，需自己写**。参考 `team/repo/user.go` 的 `InitTeam`/`ensureInitTeamMember` 逻辑。

### ◻ Task 7：账号初始化切 team.initTeam + 删 bridalauth

**文件**：`backend/config/config.go` + `backend/biz/register.go` + `backend/biz/team/usecase/user.go` + 删 `backend/biz/bridalauth/`

改动点：
- `config.go`：配 `InitTeam.Email`/`Password`/`Image`（从 env 读，如 `APP_INIT_TEAM_EMAIL`/`APP_INIT_TEAM_PASSWORD`）
- `team/usecase/user.go`：确认 `initTeam()` 在 NewTeamGroupUserUsecase 时被调用（现在可能没调用）
- `register.go`：移除 `bridalauth.ProvideBridalAuth`/`NewHandler`/`InvokeBridalAuth`
- 删 `backend/biz/bridalauth/` 整个包
- 删 `backend/biz/generation/stats.go`（可选，已去依赖，可保留统计方法）

验证：`go build ./...` + `go vet ./...` + 启动跑通 migration + initTeam 建账号。

### ◻ Task 8：前端改造

**文件**：`src/api/client.ts` + `src/context/AuthContext.tsx` + `src/pages/LoginPage.tsx` + `src/api/auth.ts` + `src/api/admin.ts` + `src/pages/AdminPage.tsx`

改动点：
- `client.ts`：`Authorization: Bearer <token>` -> `credentials: "include"`（cookie session）
- `AuthContext.tsx`：删 localStorage key `bridal-content-studio-session`，登录后调 `/api/v1/teams/users/status` 拿 user
- `LoginPage.tsx`：username 输入 -> email 输入 + 加图形验证码组件（调 `/api/v1/captcha` 或 team 的 captcha 接口）
- `api/auth.ts`：`POST /api/login` -> `POST /api/v1/teams/users/login`；`GET /api/me` -> `GET /api/v1/teams/users/status`
- `api/admin.ts`：`/api/admin/users`（GET/POST/PATCH/DELETE）-> `/api/v1/teams/users/*`（MemberList/AddUser/UpdateUser/DeleteUser/ResetPassword）
- `AdminPage.tsx`：账号管理 UI 适配 team 接口字段（email/role/group）+ 加 dailyImageLimit/credits 编辑

验证：`npm run typecheck` + `npm run lint`。

## 四、风险

1. **dailyImageLimit 兼容**：team.Login 返回 `*domain.User`，Task 1 已补字段，generation 额度校验无缝。但 team 的 `MemberList` 返回的 `TeamMemberInfo.User` 是 `*domain.User`，自带 dailyImageLimit，前端账号管理能显示/编辑。
2. **角色语义变化**：bridalauth admin（不限额度）-> team enterprise（团队所有者）。现有数据库里 bridalauth 建的 admin 账号 role="admin"，切 team 后 HasUnlimitedImageGeneration 认 admin 也认，兼容。但 InitTeam 建的新账号 role=enterprise。
3. **数据迁移**：现有 admin/wang 账号是 username+scrypt，切 team 后无法用 email+bcrypt 登录。Task 7 用 InitTeam 重建（新 email+bcrypt）。老账号数据（generation_tasks 关联 user_id）若要保留，需手动迁移 user_id 映射。**建议**：开发阶段直接重建，生产数据另行处理。
4. **/api/me 的 Summary 统计**：bridalauth 的 /api/me 返回 requestCount/successCount 等统计（依赖 HistoryStats）。切 team /status 后不返回这些。前端若依赖，需调整或新写统计接口。
5. **全局 admin 路径**：`/api/admin/users/:id/credits`、`/api/admin/credits/transactions`、`/api/admin/channels` 等是 bridal 定制路径，保留不变，只换鉴权中间件为 `AdminAuth()`。
6. **session 共享**：team Login 用 `MonkeyCodeAITeamSession`，middleware.Auth 用 `MonkeyCodeAISession`。bridal 切换后登录走 team（TeamSession），但 8 模块鉴权走 Auth（AISession）。**需统一**：要么 team Login 也写 AISession，要么 8 模块改用 TeamAuth。**待确认**：team Login 写的是哪个 session key。

## 五、执行顺序

Task 3 -> Task 4 -> Task 5 -> Task 6 -> Task 7 -> Task 8

Task 3+4 改完后 build 通过（bridalauth 还在但没人用 type）；Task 5+6 改完 build 通过；Task 7 删 bridalauth 后 build 通过；Task 8 前端独立验证。

中间状态保证可 build：bridalauth 暂留不删，直到 Task 7 才删。
