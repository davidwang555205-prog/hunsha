# 内容引擎调研：确定性变体生成机制

> 基于 `dev-dao` 分支一手代码阅读，关键结论标注 `文件:行号`。
> 内容引擎是项目核心竞争力：**确定性、无随机、非 LLM**，每主题 1000 变体。
>
> ⚠️ **现状（2026-07-15）**：算法已 1:1 迁 Go（`backend/biz/engines/seeding/`，byte-for-byte 等价，78 黄金样本验证），前端改调 `POST /api/engines/:key/generate` API，TS 算法移 `backup/nodejs/`。下文算法剖析基于 TS 源码（现 `backup/nodejs/`），**算法 Node/Go 一致**；Go 实现结构 + 配置化见 `.claude/knowledge/05-content-engine.md`「Go 迁移」章节。

---

## 一、定位与架构

内容引擎是**确定性、无随机、非 LLM** 的纯函数模块。算法已 1:1 迁 Go（`backend/biz/engines/seeding/`），TS 原实现移 `backup/nodejs/generateFashionSeedingContent.ts`（3139 行）作历史参考。前端通过 `POST /api/engines/:key/generate` 调 Go 实现生成内容，再提交生图。

- Go 实现：`backend/biz/engines/seeding/`（`seeding.go` / `strings.go` / `cue.go` / `copy.go` / `narrative.go` / `imageplan.go` / `assets.go` + `testdata/golden-samples.json` 78 样本）
- TS 原实现（历史）：`backup/nodejs/generateFashionSeedingContent.ts`
- 前端轻量保留：`src/utils/fashionSeeding.ts`（类型 + 主题列表 + 轻量选题，UI 下拉/默认 topic 用）
- 素材源：`src/data/`（与后端 `backend/biz/generation/prompt/assets.go` 1:1 镜像）；Go 端 `assets.json` go:embed 加载
- 契约类型：`src/types/api.ts`（API 请求响应，单一事实源）
- 模块文档：`src/utils/MODULE_GUIDE.md`（V2 重构未触碰引擎）

> 下文 `文件:行号` 引用为 TS 原实现位置（现 `backup/nodejs/`），Go 版同函数名首字母大写、逻辑一致。

输出类型 `FashionSeedingContent`（`generateFashionSeedingContent.ts:47`）：
```
{ topic, dateKey, dailySlot, variantIndex, variantCount, variantLabel,
  titles: string[], body: string, images: FashionSeedingImagePlan[], tags: string[], note: string }
```

---

## 二、"确定性"是什么，为什么非 LLM

**确定性 = 相同输入永远产出相同输出**。整个引擎不调 `Math.random`、不调 LLM、不读时间以外的外部状态。种子是一个三层整数键：

- `dateKey`（日期）+ `dailySlot`（每日篇次 1/2）+ `contentNonce`（递增 nonce）

确定性选题公式（`generateFashionSeedingContent.ts:238` `getDailyFashionSeedingSelection`）：
```
globalPostIndex = dayNumber * 2 + (slot - 1)        // 每天篇次 1/2
topic         = topicOptions[globalPostIndex % topicOptions.length]
variantIndex  = floor(globalPostIndex / topicOptions.length) % 1000
```
- `dayNumber = floor(localMidnight / MS_PER_DAY)`（`:217`），只取本地午夜，一天内稳定。
- 主入口 `generateFashionSeedingContent`（`:3065`）中 variantIndex 的最终取值（`:3073`）：
  - 用户手动指定 topic（与当日推荐不同）：`variantIndex = contentNonce % 1000`
  - 跟随每日推荐：`variantIndex = (daily.variantIndex + contentNonce) % 1000`
- `contentNonce` 是用户"换一版"的递增计数器，每点一次切换一个变体。

因为没有任何随机源，给定日期+篇次+nonce，产出的标题/正文/标签/配图计划完全可复现。单测用 `toMatchSnapshot()` 锁定输出（`generateFashionSeedingContent.test.ts:87`）。

