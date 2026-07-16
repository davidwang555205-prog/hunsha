# 生图逻辑调研：提示词如何生成并传递给大模型

> 基于 `dev-dao` 分支一手代码阅读，关键结论标注 `文件:行号`。
> ⚠️ 知识库 `.claude/knowledge/03-image-generation.md`、`04-prompt-system.md` 描述的是 **Node 时代同步实现**（引用已删除的 `server/index.mjs`、`server/prompt.mjs`），**整体过时**。本文为 Go 后端最新实现。
>
> 📅 **2026-07-14 更新**：`runTask` 已从「串行逐张」改为「首张串行建连续性参考图 + 后续并发」，并新增「模型线路优先级 fallback」（多线路按 `sort_order` 降级，用户指定线路也参与降级）。详见 2.4、六、九节。下方 `usecase_async.go` 行号因重构偏移，**以函数名定位为准**。

---

## 一、总览：异步任务模型

生图是**异步任务 + 前端轮询**：提交即返回 taskId，worker goroutine **首张串行建连续性参考图 + 后续并发**调 WalaAPI（GPT Image-2），多线路按优先级 fallback，前端 3s 轮询拿逐张进度。Node 时代的同步 `/api/generate` 已删除。

核心代码在 `backend/biz/generation/`：

| 文件 | 职责 |
|---|---|
| `handler.go` | HTTP 入口，cookie session 鉴权，5 个端点 |
| `usecase.go` | 同步部分：校验 + 入库 + 启 worker |
| `usecase_async.go` | 异步 worker：首张串行+后续并发调 WalaAPI + 线路优先级 fallback + 连续性 + 扣分 |
| `prompt/prompt.go` | Prompt 拼装（纯函数，1:1 迁移自 Node `prompt.mjs`） |
| `prompt/assets.go` | 素材表（1:1 镜像前端 `src/data/`） |
| `wala/client.go` | WalaAPI 客户端（1:1 迁移自 Node） |
| `repo.go` / `repo_async.go` | 数据访问（ent） |
| `imagestore/store.go` | MinIO 存储 |

---

## 二、完整调用链路（前端发起到 WalaAPI 返回）

### 2.1 路由注册（`handler.go:42-53`）
`/api/v1/generation` 路由组，挂 `middleware.Auth()`（cookie session 鉴权，见 [node-vs-go-backend.md](node-vs-go-backend.md) 第六节）：
- `POST ""` 生图（`handler.go:58`）
- `GET /history`、`GET /tasks`、`GET /tasks/:id`、`POST /tasks/:id/cancel`
- `GET /images/:filename` 图片代理（无鉴权，`handler.go:111`）

### 2.2 入口 handler（`handler.go:58-68`）
取 `middleware.GetUser(c)` -> 调 `usecase.Generate` -> 错误经 `handleGenError`（`handler.go:213`）转换：wala 401/403 映射 502，避免前端误判为未登录触发全局登出。

### 2.3 Usecase.Generate 同步部分（`usecase.go:318-553`）
1. 解析 `promptParamsList`（最多 5 组，兼容旧 `promptParams`）`usecase.go:320`
2. 校验 title/body/tags（tags ≤ 20）`usecase.go:337`
3. 解析参考图：场景图（0~1 张可选）+ 产品图（4~6 张必传，不足 4 报 400），`toWalaFile` 解码 dataUrl；传了场景图则整组 `SceneLocked=true` `usecase.go:354`
4. **积分校验**：非 admin 需 `user.Credits >= len(paramsList)`，否则 402 `usecase.go:367`
5. **限流**：每用户 ≤ 3 个进行中任务，否则 429 `usecase.go:374`
6. **每日额度**（上海时区，admin 不限）`usecase.go:379`
7. 前置计算 `leadPersonIndex`/`leadPhoneIndex`，全组统一 ScenePreference、人物图统一 ModelChoice `usecase.go:400`
8. 生成 `plans []promptPlan`（调 `prompt.GeneratePrompt`）`usecase.go:432`
9. 算 `promptHash`（sha256，拼 `\n---\n`）`usecase.go:459`
10. 解析 categoryId/channelId，校验线路存在且启用；未指定回退默认 `usecase.go:475`
11. **入库**：`repo.CreateTask`（status=queued）+ 预写 N 条 pending 子图占位 `usecase.go:501`、`repo_async.go:22`
12. **启 worker**：`go u.runTask(...)` `usecase.go:543`
13. **立即返回** `{taskId, status:"queued", totalCount, estimatedSeconds}`（`estimatedSeconds = len(plans)*90`）`usecase.go:547`

