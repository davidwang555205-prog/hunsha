# 上线前全检报告 · 客服联系功能（dev-dao 增量）

**日期**：2026-07-21
**场景**：上线前检查（代码审查 + 安全审计 + QA测试）
**参与成员**：产品评审员 + 安全官 + QA负责人
**范围**：当前工作区未提交增量（新功能「客服联系 customer service info」+ 若干改动文件）。39 提交的历史 diff 不在本次范围。
**约束**：只读、不编辑、不部署。

---

## 📌 TL;DR（执行摘要）

- 整体结论：🟡 有条件通过（无硬性阻塞，但存在上线前必须处理的中高危项）
- 阻塞项数量：**0 硬性阻塞**；P0 条件项 3 项（限流 / 审计中间件 / 上传内容校验）
- 测试结果：后端 `go build/vet/test` 全绿；前端 `typecheck/lint/test` 全绿
- 综合严重度：🔴 0 / 🟠 3 / 🟡 8 / 🟢 3
- 下一步：完成 P0 三项修复后可达 🟢 Go；当前不建议直接合 main 发布

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🟡 条件 Go（Conditional） |
| 严重度分布 | 🔴 0 / 🟠 3 / 🟡 8 / 🟢 3 |
| 关键行动项 | 9 条（P0×3 / P1×3 / P2×3） |
| 建议负责人 | 后端（限流/审计/上传/错误/Cookie）+ 产品（PII/列表可见性/回归确认）+ 前端（单测/空态） |
| 是否可合 main | 否，待 P0 完成 |

### 阻塞项清单（上线前必须清零的条件项）
- 无绝对硬性阻塞。但以下 P0 项未完成前，不建议合 main 发布：
  1. 客服 admin 写接口 + 登录/注册 + Cap.js 未加速率限制（🟠 F1）
  2. 新管理接口未接入审计中间件，无操作审计日志（🟠 F2）
  3. 二维码上传信任客户端 Content-Type、未校验魔数（🟠/🟡 上传项，stored-XSS 隐患）

### 回滚预案（仅文档化，本次不执行）
- **DB**：`migrate down 1`（回退至 v46）执行 `down.sql` 的 `DROP TABLE`，可逆、无关联外键。
- **后端**：回退 `customerservice` 模块 + `register.go` 装配 + ent 生成文件 + 迁移 000047；服务首启自动跑迁移，回退需手动 `down`。
- **前端**：SPA 无状态，回退 = 重新部署上一构建，移除 `ContactServiceModal` 等增量即可。
- **Feature flag（软开关）**：表为空时公开接口返回 `[]`，UI 显示「暂无在线客服」优雅降级，上线可暂不填数据使功能休眠。

---

## 1. 各成员核心结论

### 🔍 产品评审员（代码审查，已用 review skill）
- 核心判断：🟡 有条件可上线，无硬性阻塞；迁移 000047 字段/类型/索引与 schema 完全对齐，ent 自动生成代码与手写 schema 一致。
- 关键建议：上传二维码仅校验扩展名、未校验魔数（🟠 高）；错误文案 `err.Error()` 直传前端；公开列表 `GET /api/customer-service` 挂了登录鉴权但 schema 称「用户端入口」，需产品确认可见性；客服后端零单测；确认 `AdminChannelsPage` 删除 Redfox UI 非误删回归。

### 🛡️ 安全官（OWASP + STRIDE 审计）
- 核心判断：🟡 有条件通过，无确认越权/注入/PII 外泄类硬阻塞；但存在上线前应修复的中危项。
- 关键建议：全站无速率限制（🟠 F1）；新 admin 接口未接入 `AuditMiddleware`（🟠 F2）；二维码上传信任客户端 Content-Type（🟡 F3）；错误泄露内部信息（🟡 F4）；Cookie 未设 `Secure`（🟡 F5）；客服 PII 明文存储且公开列表向全部登录用户返回 phone/wechatId（🟡 F6）。强烈建议上线前修复 F1、F2。

### ✅ QA负责人（QA测试 + 发布就绪，已用 qa skill）
- 核心判断：🟢 可发布，所有自动化门禁通过，无功能性缺陷。
- 关键建议：新客服后端零单测（🟡 非阻塞）；1 处 lint 警告 `ContactServiceModal.tsx:44` exhaustive-deps（🟢 非阻塞）；发布须将全部 ent 生成文件一并提交，否则构建破裂；回滚预案已文档化。

---