---

## 三、"每主题 1000 变体"如何实现--1000 的由来与组合公式

### 3.1 1000 = 10 × 10 × 10

两个常量（`:166-167`）：
```
const TOPIC_VARIANT_COUNT = 1000;
const VARIANT_AXIS_SIZE = 10;
```

1000 不是素材数量硬算出来的，而是**把 variantIndex (0–999) 作十进制三位数分解**为 3 个 0–9 的轴（`getVariantAxes`，`:2137`）：
```
primary   = safeIndex % 10                                  // 个位
secondary = floor(safeIndex / 10) % 10                      // 十位
tertiary  = floor(safeIndex / 100) % 10                     // 百位
```

### 3.2 从 3 轴派生 11 个文案维度

3 个轴直接映射 3 个维度，再用**不同系数的线性同余**派生其余 8 个维度（`:2148-2159`）：

| 维度 | 公式 | 直接入参轴 |
|---|---|---|
| audience | = primary | 是 |
| focus | = secondary | 是 |
| concern | = tertiary | 是 |
| proof | (primary + secondary*3 + tertiary*7) % 10 | 派生 |
| scene | (primary*7 + secondary + tertiary*3) % 10 | 派生 |
| material | (primary*3 + secondary*7 + tertiary) % 10 | 派生 |
| service | (primary*5 + secondary*2 + tertiary) % 10 | 派生 |
| takeaway | (primary*2 + secondary + tertiary*5) % 10 | 派生 |
| tone | (primary*3 + secondary*2 + tertiary) % 10 | 派生 |
| tagA | = primary | 是 |
| tagB | (secondary + tertiary) % 10 | 派生 |
| tagC | (primary + tertiary) % 10 | 派生 |

系数（7,3,5,2,1）刻意取不同值，确保 11 个维度**异步漂移**：相邻 variantIndex 不会让所有维度同步跳变，避免"换汤不换药"。这是确定性引擎里最核心的算法手笔。派生维度都落在 0–9，正好匹配每个维度的 10 个候选短语。

---

## 四、变体银行（CopyVariationBank）机制

### 4.1 不是预生成，是按需计算

"变体银行"是文案素材池的比喻，**不是预生成存储**。引擎是纯函数，每次调用即时从银行里按轴索引取短语拼装。没有任何持久化、没有缓存、没有"预生成 1000 条"。

银行类型 `CopyVariationBank`（`:99`）含 10 个维度，每个维度是 `string[]`：
```
{ audiences, focuses, concerns, proofs, scenes, materials, services, takeaways, tones, tagExtras }
```

### 4.2 银行的三层来源（`buildCopyVariationBank`，`:2117`）
1. **类别基础银行**：`bridalVariationBank`（`:264`，婚纱）或 `dressVariationBank`（`:387`，裙装）。每个维度硬编码 10 条短语。
2. **主题覆盖**：`xiaohongshuTopicOverrides`（`:510`），6 个小红书主题各有一份完整的 10 维度覆盖（真实客户试纱 / 手机对镜自拍试纱 / 试纱陪同视角 / 试纱避坑准备 / 婚纱品牌发布 / 婚纱店发布），见 `:511-1183`。
3. **文案草稿与 kit 短语补充**：从 `xiaohongshuBridalCopyDrafts` 和 `TopicCopyKit` 的 openings/observations/scenes/closings 里抽短语补进 focuses/concerns/proofs/scenes/materials/takeaways。

最后用 `ensureBankItems`（`:2091`）把每个维度归一化为**恰好 10 项**（多则截、少则循环补），保证 `% VARIANT_AXIS_SIZE` 取索引安全。

### 4.3 后台可运行时覆盖
`activeTopicOverrides`（`:2106`）是个可变模块级变量，可通过 `setTopicOverrides`（`:2109`）被后台 `content_engines.config.topicOverrides` 覆盖。注释明示"拉不到/为空则用代码默认，永不阻塞生图"（`:2104`）。这是变体银行唯一的"非确定"入口，但默认走代码，且覆盖只替换素材不引入随机。