### 2.4 Worker 异步执行（`usecase_async.go` `runTask`）
1. 独立 `context.Background()`（不绑请求，取消靠 DB 轮询）
2. **构建候选线路链** `buildCandidates`：用户指定/默认线路排链首，其余启用线路按 `sort_order` 降级（去重）；无任何启用线路回退 `.env` 默认 client（`id=Nil`，不记 stats）。详见九节
3. `SetTaskStarted`（queued -> processing）
4. **串行段 0..splitIdx**（`splitIdx` = 第一个含人物图 index `leadPersonIndex`，通常=0；无人物图则=0）：逐张串行调 `generateOne`，建立 `sceneRef`（首张）+ `identityRef`（第一个含人物张），保证图组连续性
5. **并发段 splitIdx+1..N-1**：`sync.WaitGroup` 并发调 `generateOne`，复用串行段建立的 `sceneRef`/`identityRef`（只读，并发安全）
6. `generateOne` 单张全流程：检测取消 `IsTaskCancelled` -> 子图 processing -> 组装参考图（见五节）-> 全局信号量 `u.sem`（默认 5）-> `callWithFallback` 调 wala -> 失败/空图子图 failed + `IncCompletedCount` / 成功 `saveGeneratedImages` 存 MinIO + 子图 success + `IncCompletedCount` + 扣 1 积分
7. 任一张失败/取消：串行段失败 `break` 清理后续 pending 子图标 failed/cancelled；并发段失败已成功图保留，任务标 failed
8. `SetTaskDone`（completed/failed/cancelled）

> 并发后 3 张图从 ~270s 降到 ~180s（首张 ~90s + 后续 2 张并发 ~90s），连续性完全保留（后续图都参考首张）。`splitIdx` 通常=0（首张含人物），串行段仅首张，性能最优。

---

## 三、Prompt 拼装

### 3.1 入口（`prompt/prompt.go:289`）
`GeneratePrompt(p Params, ctx SeriesContext) string`。**纯函数、确定性**（无随机、无时间），1:1 迁移自 Node `prompt.mjs`。

### 3.2 拼装顺序（`prompt.go:352`）
用 `cleanJoin`（过滤空行后 `\n` 连接）拼接 19 段：
1. 品类（婚纱/礼服 vs 裙装/女装）
2. 款式（自定义名非 CJK 时覆盖）
3. 图片类型（6 种）
4. 产品存在方式
5. 参考图约束（婚纱 14 项 / 裙装 11 项细节，"Do not redesign the garment"）
6. 模特（7 种；`shouldIncludePerson=false` 时强制静物）
7. 场景（24 种，`resolveScene` 解析；`SceneLocked=true` 时替换为"复用上传场景图环境"）
7.5. 场景锁定（仅 `SceneLocked=true` 时注入 `buildSceneLockLine`：强制复用场景图环境/背景/光线/色温/构图，不得换场景）
8. 季节
9. 光线
10. 小红书关键词（仅婚纱品类）
11. 手机对镜构图
12. 系列手机连续性
13. 系列分镜
14. 系列连续性
15. 品牌方向（常量）
16. 构图（常量）
17. 相机感（常量）
18. 负面约束（14 条）+ 档案 negativeLine
19. 补充要求（仅 extraRequirement 非 CJK 时）

### 3.3 场景解析（`prompt.go:110` `resolveScene`）
显式选非"自动匹配"直接用；否则按 `generationNonce % len(compatible)` 轮转兼容场景（多次生成自动换场景），兜底"材质工作台"。兼容映射 `bridalScenesByImageType`/`dressScenesByImageType`（`assets.go:165`）。