## 2. 综合审查发现（去重合并后按严重度排序）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源成员 |
|---|--------|------|------|---------|------|---------|
| 1 | 🟠 | 安全/注入·XSS | backend/biz/customerservice/handler.go:119-147 | 二维码上传仅校验扩展名(ext)，未校验文件魔数；Content-Type 直接取自客户端 Header；若 imagestore 按原类型回源，管理员传 SVG/HTML 可触发 stored-XSS | 校验魔数，强制 `image/*` 安全 Content-Type，响应加 `X-Content-Type-Options: nosniff`，禁止 SVG | 产品评审员 + 安全官 |
| 2 | 🟠 | 安全/DoS·A07 | 全站（登录/注册/Cap.js/客服 admin 写接口） | grep 无 ratelimit，登录注册与 admin 写接口均无速率限制/防刷 | 登录/注册/Cap.js、客服 admin 写接口加限流 | 安全官 |
| 3 | 🟠 | 安全/Repudiation·A09 | backend/biz/customerservice/*（create/update/delete/upload-qrcode） | 新管理接口未接入 `AuditMiddleware`（biz/ 无 `audit.Audit` 引用），无操作审计日志 | 套用 `audit.Audit("admin_cs_*")`，phone/wechat 字段脱敏 | 安全官 |
| 4 | 🟡 | 安全/错误处理·A05 | handler.go:78-115 | create/update/remove 直接 `return err.Error()` 给客户端，泄露 DB 内部错误（含 ent not found 文案） | 统一错误响应，仅记录日志、返回通用文案；not-found 用 404 | 产品评审员 + 安全官 |
| 5 | 🟡 | 安全/A02·A07 | 会话 Cookie | Cookie 已设 `SameSite=Lax+HttpOnly`，但未设 `Secure` | 设 `Secure=true` + 启用 HSTS | 安全官 |
| 6 | 🟡 | 安全/PII·数据分类 | 客服表 + 公开列表接口 | phone/wechat_id/qrcode_url 明文存储；公开列表 `GET /api/customer-service` 向全部登录用户返回 phone+wechatId | 评估字段加密/最小化；公开列表隐藏敏感字段 | 安全官 |
| 7 | 🟡 | 产品/鉴权决策 | `GET /api/customer-service` | 接口挂了登录鉴权，但 schema 注释称「用户端顶栏客服入口」，未登录是否也应可见需确认 | 产品确认公开列表是否需登录 | 产品评审员 |
| 8 | 🟡 | 测试缺失 | backend/biz/customerservice（handler/repo/usecase） | 新建后端零单测，否定路径（非法 uuid、空昵称、not found）与鉴权拒绝分支未覆盖 | 补 usecase/handler 单测与鉴权否定测试 | 产品评审员 + QA |
| 9 | 🟡 | 范围/回归 | src/pages/admin/AdminChannelsPage.tsx vs AdminSettingsPage.tsx | AdminChannelsPage 删除了 Redfox 凭证 UI，AdminSettingsPage 引入 listSettings/updateSetting，需确认 Redfox 配置已迁移至 Settings 页、非误删回归 | 确认配置迁移完整，无功能回归 | 产品评审员 |
| 10 | 🟢 | 安全/CSRF | 前端 ContactServiceModal 等 | 前端仅 `<img src>` 渲染 qrcodeUrl，无 `dangerouslySetInnerHTML`（良好）；CSRF 仅靠 `SameSite=Lax` | 建议补 CSRF token 纵深防御 | 安全官 |
| 11 | 🟢 | 代码质量 | src/components/studio/ContactServiceModal.tsx:44 | lint 警告 `useEffect` 缺 `open` 依赖（因 `key={open}` 强制重挂载，功能无碍） | 加注释或补依赖（非阻塞） | QA |
| 12 | 🟢 | 安全/A02（预存在） | pkg/git/gitlab、pkg/ws 等 | `InsecureSkipVerify=true`（TLS 校验关闭），超出本次 diff 范围 | 单独排期修复（非本次阻塞） | 安全官 |
| 13 | 🟢 | 安全/范围外 | backend/biz/register.go | 本次仅 DI 装配（ProvideCustomerService + InvokeCustomerService），真实 Cap.js 强制/密码哈希在 biz/user、biz/public、pkg/captcha（未改动），未能在 diff 内确认 captcha 强制 | 单独回归验证 captcha 强制 | 安全官 |

---

## ✅ 行动清单（具体可执行项）

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | 客服 admin 写接口 + 登录/注册 + Cap.js 加速率限制/防刷 | 后端 | P0 | 发布前 |
| 2 | 新管理接口接入 `AuditMiddleware`（`audit.Audit("admin_cs_*")`），phone/wechat 脱敏 | 后端 | P0 | 发布前 |
| 3 | 上传二维码：校验魔数、强制 `image/*` 安全 Content-Type、响应加 `nosniff`、禁止 SVG | 后端 | P0 | 发布前 |
| 4 | 统一错误响应，禁止向客户端泄露 DB 内部错误（not-found 用 404） | 后端 | P1 | 发布前/紧随 |
| 5 | 会话 Cookie 加 `Secure=true` + 启用 HSTS | 后端 | P1 | 发布前/紧随 |
| 6 | 评估客服 PII 加密/字段最小化；公开列表隐藏 phone/wechatId | 产品 + 后端 | P1 | 发布前评审 |
| 7 | 补客服后端单测（非法 uuid、空昵称、not-found、非 admin 拒绝、upload 超 10MB、非图片扩展名） | 后端 | P2 | 合 main 前 |
| 8 | 产品确认：公开客服列表是否需登录；Redfox→Settings 迁移无回归 | 产品 | P2 | 合 main 前 |
| 9 | 前端补空列表/加载失败分支；消除 `ContactServiceModal` lint 警告 | 前端 | P2 | 合 main 前 |

---

## ⚠️ 待完善 / 已知局限

- 本次为**只读审查**，未实际执行数据库迁移、未运行会改动状态的命令；结论基于静态审查 + 自动化门禁结果。
- 安全官未能在 diff 内确认 `register.go` 的 Cap.js 强制与密码哈希（属 biz/user 等未改动模块），建议单独回归。
- `pkg/git`、`pkg/ws` 的 `InsecureSkipVerify=true` 为预存在问题，超出本次增量范围，需另立专项修复。
- ent 自动生成文件部分未跟踪，发布须整批提交，否则 CI/构建会破裂。

---

## 📚 成员产出索引

- gstack-product-reviewer（产品评审员）原始产出：agent-04347cfc — 客服联系功能代码审查报告（review skill，7 视角）
- gstack-security-officer（安全官）原始产出：agent-54bd4d7b — 安全审计报告（STRIDE + OWASP Top 10）
- gstack-qa-lead（QA负责人）原始产出：agent-9e130cf7 — QA 就绪报告（qa skill，门禁全绿）

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