---

## 五、选题逻辑：从 1000 变体里选出具体标题/正文/标签

主函数 `buildCopyFromKit`（`:2313`）：

1. 取 `kit = topicCopyKits[topic]`（`:2375`，每主题一份手写 copyKit：titles/openings/observations/scenes/closings/tags/note）。
2. `bank = buildCopyVariationBank(topic, kit)`。
3. `axes = getVariantAxes(variantIndex)` 得 11 个轴索引。
4. 每个轴 `pick(bank.<dim>, axes.<dim>)` 取一条短语（`pick = items[index % items.length]`，`:260`）。
5. 文本清洗：`readableCue`（`:1193`，去标点+同义替换）、`titleCue`（`:1225`，把长短语压成 ≤10–12 字标题语）、`narrativeCue`（`:1441`）、`softenAction`（`:1468`，"让顾问"->"可以让顾问"）。

### 5.1 标题生成（`buildNaturalTitles`，`:1516`）
按主题分 6 种组合公式，每个产出 3 个备选标题。三组各 10 个的标题零件：
- `titleStarters`（`:1487`）：["先别急","试完再说",...] 10 个
- `titleAngles`（`:1489`）：10 个
- `titleClosers`（`:1491`）：10 个

零件由 `pick(titleStarters, axes.primary)` 等取。对小红书主题，`baseTitle` 来自 `xiaohongshuBridalCopyDrafts[topic][axes.primary].titles[axes.secondary]`（`:2257,2274`）。标题经 `cleanTitle` 去空白、截断到 34 字（`:1507`）。

### 5.2 正文生成（`buildNarrativeBody`，`:2205`）
把正文拼成 5 段，每段从一组模板里按轴取一个并注入上下文：

| 段 | 模板组 | 取索引 |
|---|---|---|
| 开场 | characterMoodOpenings | axes.primary |
| 环境 | environmentDetails | axes.secondary |
| 产品观察 | productObservationDetails | axes.tertiary |
| 情绪转折 | emotionalTurns | axes.proof |
| 收尾 | humanClosings | axes.takeaway |

5 组模板定义在 `:1574-2085`，每组 7 个类型（bridal/phone/prep/companion/brand/store/dress），每类型 10 个模板函数。模板是 `(NarrativeTemplateContext) => string`，上下文含 `audienceCue/focusCue/concernCue/...`（由 `buildNarrativeTemplateContext` 在 `:2182` 用 `narrativeCue` 压成 ≤24 字注入）。叙事类型由主题决定（`getNarrativeType`，`:2196`）。

### 5.3 标签生成（`buildVariantTags`，`:2163`）
```
uniqueItems([...kit.tags, pick(bank.tagExtras, axes.tagA),
             pick(bank.tagExtras, axes.tagB), pick(bank.tagExtras, axes.tagC)]).slice(0, 7)
```
kit 固定标签 + 银行 tagExtras 按 tagA/tagB/tagC 三个派生轴取 3 个，去重截前 7。

### 5.4 小红书主题的文案草稿（xiaohongshuBridalCopyDrafts）
`src/data/xiaohongshuBridalContentProfiles.ts:565` 定义 `Record<XiaohongshuBridalTopic, XiaohongshuCopyDraft[]>`，**每主题 5 个 draft，6 主题共 30 个**。每个 draft（`:30`）：`{ titles: string[], paragraphs: string[], tags?: string[], note?: string }`。`buildXiaohongshuDraftCopy`（`:2251`）用 `pick(drafts, axes.primary)` 选一个 draft（5 个循环），draft.titles 经 `pick(draft.titles, axes.secondary)` 选出 baseTitle。

---

## 六、配图计划与图组连续性