**`SceneLocked`（V2 新增）**：传了场景参考图时整组 `Params.SceneLocked=true`（`usecase.go` Generate 注入）。此时 scene 行替换为"Scene: reuse the exact environment shown in the uploaded scene reference image."，并额外注入 `buildSceneLockLine`（场景锁定硬约束）。`SceneLocked=false` 时行为零变化（golden test 不受影响，新功能由独立 `TestSceneLock` 覆盖）。

### 3.4 关键词档案（8 个，`assets.go:129`）
`bridalImageKeywordProfiles`，每个含 `promptLine` + `negativeLine`：`realCustomerFitting`、`phoneMirrorSelfieFitting`、`companionFitting`、`fittingPrep`、`fittingServiceDetail`、`brandLaunch`、`storePublishing`、`bridalMaterialProof`。

自动匹配 `getBridalPromptKeywordProfileForParams`（`prompt.go:137`）仅婚纱品类，按 `extraRequirement` 关键词优先级推断（手机->陪同->品牌->预约->顾问->材质->橱窗->真实试纱->兜底 storePublishing）。前端可经 `bridalKeywordProfileId` 显式指定（优先于自动匹配）`prompt.go:295`。

### 3.5 手机对镜自拍系列（最精细设计）
- `buildPhoneMirrorCompositionLine`（`prompt.go:229`）：人物画面占比降到 60-65%，靠拉远镜头而非缩放身体。
- `buildSeriesPhoneContinuityLine`（`prompt.go:238`）：`leadPhoneIndex` 帧建立唯一手机规格 `phoneSpecification`（`assets.go:225`，无品牌石墨色背板、透明壳、三角形三镜头），后续帧严格复用。
- `buildPhoneSeriesShotLine`（`prompt.go:252`）：5 个预设分镜按 index 分配（`assets.go:216`），每帧强调视角独占。

### 3.6 素材镜像约束
`prompt/assets.go` 与前端 `src/data/` 是 1:1 镜像（CLAUDE.md 硬规则 4），改一处必须同步另一处。

---

## 四、WalaAPI 请求体格式（提示词如何传递给大模型）

`wala/client.go:119` `Client.Call`，按是否有参考图分两条路径：

### 4.1 有参考图 -> `POST {apiBaseURL}/images/edits`，`multipart/form-data`（`client.go:134`）
- 字段名固定 `image`，多张同名字段（每张图一个 Blob）`client.go:138`
- 表单字段：`prompt`、`model`（默认 `gpt-image-2`）、`size`（默认 `1152x1536`）、`quality`（默认 `medium`）`client.go:147`
- Header：`Authorization: Bearer ${WALA_API_KEY}`、`Content-Type: writer.FormDataContentType()` `client.go:158`

### 4.2 无参考图 -> `POST {apiBaseURL}/images/generations`，`application/json`（`client.go:161`）
```json
{
  "model": "gpt-image-2",
  "prompt": "<拼好的英文 prompt>",
  "size": "1152x1536",
  "quality": "medium"
}
```

### 4.3 默认值（`client.go:40` `NewClient`）
apiBaseURL 默认 `https://walaapi.net/v1`，model 默认 `gpt-image-2`，timeout 默认 180s，retryAttempts 默认 3，quality 默认 `medium`。缺 apiKey 直接抛 500（`client.go:120`）。

### 4.4 响应解析（`client.go:267` `ExtractGeneratedImages`）
兼容三种形态：`data` 数组 / `data` 对象 / 顶层 `b64_json` 或 `url`。每项取 `b64_json`（兼容 `image_base64`/`base64`）/`url`/`revised_prompt`。`ParseJSONBody`（`client.go:303`）解析失败返回 `{raw: bodyText}`。

---

## 五、图组连续性（首图回传为后续参考图，核心资产）

### 5.1 两类用户参考图 + 两个连续性变量
用户上传分两类（`usecase.go` Generate 解析）：
- **sceneFile（场景参考图）**：0~1 张，可选。传了则整组 `SceneLocked=true`，强制在该场景环境生成。
- **productFiles（婚纱产品图）**：4~6 张，必传。复用其款式与细节（`buildReferenceLine` 约束）。

