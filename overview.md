# 三项优化交付总结

## TL;DR
通过标准 SOP 工作流（PM→架构师→工程师→QA）完成婚纱礼服内容平台三项优化：头像弹窗+菜单权限、内容引擎列表性能（30s→秒开）、生图命名简化。104 个测试 100% 通过，零源码 bug。

## 交付概览

| 项目 | 状态 | 关键指标 |
|---|---|---|
| **需求 1：头像弹窗 + 菜单权限** | ✅ 完成 | 非管理员仅见个人中心；管理员见全部+"个人中心"在"概览"正下方；点击即时高亮 |
| **需求 2：引擎列表性能** | ✅ 完成 | 慢因=jsonb 大字段 SELECT *；ent Select 投影裁 config；预期 P95 ≤200ms |
| **需求 3：生图命名简化** | ✅ 完成 | `图1-主图.png` 格式；历史数据前端兜底；386 个 golden 样本回归全过 |
| **测试** | ✅ QA Round 1 全绿 | 104 测试 100% 通过（前端 64+后端 40），typecheck/lint/go build/go vet 全绿 |
| **已知问题** | 0 阻塞 | 3 条非阻塞优化建议（见下文） |

## 慢因定位（需求 2 核心发现）

**不是数据库/N+1 问题**。链路 `AdminEnginesPage → GET /api/admin/engines → Repo.ListAll → SELECT * FROM content_engines`：
- 单表无 JOIN，已有索引
- **真正慢因**：`content_engines.config` jsonb 单值几百 KB（存整份素材+生图提示词），列表接口 SELECT * 全量返回但表格只用 8 个展示字段
- 响应体上 MB → 前端 `JSON.parse` 卡主线程 → 命中 30s 超时线

**解法**：ent `Select()` 投影裁掉 config 字段（响应体 MB→KB）+ 前端 sessionStorage 缓存/骨架屏/保存后本地更新

## 文件清单（共 15 个源码文件 + 5 个测试文件）

### 需求 1：头像弹窗 + 菜单权限（5 个文件）
- `src/components/layout/AppHeader.tsx` — 头像弹窗（用户区+管理后台[仅 admin]+退出登录）
- `src/components/layout/AdminLayout.tsx` — 静态 navItems → buildNavItems(isAdmin)
- `src/components/auth/RequireAuth.tsx` — RequireAdmin 加白名单 /admin/profile
- `src/App.tsx` — 新增 /admin/profile 路由 + /admin 根路径按角色分流
- `src/components/layout/BaseLayout.tsx` — pendingPath 实现点击即时高亮

### 需求 2：引擎列表性能（6 个文件）
- `backend/biz/engines/repo.go` — 新增 ListSummary（Select 投影）+ GetByID
- `backend/biz/engines/usecase.go` — 新增 EngineSummaryResp + ListAdminSummary + GetByID
- `backend/biz/engines/handler.go` — listAdmin 改调 ListAdminSummary + 新增 GET /api/admin/engines/:id
- `src/types/api.ts` — 新增 ContentEngineSummary/EngineSummaryListResponse/EngineDetailResponse
- `src/api/admin.ts` — listAllEngines 返回类型变更 + 新增 getEngine
- `src/pages/admin/AdminEnginesPage.tsx` — sessionStorage 缓存 + 骨架屏 + 本地更新

### 需求 3：生图命名简化（4 个源码 + 1 个 golden 数据文件）
- `backend/biz/engines/seeding/imageplan.go` — buildDisplayImageName 改 `图N-brief` + 默认草稿改半角连字符
- `src/lib/download.ts` — 新增 normalizeImageDisplayName 兜底历史数据
- `src/components/history/HistoryDetailDrawer.tsx` — 展示名走 normalizeImageDisplayName
- `src/components/history/HistoryCard.tsx` — "下载图 N" 文本走 normalizeImageDisplayName
- `backend/biz/engines/seeding/testdata/golden-samples.json` — 386 个 name 批处理更新

### QA 新增测试（5 个文件）
- `src/lib/download.test.ts` — 22 个用例覆盖 normalizeImageDisplayName 全部分支
- `src/components/auth/RequireAuth.test.ts` — 9 个用例覆盖白名单逻辑（含边界 /admin/profilefoo）
- `backend/biz/engines/usecase_test.go` — 4 个用例（含核心契约：JSON 输出无 config 字段）
- `backend/biz/engines/handler_routes_test.go` — 1 个路由回归测试（/default-assets 不被 :id 吞掉）

## 用户下一步建议

1. **启动验证**：`docker compose up -d`（起 PG/Redis/MinIO）→ `cd backend && go run ./cmd/server` → `npm run dev`，然后：
   - 管理员登录 → 点头像看弹窗 → 进管理后台看全部菜单
   - 非管理员登录 → 进管理后台只看"个人中心"
   - 打开"内容引擎"页面 → 应该秒开（不再等 30s）
   - 生成一组图 → 下载看文件名是 `图1-主图.png` 风格
2. **提交代码**：改动在工作区未提交（遵硬规则）。建议 `git add . && git commit -m "feat: 三项优化 - 头像弹窗/引擎列表性能/生图命名"` 后推送到 dev-dao
3. **性能实测**：打开浏览器 DevTools Network 面板，看 `GET /api/admin/engines` 响应体大小（应从 MB 降到 KB 级）和耗时（应 <200ms）
4. **历史数据**：DB 已存的长文件名不动，前端展示/下载时自动截短为 `图N-brief`（无需迁移）
5. **可选优化**（QA 建议，非阻塞）：AdminEnginesPage 的 readEnginesCache 重复调用可提取变量；useV2 checkbox 非对称设计建议加注释

## 架构设计文档

完整设计文档（含现状分析、调用链、决策点、风险缓解）：`docs/arch/2025-07-20-increment-avatar-menu-perf-filename.md`

## QA 非阻塞建议（供后续参考）

1. `AdminEnginesPage.tsx:87-88` `readEnginesCache()` 被调用 2 次（init state + init isLoading），可提取变量减少 1 次 sessionStorage 读取
2. `AdminEnginesPage.tsx:350` `useV2` checkbox 的 `disabled={!!editingId && !useV2}` 是非对称设计（旧引擎编辑时禁切 V2，V2 引擎编辑时可切回旧版），如果是有意的防误迁移设计建议加注释
3. `normalizeImageDisplayName` 对非 `图N` 前缀但含竖线的自定义名（如 `婚纱|主图`）会兜底为 `图{index+1}`，可能丢失用户命名；若未来允许蓝图自定义含竖线的名字需要扩展白名单