### 6.1 配图蓝图（ImageDraft）
每主题预定义 5 张图蓝图，`getImageDrafts`（`:2826`）按类别分发到 `getBridalImageDrafts`/`getDressImageDrafts`。蓝图类型 `ImageDraft`（`:71`）：
```
{ name, purpose, description, imageType, scenePreference, extraRequirement, bridalKeywordProfileId? }
```
小红书主题的蓝图定义在 `src/data/xiaohongshuBridalContentProfiles.ts` 的 `imageBlueprints`，每张图含 keywordProfileId 和一段英文 extraRequirement。

### 6.2 从蓝图到 PromptParams（`buildImagePlan`，`:3034`）
- `scenePreference` 用 `resolveAlignedScenePreference`（`:2838`）从**文案 context.scene 关键词**推导（如文案含"试纱/镜前/顾问/头纱" -> 试纱间），并用 `isSceneCompatibleWithImageType` 校验兼容性，不兼容回退。
- `modelChoice` 用 `resolveImageModelChoice`（`:2882`）：婚纱类且关键词档案为 realCustomerFitting/phoneMirrorSelfieFitting/companionFitting/fittingServiceDetail/storePublishing 时，强制改为"高级婚纱店真实试纱客户"。
- `extraRequirement` 拼入两段：
  - `buildPromptAlignmentRequirement`（`:2999`）：文案对齐约束。
  - `buildSeriesContinuityRequirement`（`:3011`）：**图组连续性硬约束**--同一物理空间、同一人物身份、同一手机外观、禁止拼图/分屏/三联/连拍表。
- `generationNonce = baseParams.generationNonce + variantIndex * 10 + index + 1`（`:3053`），让每张图 nonce 唯一。
- `leadPersonIndex`（`:3079`）= 首张人物图索引，该图建立身份，后续图引用同一身份（CLAUDE.md 硬规则 5"首图回传为后续参考图"）。

---

## 七、前后端衔接：内容生成 vs 生图

引擎算法在 Go 后端（`backend/biz/engines/seeding/`），前端调 `POST /api/engines/:key/generate` 拿 `FashionSeedingContent`（标题/正文/标签/配图计划）。提交生图时，前端把 `content.images[].params`（PromptParams）补上 `generatedImageName`，连同 `title/body/tags/topic` 打包成 `CreateTaskRequest`（`src/types/api.ts`）POST 到 `/api/v1/generation`：

```
promptParamsList: (PromptParams & { generatedImageName: string })[]
title, body, tags, topic, referenceImages, size, quality, channelId?, categoryId?
```

生图后端 `backend/biz/generation/` 用 `prompt/assets.go`（与 `src/data` 1:1 镜像的素材表）把 PromptParams 拼装成英文 image prompt，调 WalaAPI（GPT Image-2）生图。**内容生成与生图都在后端，前端只负责交互与展示。**

---

## 八、素材定义 1:1 镜像与 8 关键词档案

### 8.1 镜像关系
`backend/biz/generation/prompt/assets.go:2` 注释明示"1:1 迁移自 server/prompt.mjs（真实源码，逐字节复制）"。镜像点：

| 前端 | 后端 | 内容 |
|---|---|---|
| `src/data/bridalImageKeywordProfiles.ts:19` | `assets.go:129` `bridalImageKeywordProfiles` | 8 关键词档案 {promptLine, negativeLine} |
| `src/data/bridalDressSceneOptions.ts:35,76` | `assets.go:165,175` `bridalScenesByImageType`/`dressScenesByImageType` | 场景-图片类型兼容表 |
| `src/types.ts:27` ImageType / `:35` ScenePreference / `:61` ModelChoice | `assets.go:57,67,94` imageTypeLines/sceneLines/modelLines | 枚举值与英文翻译 |

CLAUDE.md 硬规则 4：改 `src/data` 必须同步 `assets.go`。注意 `src/types.ts`（生图核心类型）与 `src/types/api.ts`（API 契约）是两个文件--api.ts 从 `../types` 导入 PromptParams（`src/types/api.ts:9`），PromptParams 真正定义在 `src/types.ts:81`。

### 8.2 8 关键词档案
`BridalImageKeywordProfileId`（`src/data/bridalImageKeywordProfiles.ts:3-11`）8 个 id：