图组连续性两个变量（`usecase_async.go:161`）：
- **sceneRef（生成图回传的场景参考）**：首张成功生成的图，**仅多图且未传场景图时**赋值（`usecase_async.go:291`）。传了场景图时跳过--场景已被用户场景图锁定，再叠 sceneRef 会形成双场景权威冲突。
- **identityRef（人物参考图）**：首张 `pl.includesPerson` 的成功图。未传场景图时首帧复用 `sceneRef`；传了场景图时 `sceneRef==nil`，首帧也走生成分支建 identityRef（`usecase_async.go:305`）。

### 5.2 参考图组装（每张请求的 requestFiles，`usecase_async.go:181`）
按优先级组装，超 `WalaImageReferenceLimit`（默认 8，可配）截断：
- **传了场景图**：`[sceneFile, identityRef?, ...productFiles]` -- 场景图锁定环境优先，人物一致次之，产品图补足截断尾部。不用 sceneRef。
- **没传场景图**（现有逻辑，上限放开到 refLimit）：首张用 `productFiles`；后续 `[identityRef?, sceneRef?(去重), ...productFiles[:remain]]`。

> Node 时代硬编码 4 张上限已放开为可配置 `WalaImageReferenceLimit`（`config.go` Bridal struct，env `WALA_IMAGE_REFERENCE_LIMIT`，默认 8）。4 张是项目自定义值非 WalaAPI 硬限制，实测真实上限后调整。

### 5.3 转换函数（`usecase.go:228` `generatedImageToReferenceFile`）
把生成图（b64 或 url）转为 `wala.FileInput`。url 图会 `http.Get` 下载后转字节。单张 ≤ 20MB（`wala.MaxContinuityReferenceBytes`，`client.go:92`），超限抛 502。文件名 `recordID-scene.png` / `recordID-identity.png`。

### 5.4 失败即 break
连续性参考图生成失败（下载失败/超 20MB）-> 整任务 `failed` 并 break（保留 Node 语义）。**改这里要极谨慎**（CLAUDE.md 硬规则 5）。

### 5.5 Prompt 层连续性约束（`prompt.go:266` `buildSeriesContinuityLine`）
`total>1` 时注入硬约束--同一物理地点不间断拍摄、保留固定建筑/镜子/光线/服装、输出单张连续照片（排除 collage/split screen 等）。`leadPersonIndex` 帧负责建立唯一模特身份，其余帧"show the exact same woman, not a similar-looking replacement"。

---

## 六、重试机制

### 6.1 可重试判定（`client.go:195` `IsRetryable`）
- HTTP 状态码 `429 / 502 / 503 / 504`
- 或响应体含 `"当前分组上游负载已饱和"` / `"当前分组负载已饱和"`

### 6.2 重试参数（`client.go:225` `CallWithRetries`）
- 次数：`WalaImageRetryAttempts`（默认 3）
- 退避：`retryDelay(attempt) = min(30s, 4s * 2^(attempt-1))` -> 4s/8s/16s/30s（`client.go:205`）
- 非 2xx 且不可重试 -> 立即返回
- 重试用尽仍失败 -> 抛 503 + `BuildOverloadMessage`（`client.go:262`）
- 重试间隔可被 ctx 取消打断

### 6.3 超时（`client.go:124`）
`context.WithTimeout(ctx, c.timeout)`，默认 180s，超时抛 504 `"生图接口超过 N 秒未返回，已中断。"`。httpClient.Timeout 设为 `timeout*2` 留余量（`client.go:58`）。

### 6.4 负载饱和文案（`client.go:214` `BuildOverloadMessage`）
`"WalaAPI 上游负载已饱和，已自动重试 N 次仍未成功..."`。这是用户看到的主要失败原因（03 文档提到失败率约 50%）。

### 6.5 单张失败处理（`usecase_async.go` `generateOne`/`runTask`）
任一张失败（网络错/HTTP 4xx/空图）-> 子图置 failed、`IncCompletedCount`。串行段失败 break，后续 pending 子图标 failed/cancelled；并发段失败已成功图保留，任务标 failed。**已成功的图保留**，前端可拿到部分结果。

