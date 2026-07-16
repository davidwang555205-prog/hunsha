# src/data 模块指南

素材定义模块。前端纯数据，与后端 `backend/biz/generation/prompt/assets.go` 1:1 镜像（assets.go 注释明示"逐字节复制"自原 server/prompt.mjs）。**改一处必须同步另一处。**

## 关键文件

- `bridalImageKeywordProfiles.ts` - 8 个关键词档案（promptLine + negativeLine）
  - `realCustomerFitting` 真实客照 / `phoneMirrorSelfieFitting` 手机对镜自拍 / `companionFitting` 陪同 / `fittingPrep` 准备 / `fittingServiceDetail` 服务细节 / `brandLaunch` 品牌 / `storePublishing` 门店 / `bridalMaterialProof` 材质
  - 按 `bridalKeywordProfileId` 或 `extraRequirement` 匹配，决定生图 prompt 的关键词与负面约束
- `xiaohongshuBridalContentProfiles.ts`（895 行）- 内容变体档案：主题选项、文案草稿、选题工具包（变体银行来源）

## 核心约束

- 这些是生图 prompt 的素材源，**关键词不下发前端可见**（对用户隐藏）。
- 8 个关键词档案的 id 和内容必须与 `backend/biz/generation/prompt/assets.go` 完全一致。
- 类型来源：从 `../types` 导入 `ImageType` / `ProductCategory` / `PromptParams` / `ScenePreference`。

## 相关

- 引擎消费方：`src/utils/generateFashionSeedingContent.ts`（Read src/utils/MODULE_GUIDE.md）
- 后端镜像：`backend/biz/generation/prompt/assets.go`
- 契约类型：`src/types/api.ts`（PromptParams）