| id | 用途 |
|---|---|
| realCustomerFitting | 真实客照试纱 |
| phoneMirrorSelfieFitting | 手机对镜自拍 |
| companionFitting | 陪同视角 |
| fittingPrep | 试纱准备/清单 |
| fittingServiceDetail | 服务细节（顾问手部/钉珠道具） |
| brandLaunch | 品牌发布 |
| storePublishing | 门店发布 |
| bridalMaterialProof | 材质证据 |

每个档案 `{ promptLine, negativeLine }`（`:13`），promptLine 是英文生图关键词，negativeLine 是负面约束。匹配逻辑 `getBridalPromptKeywordProfileForParams`（`:89`）按 `extraRequirement` 关键词（"手机/对镜自拍" -> phoneMirrorSelfieFitting，"朋友/妈妈/陪试" -> companionFitting 等）+ imageType + scene 综合判定。这些关键词**不下发前端可见**（MODULE_GUIDE 明示），只进后端 prompt。

---

## 九、变体数据结构（TypeScript 类型汇总）

核心类型集中在 `generateFashionSeedingContent.ts:40-164` 与 `src/types.ts`：

- `FashionSeedingTopic`（`:37`）= BridalFashionTopic（11 主题，`:12`）| DressFashionTopic（10 主题，`:25`）
- `FashionSeedingDailySlot`（`:38`）= 1 | 2
- `FashionSeedingImagePlan`（`:40`）= `{ name, purpose, description, params: PromptParams }`
- `FashionSeedingContent`（`:47`）= 完整输出
- `VariantAxes`（`:118`）= `{ variantIndex, primary, secondary, tertiary, audience, focus, concern, proof, scene, material, service, takeaway, tone, tagA, tagB, tagC }`（全 number）
- `CopyVariationBank`（`:99`）= 10 个 `string[]` 维度
- `CopyAlignmentContext`（`:137`）= 文案对齐上下文（含 9 维短语 + visualRecipe）
- `PromptParams`（`src/types.ts:81`）= 生图参数单一事实源，含 productCategory/bridalStyle/dressStyle/imageType/modelChoice/season/scenePreference/lightPreference/extraRequirement/generationNonce/bridalKeywordProfileId?/generatedImageName?

---

## 十、关键数字来源一览

| 数字 | 来源 | 含义 |
|---|---|---|
| 1000 | `TOPIC_VARIANT_COUNT`（`:166`） | 每主题变体数 = 10³ |
| 10 | `VARIANT_AXIS_SIZE`（`:167`） | 每维度候选数 / 三轴基数 |
| 2 | `DAILY_POST_COUNT`（`:207`） | 每天篇次数 |
| 11 | `bridalFashionTopicOptions.length`（`:169`） | 婚纱主题数 |
| 10 | `dressFashionTopicOptions.length`（`:183`） | 裙装主题数 |
| 6 | `xiaohongshuBridalTopicOptions.length`（`data:55`） | 小红书子主题数 |
| 5 | `imageCount` 默认（`:3066`） | 每篇配图数（可选 3） |
| 8 | `bridalImageKeywordProfiles` | 关键词档案数 |
| 5×6=30 | `xiaohongshuBridalCopyDrafts` | 小红书文案草稿数 |
| 5×7×10 | narrative 模板 | 5 段 × 7 类型 × 10 模板 = 350 个正文模板 |

---

## 十一、核心提炼

确定性引擎的本质：把"日期+篇次+nonce"三整数键，通过**十进制分解 + 线性同余派生**，映射到 11 个文案维度的 10 元素材池里取短语，再用主题专属的标题/正文模板公式拼装。

- **1000 = 10³ 是设计选择**（三轴十进制），不是素材组合穷举。
- **变体银行按需计算不预存**，可被后台覆盖但代码兜底。
- **后端生文 + 后端生图**（Go 迁移后），靠 PromptParams 衔接，素材表前后端 1:1 逐字节镜像。