### 6.6 跨线路 fallback（`usecase_async.go` `callWithFallback`）
单线路 `CallWithRetries` 耗尽后**不直接失败，而是切下一优先级线路**继续（候选链见 9.2）。仅可重试错误（429/502/503/504/负载饱和）触发切换；不可重试错误（400 等）直接返回。全部线路可重试耗尽才抛 503。两层兜底：线路内重试（6.2）+ 线路间降级。

---

## 七、任务状态机

### 7.1 任务级状态（`generation_tasks.status`，`ent/schema/generationtask.go:36`）
`queued -> processing -> completed / failed / cancelled`
- `queued`：`CreateTask` 入库（`repo_async.go:37`）
- `processing`：`SetTaskStarted`（`repo_async.go:120`）
- `completed`/`failed`：`SetTaskDone`（`repo_async.go:128`）
- `cancelled`：`CancelTask`（用户调，`repo_async.go:231`），worker 循环检测 `IsTaskCancelled`

### 7.2 子图级状态（`generation_images.status`，`ent/schema/generationimage.go:39`）
`pending -> processing -> success / failed / cancelled`
- `pending`：`CreateTask` 预写 N 条占位（`repo_async.go:58`）
- `processing`/`success`/`failed`：`UpdateSubTaskImage`（`repo_async.go:138`）
- `cancelled`：取消/清理时

### 7.3 进度
`generation_tasks.total_count` / `completed_count`（`generationtask.go:46`）。每张完成（含失败）`IncCompletedCount`（`repo_async.go:150`）。前端轮询 `GET /tasks/:id` 拿 `subTaskStatus` 逐张进度（`repo_async.go:79`）。

### 7.4 崩溃恢复（`register.go:24` `InvokeGeneration`）
启动时调 `MarkInterruptedTasksFailed`（`repo_async.go:261`），把所有 `queued`/`processing` 任务标 `failed`（"服务重启，任务中断，请重试。"），子图 `pending`/`processing` 也标 failed。**不自动恢复 goroutine**（goroutine 仅 HTTP 请求时触发），让用户重试，简单可靠。

---

## 八、额度 / 限流扣减

### 8.1 三层前置校验（提交时，`usecase.go` Generate 内）
1. **积分余额**：非 admin 需 `user.Credits >= len(paramsList)`，否则 402 `usecase.go:367`
2. **并发任务限流**：每用户 ≤ 3 个 `queued`/`processing` 任务，否则 429 `usecase.go:374`（`CountActiveTasks` `repo_async.go:249`）
3. **每日额度**：非 admin，上海时区当天已生成 + 本次 > `DailyImageLimit` 则 429 `usecase.go:379`（`CountImagesForDate` `repo.go:156`）

### 8.2 免额度角色（`domain/user.go:149` `HasUnlimitedImageGeneration`）
团队所有者(enterprise) + 系统管理员(admin) 不受每日额度限制。默认额度 20，上限 1000（`domain/user.go:143`、`NormalizeDailyImageLimit` `user.go:155`）。

### 8.3 实际扣减（worker 内，每张成功扣 1，`usecase_async.go:283`）
```go
u.credits.Consume(ctx, user.ID, -1, taskID, "生图消耗（1 张）")
```
- **每张成功扣 1 积分，失败不扣**（注释明确 `usecase_async.go:283`）
- admin 亦记录消耗（不受限但走同一扣减路径）
- `credits.Consume`（`credits/usecase.go:166`）-> `repo.AdjustBalance`（`credits/repo.go:141`）事务：`user.Credits += delta`（不低于 0）+ 写 `credit_transactions`
- **扣减失败仅 Warn，不阻塞生图**（`usecase_async.go:286`）

---

## 九、模型线路（channels，V2 新增，Node 时代无）

### 9.1 数据模型（`ent/schema/modelchannel.go`）
表 `model_channels`，字段：name/apiBaseUrl/apiKey/protocol/modelId/supportedSizes/defaultQuality/isEnabled/isDefault/sortOrder + 统计 totalRequests/successRequests/failedRequests/totalLatencyMs。

