# src/utils 模块指南

内容生成引擎 -- 项目核心竞争力。**任务②阶段5（2026-07-13）：算法已迁 Go 后端，前端通过 API 调用。**

## 关键文件

- `fashionSeeding.ts` - 前端保留的轻量类型。主题列表与每日选题由后端内容引擎 JSON 返回，前端不再维护主题枚举。
- ~~`generateFashionSeedingContent.ts`~~ - 算法主体（3135 行）已移 `backup/nodejs/`（历史备份）。

## 机制（阶段5 后）

- 前端不再本地生成文案/配图。`StudioPage.contentPreview` 异步调 `POST /api/engines/:key/generate`（`src/api/admin.ts` 的 `generateContent`）。
- 后端 `backend/biz/engines/seeding/` 确定性算法（1:1 迁自 TS，78 黄金样本 byte-for-byte 验证）。
- 配置化：`content_engines.config["seeding"]` 覆盖默认素材（`seeding.MergeAssets` 全素材深度覆盖）。
- `fashionSeeding.ts` 的 `getDailyFashionSeedingSelection` 仅用于 `studio/constants.ts` 算默认 topic（轻量选题，不依赖素材库）。

## 核心类型（fashionSeeding.ts）

- `FashionSeedingTopic` / `FashionSeedingDailySlot` - 主题（运行时字符串）/篇次
- `FashionSeedingContent` / `FashionSeedingImagePlan` - API 响应类型
- `fashionSeedingDailySlotOptions` - 篇次下拉选项；主题下拉由 `GET /api/engines/:key/topic-options` 返回

## 核心约束

- ⚠️ 内容引擎是核心竞争力。改算法改 Go 侧 `backend/biz/engines/seeding/`，重跑黄金样本验证（见 .claude/knowledge/05-content-engine.md「Go 迁移」章节）。
- 前端 `fashionSeeding.ts` 只含轻量类型，不含主题枚举或算法。算法和主题配置在 Go。

## 相关

- Go 实现：`backend/biz/engines/seeding/`（Read 详见 .claude/knowledge/05-content-engine.md「Go 迁移」章节）
- 素材来源：`src/data/`（Read src/data/MODULE_GUIDE.md，UI 下拉仍用）
- 输出消费：`src/studio/`、`src/components/studio/`、`src/pages/StudioPage.tsx`（调 generateContent API）
- 历史备份：`backup/nodejs/`（TS 算法 + 导出脚本，黄金样本/assets.json 重新生成时用 `npx vitest run --config backup/nodejs/vitest.export.config.ts`）
- 测试：`npm run test`（vitest run，src/）