### 9.2 线路选择 + 优先级 fallback（`usecase.go` Generate + `usecase_async.go` `buildCandidates`/`callWithFallback`）
- 前端传 `channelId` -> 校验线路存在且 `isEnabled`，否则 400
- 前端未传 -> 回退数据库默认线路（`GetDefaultConfig`）；仍无 -> `channelID=uuid.Nil`
- **候选链构建** `buildCandidates`：用户指定/默认线路排链首，其余启用线路按 `sort_order` 降级（去重）；无任何启用线路 -> `.env` 默认 client（`id=Nil`，不记 stats）
- **跨线路 fallback** `callWithFallback`：按链顺序调 `client.CallWithRetries`；成功（2xx）返回；**可重试失败切下一线路**（429/502/503/504/负载饱和）；**不可重试错误（如 400）直接返回不切**；全部线路可重试耗尽 -> 抛 503 + 最后线路 `BuildOverloadMessage`
- 用户指定线路也参与 fallback（从指定线路起按优先级降级），最大化成功率

### 9.3 候选线路 client 构建（`usecase_async.go` `buildCandidates`）
每个候选线路新建独立 `wala.Client`（线路的 `apiKey/apiBaseUrl/modelId/defaultQuality` + cfg 的 `timeout/retryAttempts`）。`id=uuid.Nil` 的 `.env` 默认 client 不记 stats，其余 `trackStats=true`。

### 9.4 稳定性统计（`channels/repo.go` `IncStats`）
ent `Add*` 原子累加（`SET x=x+n`）。`callWithFallback` 每个被尝试线路调 wala 后调：成功 `IncStats(true, latency)`、失败 `IncStats(false, latency)`。失败线路也记 `failed_requests`，成功率真实反映线路质量。`.env` 默认 client（`id=Nil`）不记。前端 admin 列表展示成功率/平均耗时。

### 9.5 默认线路播种（`channels/usecase.go:251` `SeedDefault`）
启动时若无任何线路，插一条默认（值取自 `.env` 的 `WalaAPIBaseURL/WalaAPIKey/WalaImageModel`）。

---

## 十、图片存储

### 10.1 生成图（`usecase.go:269` `saveGeneratedImages`）
- `remote` 图（有 url）：直接存 url，不下载 `usecase.go:277`
- `local` 图（b64）：解码后 `store.PutImage` 存 MinIO，返回代理路径 `/api/v1/generation/images/{filename}` `usecase.go:288`
- 文件名：`{recordID}-{imageNumber}.png` `usecase.go:294`

### 10.2 imagestore（`backend/biz/generation/imagestore/store.go`）
MinIO/S3 存储，key 前缀 `generated/`（`store.go:18`）。`PutImage` 返回代理路径，`GetImage` 流式读取。ObjectStorage 未启用时 client 为 nil（仅 remote 图可用）`store.go:32`。

### 10.3 参考图（`usecase.go` Generate 存图段）
用户上传的场景图 + 产品图分别存 MinIO（复用 imagestore），文件名 `{recordID}-ref-scene.{ext}` / `{recordID}-ref-product-{n}.{ext}`，存为 `reference_images` JSON 字段（`ent/schema/generationtask.go:53`，元素 `types.ReferenceImage{URL,Name,Kind}`）。`Kind` 区分 `scene`/`product`，旧记录无 Kind 前端兜底当产品图。存储失败仅 Warn，不阻塞生图。

### 10.4 图片代理（`handler.go:111` `ServeImage`）
无鉴权，只取 basename 防路径穿越，`Content-Type: image/png`，`Cache-Control: private, max-age=31536000`（1 年）。

---

## 十一、数据模型（ent schema）

### 11.1 generation_tasks（`ent/schema/generationtask.go:30`）
- 契约字段（对齐 Node sanitizeHistory）：id/user_id/username/status/model/mode/title/body/tags/topic/error/uploaded_image_count/created_at
- V2 异步字段：total_count/completed_count/estimated_seconds/started_at/completed_at/category_id/channel_id/reference_images(JSON)/prompt_hash/latency_ms
- 索引：`(user_id, created_at)`、`created_at` `generationtask.go:59`
- **不用 ent edge**（避免 ent 自动外键列名与 migration 不一致），查询走两步 `generationtask.go:66`

### 11.2 generation_images（`ent/schema/generationimage.go:29`）
- id 为 string 主键（`{recordId}-{imageNumber}`）`generationimage.go:32`
- task_id/name/url/download_url/source(local|remote)/image_number/status/error/latency_ms/created_at
- 索引：`task_id` `generationimage.go:47`

### 11.3 与 Node 时代差异
Node 时代单表 history + images JSON 数组；Go 拆为两表，子图带独立 status/latency_ms，支持逐张进度上报。`sub_task_status` 不存 JSON，由 `generation_images.status` 派生（`repo_async.go:17`）。

---

## 十二、配置项（`backend/config/config.go:102` `Bridal` struct）

环境变量前缀 `MCAI_BRIDAL_`（也兼容原生命名 `WALA_*`，`config.go:491` `applyBridalEnvDefaults`）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `WalaAPIKey` | - | WalaAPI 密钥 |
| `WalaAPIBaseURL` | `https://walaapi.net/v1` | 基址 |
| `WalaImageModel` | `gpt-image-2` | 模型（Node 硬编码，Go 可配） |
| `WalaImageQuality` | `medium` | 默认质量 |
| `WalaImageTimeoutMs` | `180000` (180s) | 单张超时 |
| `WalaImageRetryAttempts` | `3` | 重试次数 |
| `WalaConcurrencyLimit` | `5` | **全局并发上限（V2 新增，Node 无）** |
| `WalaImageReferenceLimit` | `8` | **单次生图传 WalaAPI 参考图张数上限（V2 新增）**：场景图 + 连续性参考 + 产品图按优先级截断，env `WALA_IMAGE_REFERENCE_LIMIT` |

---

## 十三、坑 / 过时点

1. **03/04 知识库文档整体过时**：引用已删除的 `server/index.mjs`、`server/prompt.mjs`，需基于 Go 后端重写（本文即为此）。
2. **`credits/usecase.go:165` 注释过时**：写 "TODO 接入"，实际 `usecase_async.go:284` 已接入。
3. **`stats.go` 的 `statsAdapter` 是遗留**：注释说明原供 bridalauth 调用，bridalauth 移除后保留待复用（`stats.go:14`）。注意 `UserStats` 判断 `t.Status == "success"`（`stats.go:39`），但异步任务终态是 `completed`/`failed`/`cancelled`，**`success` 不会出现**，此统计可能恒为 0，需核实是否被实际调用。
4. **图组连续性改动需极谨慎**（`usecase_async.go` `runTask`）：参考图组装优先级（场景图 > 连续性参考图 > 产品图）、sceneRef/identityRef 复用逻辑、`WalaImageReferenceLimit` 截断，直接决定"同一个人在同一个房间"。2026-07-14 并发改造后：**串行段 0..splitIdx 建参考 + 并发段复用**，sceneRef/identityRef 串行建立后并发只读。回归测试必须覆盖多图生成（含「未传场景图+含人物图」首张建双参考场景）。传场景图与不传两条路径隔离。
5. **prompt/assets.go 与 src/data 是 1:1 镜像**（CLAUDE.md 硬规则 4），改一处必须同步另一处。
6. **ent schema 不用 edge**：避免 ent 自动外键列名与手写 migration 不一致，查询走两步（先 task 再按 task_id 查 images）`ent/schema/generationtask.go:66`。
7. **并发生图并发安全**（2026-07-14 改造）：`IncCompletedCount` 已改 ent 原子 `AddCompletedCount(1)`（原 read-modify-write 并发丢更新）；积分扣减用 per-user `sync.Map` 锁（`Usecase.creditsMu`）串行化，因 `AdjustBalance`（`credits/repo.go`）事务内 Get+SetCredits 非原子，并发会丢扣；`sceneRef`/`identityRef` 串行段建立后并发段只读。**单机部署有效，多实例需改 DB 行锁（FOR UPDATE）**。
8. **线路 fallback 统计语义**：`callWithFallback` 每个被尝试线路都 `IncStats`，跨线路降级时失败线路记 `failed_requests`，故低优先级线路被尝试少、统计样本少属正常。不可重试错误（400）不切线路，直接计入当前线路失败。
