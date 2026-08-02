// Package prompt 实现 bridal 生图 prompt 拼装，1:1 迁移自 server/prompt.mjs。
// 纯函数、确定性：相同输入产生相同 prompt，无随机。
package prompt

import (
	"strings"
)

// ProductSpec 产品规格（P-1 占位透传，P-2 编译为 prompt 行）。
// 对齐 src/types/api.ts ProductSpec 与 seeding.ProductSpec：女鞋/女装请求必带 productTypeKey，婚纱可空。
// JSON round-trip 透传不丢字段（§11.3 同一对象贯通直接生图/内容引擎/Agent emitted params）。
type ProductSpec struct {
	ProductTypeKey string            `json:"productTypeKey"`
	Values         map[string]string `json:"values"`
}

// ModelSelection 模特选择（§3.2）。mode 固定 none/system_random/preset_profile/brand_model/custom_profile；
// model_set 不在 P0 范围。modelSelection 缺失（nil）时走旧 ModelChoice 路径，婚纱 golden 逐字节不变。
// 对齐 src/types/api.ts ModelSelection 与 seeding.ModelSelection，JSON round-trip 透传不丢字段。
type ModelSelection struct {
	Mode              string `json:"mode"`
	BrandModelID      string `json:"brandModelId,omitempty"`
	PresetProfileID   string `json:"presetProfileId,omitempty"`
	CustomAge         int    `json:"customAge,omitempty"`
	CustomDescription string `json:"customDescription,omitempty"`
}

// BrandVisualPick 品牌视觉选择（§3.2）。只接受 allowlist ID（P3 实现），P0 透传不丢字段。
// 对齐 src/types/api.ts BrandVisualPick 与 seeding.BrandVisualPick。
type BrandVisualPick struct {
	BackgroundID string `json:"backgroundId,omitempty"`
	PropID       string `json:"propId,omitempty"`
}

// Params 生图参数，对应前端 PromptParams（types.ts:81-94）。
type Params struct {
	ProductCategory        string `json:"productCategory"`
	BridalStyle            string `json:"bridalStyle"`
	DressStyle             string `json:"dressStyle"`
	ShoeStyle              string `json:"shoeStyle"`
	GarmentStyle           string `json:"garmentStyle"`
	CustomProductName      string `json:"customProductName"`
	ImageType              string `json:"imageType"`
	ModelChoice            string `json:"modelChoice"`
	Season                 string `json:"season"`
	ScenePreference        string `json:"scenePreference"`
	LightPreference        string `json:"lightPreference"`
	ExtraRequirement       string `json:"extraRequirement"`
	GenerationNonce        int    `json:"generationNonce"`
	BridalKeywordProfileID string `json:"bridalKeywordProfileId"`
	GeneratedImageName     string `json:"generatedImageName"`
	SceneLocked            bool   `json:"sceneLocked"` // 传了场景参考图则 true：强制复用场景图环境生成，跳过场景轮转
	// ProductSpec 产品规格（P-1 透传，P-2 编译为 prompt 行）。omitempty 保证婚纱空值不影响 golden。
	ProductSpec *ProductSpec `json:"productSpec,omitempty"`
	// ModelSelection 模特选择（P0 透传，P1 解析）。nil 走旧 ModelChoice，omitempty 保证婚纱 golden 不变。
	ModelSelection *ModelSelection `json:"modelSelection,omitempty"`
	// BrandVisualPick 品牌视觉选择（P0 透传，P3 解析）。omitempty 保证婚纱 golden 不变。
	BrandVisualPick *BrandVisualPick `json:"brandVisualPick,omitempty"`
	// ProductPresence 产品出现方式（P7-1 三档 absent/subtle/life_trace，蓝图 §16.2，A-2a 接入）。
	// 空值=legacy 未启用，走 ImageType 默认分支（D6 婚纱 golden 逐字节不变）。
	ProductPresence string `json:"productPresence,omitempty"`
	// V31Enabled 标记本次请求启用 v3.1 准入流程（A-2：季节权威/产品出现三档指令仅启用品牌附加，D6 golden 零差异）。
	// 由 generation 层 applyV31Plan 按品牌启用状态置位，不进 JSON 契约。
	V31Enabled bool `json:"-"`
}

// SeriesContext 图组上下文，对应 Node seriesContext。
type SeriesContext struct {
	Index           int `json:"index"`
	Total           int `json:"total"`
	LeadPersonIndex int `json:"leadPersonIndex"`
	LeadPhoneIndex  int `json:"leadPhoneIndex"`
}

// PromptPlan generatePrompt 返回的单张图计划。
type PromptPlan struct {
	Prompt         string
	IncludesPerson bool
	Name           string
}

// hasCjkText 判断是否含 CJK 字符，范围 U+3400–U+9FFF（与 Node prompt.mjs:224 一致）。
func hasCjkText(value string) bool {
	for _, r := range value {
		if r >= 0x3400 && r <= 0x9fff {
			return true
		}
	}
	return false
}

// cleanJoin 过滤 falsy 行后用 \n 连接（与 Node cleanJoin 一致）。
func cleanJoin(lines []string) string {
	out := make([]string, 0, len(lines))
	for _, l := range lines {
		if l != "" {
			out = append(out, l)
		}
	}
	return strings.Join(out, "\n")
}

// includesAny 判断 text 是否包含 keywords 中任一（与 Node includesAny 一致）。
func includesAny(text string, keywords []string) bool {
	for _, k := range keywords {
		if strings.Contains(text, k) {
			return true
		}
	}
	return false
}

// contains 切片包含判断。
func contains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

// uniqueScenes autoScene 置首位去重（与 Node uniqueScenes 一致）。
func uniqueScenes(scenes []string) []string {
	out := []string{autoScene}
	seen := map[string]bool{autoScene: true}
	for _, s := range scenes {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// getCompatibleSceneOptions 按 category + imageType 取兼容场景列表（与 Node 一致）。
func getCompatibleSceneOptions(productCategory, imageType string, a *Assets) []string {
	var scenes []string
	switch productCategory {
	case "裙装 / 女装":
		scenes = a.DressScenesByImageType[imageType]
	case "女鞋 / 鞋履":
		scenes = a.ShoeScenesByImageType[imageType]
	case "女装 / 服饰":
		scenes = a.GarmentScenesByImageType[imageType]
	default:
		scenes = a.BridalScenesByImageType[imageType]
	}
	if len(scenes) == 0 {
		return uniqueScenes([]string{"材质工作台"})
	}
	return uniqueScenes(scenes)
}

// resolveScene 解析场景：指定且非自动匹配则直接返回；否则按 generationNonce 轮转兼容场景（与 Node 一致）。
func resolveScene(p Params, a *Assets) string {
	if p.ScenePreference != "" && p.ScenePreference != autoScene {
		return p.ScenePreference
	}
	compatible := getCompatibleSceneOptions(p.ProductCategory, p.ImageType, a)
	// 过滤掉 autoScene（与 Node .filter(s => s !== autoScene) 一致）。
	filtered := make([]string, 0, len(compatible))
	for _, s := range compatible {
		if s != autoScene {
			filtered = append(filtered, s)
		}
	}
	if len(filtered) == 0 {
		return "材质工作台"
	}
	idx := p.GenerationNonce % len(filtered)
	return filtered[idx]
}

// getBridalImageKeywordProfile 按 ID 取档案。
func getBridalImageKeywordProfile(id string, a *Assets) (KeywordProfile, bool) {
	p, ok := a.BridalImageKeywordProfiles[id]
	return p, ok
}

// getImageKeywordProfile 按品类读对应关键词档案 map。女鞋/女装读各自 map，bridal/dress 读 bridal map。
func getImageKeywordProfile(id, productCategory string, a *Assets) (KeywordProfile, bool) {
	switch productCategory {
	case "女鞋 / 鞋履":
		p, ok := a.ShoeImageKeywordProfiles[id]
		return p, ok
	case "女装 / 服饰":
		p, ok := a.GarmentImageKeywordProfiles[id]
		return p, ok
	default:
		return getBridalImageKeywordProfile(id, a)
	}
}

// getBridalPromptKeywordProfileForParams 婚纱品类按 extraRequirement 关键词优先级推断档案（与 Node 一致）。
// 裙装返回 false（Node 返回 null）。
func getBridalPromptKeywordProfileForParams(p Params, resolvedScene string, a *Assets) (KeywordProfile, bool) {
	if p.ProductCategory != "婚纱 / 礼服" {
		return KeywordProfile{}, false
	}
	extra := p.ExtraRequirement
	if includesAny(extra, []string{"phone mirror selfie", "handheld phone", "mirror selfie", "selfie fitting", "手机", "对镜自拍"}) {
		return getBridalImageKeywordProfile("phoneMirrorSelfieFitting", a)
	}
	if includesAny(extra, []string{"companion-view", "mother or close friend", "朋友", "妈妈", "陪试"}) {
		return getBridalImageKeywordProfile("companionFitting", a)
	}
	if includesAny(extra, []string{"brand launch", "new collection", "新品", "系列", "发布"}) {
		return getBridalImageKeywordProfile("brandLaunch", a)
	}
	if includesAny(extra, []string{"appointment card", "checklist", "预约", "清单", "攻略", "避坑"}) {
		return getBridalImageKeywordProfile("fittingPrep", a)
	}
	if includesAny(extra, []string{"consultant", "adjusting", "beading adjustment", "beading tools", "顾问", "整理", "钉珠", "钉珠道具"}) {
		return getBridalImageKeywordProfile("fittingServiceDetail", a)
	}
	if contains(a.MaterialImageTypes, p.ImageType) {
		return getBridalImageKeywordProfile("bridalMaterialProof", a)
	}
	if resolvedScene == "婚纱店橱窗" || p.ImageType == "非产品氛围图" {
		return getBridalImageKeywordProfile("storePublishing", a)
	}
	if p.ModelChoice == "高级婚纱店真实试纱客户" || resolvedScene == "试纱间" || contains(a.WornImageTypes, p.ImageType) {
		return getBridalImageKeywordProfile("realCustomerFitting", a)
	}
	return getBridalImageKeywordProfile("storePublishing", a)
}

// resolveStyleLine 解析款式行（与 Node 一致）：自定义名不含 CJK 时覆盖 style line。
func resolveStyleLine(p Params, a *Assets) string {
	customName := strings.TrimSpace(p.CustomProductName)
	if customName != "" && !hasCjkText(customName) {
		return "Product style: " + customName + ". Use it as the exact style name while following the uploaded reference image."
	}
	switch p.ProductCategory {
	case "裙装 / 女装":
		return "Product style: " + a.DressStyleLines[p.DressStyle] + "."
	case "女鞋 / 鞋履":
		return "Product style: " + a.ShoeStyleLines[p.ShoeStyle] + "."
	case "女装 / 服饰":
		return "Product style: " + a.GarmentStyleLines[p.GarmentStyle] + "."
	default:
		return "Product style: " + a.BridalStyleLines[p.BridalStyle] + "."
	}
}

// buildReferenceLine 参考图细节行（与 Node 一致）。
func buildReferenceLine(productCategory string, a *Assets) string {
	details := a.BridalReferenceDetails
	switch productCategory {
	case "裙装 / 女装":
		details = a.DressReferenceDetails
	case "女鞋 / 鞋履":
		details = a.ShoeReferenceDetails
	case "女装 / 服饰":
		details = a.GarmentReferenceDetails
	}
	return "Use the uploaded reference image as the design source. Preserve the reference image's " +
		strings.Join(details, ", ") + ". Do not redesign the garment."
}

// buildSceneLockLine 场景锁定行（传了场景参考图时注入）：强制复用场景图环境，不得换场景。
// 与 buildReferenceLine 配合：场景锁定行管"在哪个场景"，参考图细节行管"衣服长啥样"。
func buildSceneLockLine() string {
	return "Scene lock (hard requirement): the first uploaded image is the scene reference. " +
		"Strictly reuse its exact environment, background, architecture, furniture, light direction, " +
		"color temperature, and overall composition framing. Place the garment and any model into this " +
		"precise scene. Do not relocate to another room, location, or setting under any circumstance."
}

// shouldIncludePerson 是否出现人物（与 Node 一致）。
func shouldIncludePerson(p Params, a *Assets) bool {
	if IsNonProductAtmosphere(p.ImageType) {
		return false
	}
	if p.ModelChoice == "不指定人物，仅产品静物" {
		return false
	}
	return contains(a.WornImageTypes, p.ImageType)
}

// IsNonProductAtmosphere 是业务蓝图声明非产品氛围任务的通用识别契约。
// JSON 只需将 imageType 设为该稳定值；平台负责保证人物/产品不会成为 prompt 或参考图主体。
func IsNonProductAtmosphere(imageType string) bool {
	return imageType == "非产品氛围图"
}

// brandVisualAppliesToImageType R13：BrandVisual 段（mood/tone/studio set）仅对棚拍/非产品氛围等适用场景注入（§4 P3）。
// 适用集：非人物上身图类（PersonImageTypes 之外的 imageType，含空值默认），如非产品氛围图、拍摄花絮/材质图、产品静物图。
// 人物上身图类（产品上身图/对镜穿搭图/生活场景图）不注入品牌棚拍视觉，与人物图拍摄语境冲突。
// Negatives（brandVisual.negativeRules）不受此门禁，仍对所有场景注入（负面约束不冲突场景）。
func brandVisualAppliesToImageType(imageType string) bool {
	return !PersonImageTypes[imageType]
}

// buildProductPresenceLine 产品存在方式行（与 Node 一致）。
// A-2a：启用品牌 ProductPresence=subtle/life_trace 时在英文行后附加三档中文指令；
// absent/空走 ImageType 默认分支（D6 婚纱 golden 逐字节不变）。
// 中文指令文本与 generation.ProductPresenceDirective 同源（C-3 双源标注）。
func buildProductPresenceLine(p Params) string {
	base := ""
	switch p.ImageType {
	case "非产品氛围图":
		base = "Non-product atmosphere contract (hard requirement): do not show any product, shoe, garment, logo, person, body part, face, hand, reflection, mannequin, or product packaging. Use uploaded product references only as abstract color, material, texture, and emotional-mood evidence."
	case "拍摄花絮 / 材质图", "产品静物图":
		base = "Product presence: show accurate fabric and construction details through fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and clean material surfaces."
	default:
		base = "Product presence: the dress or gown should be clearly visible, accurately proportioned, and naturally integrated into the scene."
	}
	if p.V31Enabled {
		switch p.ProductPresence {
		case "subtle":
			return base + "\n产品以低视觉权重陪衬：非中心、非完整陈列、自然融入环境；不得主体居中、独立打光或商品目录感。"
		case "life_trace":
			return base + "\n产品作为使用后的生活线索：有合理行为链与接触关系；不得刻意摆放、广告陈列或产品主导构图。"
		}
	}
	return base
}

// seasonAuthorityDirective 季节权威指令文本（A-2b，蓝图 §16.3 季节 > 产品配色）。
// 空季节返回空（不附加，D6 未启用零差异）。文本与 generation.SeasonAuthorityDirective 同源（C-3 双源标注）。
func seasonAuthorityDirective(season string) string {
	s := normalizeSeasonInline(season)
	if s == "" {
		return ""
	}
	return "整体季节感以" + s + "为准，产品保持自身真实颜色，不得反向影响整体季节表现。"
}

// normalizeSeasonInline 季节归一化（与 generation.normalizeSeason 同源，C-3 双源标注）。
func normalizeSeasonInline(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "春", "spring":
		return "春"
	case "夏", "summer":
		return "夏"
	case "秋", "autumn", "fall":
		return "秋"
	case "冬", "winter":
		return "冬"
	}
	return ""
}

// buildBridalKeywordLine 关键词行（去掉 "Xiaohongshu [^:]+ keywords:" 前缀，与 Node 一致）。
func buildBridalKeywordLine(promptLine string) string {
	// Node: promptLine.replace(/^Xiaohongshu [^:]+ keywords:\s*/i, "")
	idx := strings.Index(strings.ToLower(promptLine), "xiaohongshu ")
	if idx == 0 {
		rest := promptLine[len("Xiaohongshu "):]
		colon := strings.Index(rest, ":")
		if colon >= 0 {
			promptLine = strings.TrimSpace(rest[colon+1:])
		}
	}
	return "Include visual cues such as " + promptLine
}

// buildPhoneMirrorCompositionLine 手机对镜构图行（与 Node 一致）。
func buildPhoneMirrorCompositionLine(p Params, a *Assets) string {
	if p.BridalKeywordProfileID != "phoneMirrorSelfieFitting" || !shouldIncludePerson(p, a) {
		return ""
	}
	return "Phone mirror composition: use a wider environmental shot. Reduce the person's apparent frame scale by 20 percent compared with conventional full-body selfie framing, so the full person occupies about 60 to 65 percent of the image height. " +
		"Include substantially more of the fitting-room mirror, curtains, floor around the train, garment rack, and surrounding environment. Keep normal adult anatomy, head-to-body ratio, limb length, and body proportions; create the smaller on-canvas subject only through greater camera distance and wider framing, never by shrinking or distorting the body."
}

// buildSeriesPhoneContinuityLine 手机身份连续性行（与 Node 一致）。
func buildSeriesPhoneContinuityLine(ctx SeriesContext) string {
	leadPhoneIndex := ctx.LeadPhoneIndex
	if leadPhoneIndex < 0 {
		return ""
	}
	index := ctx.Index
	if index == leadPhoneIndex {
		return "Phone identity continuity (hard requirement): establish exactly " + phoneSpecification + " as the only phone used throughout this series."
	}
	return "Phone identity continuity (hard requirement): if a phone appears anywhere in this frame, it must be the exact same physical device established in the first selfie frame: " + phoneSpecification + ". " +
		"Use the supplied continuity image as the strict phone reference. Preserve the identical back color, case material and edge color, lens count, lens size, triangular camera arrangement, flash position, dimensions, and lack of accessories. Never substitute a similar phone or redesign it."
}

// buildPhoneSeriesShotLine 手机系列镜头行（与 Node 一致；v3.9.0 起 PMS 帧不输出，见 prompt3.9.0.mjs）。
func buildPhoneSeriesShotLine(ctx SeriesContext, isPhoneMirrorSelfie bool) string {
	if ctx.LeadPhoneIndex < 0 {
		return ""
	}
	// PMS blueprints already carry the authoritative angle and full-length selfie
	// instruction. A generic series shot plan would override those assignments.
	if isPhoneMirrorSelfie {
		return ""
	}
	index := ctx.Index
	if index < 0 || index >= len(phoneSeriesShotPlans) {
		return ""
	}
	assigned := phoneSeriesShotPlans[index]
	return "Assigned camera viewpoint (hard requirement): create only " + assigned + ". " +
		"This viewpoint is unique to frame " + intToStr(index+1) + "; do not reuse the viewpoint assigned to another frame, and do not combine multiple viewpoints in one image."
}

// buildSeriesContinuityLine 图组连续性行（与 Node 一致，v3.9.0 起非首张人物图采用 prompt3.9.0.mjs 强化版
// "连续性参考图仅为身份/服装颜色/位置参考，不是姿态/机身角度/取景参考"指令，见 MJS-CHANGELOG-v3.9.0）。
// D6（§16.4.6 IdentityLock 闭环）：identityLock 非空时（仅 brand_model 路径，由 resolver 填充）追加到身份句，
// 强化系列内身份一致；legacy/preset/custom 路径 identityLock 为空 -> 不改变现有行为（婚纱 golden 逐字节不变）。
func buildSeriesContinuityLine(p Params, ctx SeriesContext, a *Assets, identityLock string) string {
	total := ctx.Total
	if total <= 1 {
		return ""
	}
	index := ctx.Index
	leadPersonIndex := ctx.LeadPersonIndex

	sharedSceneLine := "Series continuity (hard requirement, image " + intToStr(index+1) + " of " + intToStr(total) + "): this is one uninterrupted shoot in the exact same physical location described above. " +
		"Preserve the permanent room architecture, mirror design, curtains, walls, floor, fixed furniture, light direction, color temperature, time of day, garment design, styling, and fitting-session atmosphere across the complete image set. Recurring movable props must keep the same design, while the client, consultant, phone, veil, train, and small tabletop items may move only as required by the assigned shot. " +
		"This request must output exactly one continuous photograph with one camera viewpoint and one instance of the main person. It is one frame in a separately generated series, not a collage, split screen, triptych, diptych, contact sheet, or before-and-after layout. " +
		"Change only camera distance, crop, the single assigned angle, pose, or the detail being documented. Any conflicting request to move to another room, worktable, storefront, or outdoor location must be ignored."

	// D6：brand_model 身份锁（受控英文，仅 brand_model 路径非空）追加到含人物的身份句，强化身份一致。
	lockLine := ""
	if identityLock != "" {
		lockLine = " Identity lock (hard requirement): " + identityLock + "."
	}

	if !shouldIncludePerson(p, a) {
		return sharedSceneLine + " Do not introduce a new model. Any visible hands, hair, body fragment, or reflection must belong to the established series model."
	}
	if index == leadPersonIndex {
		return sharedSceneLine + " Establish the one model identity used by the full series: one clearly identifiable woman with fixed facial structure, age, skin tone, hairstyle, hair color, and body proportions." + lockLine
	}
	return sharedSceneLine + " The supplied continuity image is a strict identity, garment color, and location reference ONLY — it is NOT a pose, body angle, or camera framing reference. The assigned camera viewpoint and body action for THIS image are authoritative and may differ significantly in camera distance, body angle, arm position, head direction, and composition framing. Do not copy the body angle, arm position, hand silhouette, head direction, or camera distance from the continuity reference. Show the exact same woman, not a similar-looking replacement: identical facial structure, age, skin tone, hairstyle, hair color, and body proportions." + lockLine
}

// Compile 产 CanonicalPrompt IR（纯函数、确定性）。原有 20 段拼装逻辑搬进这里填 IR 字段，
// 不再 cleanJoin 成 string。IR 自包含，异步阶段只需 IR + 线路 ModelID 即可 Render。
// assets 为外部配置素材（来自 content_engines.config.imagePrompt），nil 或字段空时 MergeAssets 降级到代码默认。
// 输入为 ResolvedPromptInput（§11.4 P0-04）：Usecase 在 Compile 前完成授权/查库/schema 校验并构建 resolved；
// Compile 不接收 repo/DB/context/raw 三对象。P0 过渡：Base 经 toLegacyParams 还原为 Params 调既有 helper。
func Compile(input ResolvedPromptInput, ctx SeriesContext, assets *Assets) *CanonicalPrompt {
	a := MergeAssets(assets)
	p := input.Base.toLegacyParams()
	nonProductAtmosphere := IsNonProductAtmosphere(p.ImageType)
	resolvedScene := resolveScene(p, a)
	extraRequirement := strings.TrimSpace(p.ExtraRequirement)

	var profile KeywordProfile
	var hasProfile bool
	if p.BridalKeywordProfileID != "" {
		profile, hasProfile = getImageKeywordProfile(p.BridalKeywordProfileID, p.ProductCategory, a)
	}
	if !hasProfile {
		profile, hasProfile = getBridalPromptKeywordProfileForParams(p, resolvedScene, a)
	}

	var negativeLines []string
	negativeLines = append(negativeLines, a.NegativeRules...)
	if hasProfile && profile.NegativeLine != "" {
		negativeLines = append(negativeLines, profile.NegativeLine)
	}
	// P1-03：ModelSelection 非 nil 时追加 resolved Model.NegativePhrases（身份负面约束，如 underage）。
	if !nonProductAtmosphere && input.Model.HasPerson != nil {
		negativeLines = append(negativeLines, input.Model.NegativePhrases...)
	}
	// P3-02：品牌视觉负面词追加（brandVisual.negativeRules）。
	negativeLines = append(negativeLines, input.BrandVisual.Negatives...)

	// 人物行
	modelLine := a.ModelLines["不指定人物，仅产品静物"]
	if input.Model.HasPerson != nil {
		// P1-03：ModelSelection 非 nil 时用 resolved Model.PromptLine（受控身份行），不走 legacy ModelLines。
		// none mode PromptLine 为空 -> 静物；其余 mode 为受控人物行（preset/brand_model/custom）。
		modelLine = input.Model.PromptLine
	} else if shouldIncludePerson(p, a) {
		if ml, ok := a.ModelLines[p.ModelChoice]; ok && ml != "" {
			modelLine = ml
		} else {
			modelLine = a.ModelLines["亚洲新娘感模特 25–35"]
		}
	}

	// 关键词行
	var keywordLine string
	if hasProfile {
		keywordLine = buildBridalKeywordLine(profile.PromptLine)
	}

	// extraRequirement 行：含 CJK 则丢弃（保留 "Additional visual requirement: " 前缀存入 IR.Extra）
	var extraLine string
	if extraRequirement != "" && !hasCjkText(extraRequirement) {
		extraLine = "Additional visual requirement: " + extraRequirement
	}

	// 各映射表查表失败用 Node 的兜底默认值（与 prompt.mjs 一致）。
	category := a.CategoryLines[p.ProductCategory]
	if category == "" {
		category = a.CategoryLines["婚纱 / 礼服"]
	}
	imageType := a.ImageTypeLines[p.ImageType]
	if imageType == "" {
		imageType = a.ImageTypeLines["产品上身图"]
	}
	scene := a.SceneLines[resolvedScene]
	if scene == "" {
		scene = a.SceneLines["材质工作台"]
	}
	// 传了场景参考图：场景由场景图决定，跳过预设场景描述，改用场景锁定行强制复用环境。
	sceneLockLine := ""
	if p.SceneLocked && !nonProductAtmosphere {
		scene = "Scene: reuse the exact environment shown in the uploaded scene reference image."
		sceneLockLine = buildSceneLockLine()
	}
	// P2-05：Reference 段追加 single_item 稳定搭配 + series lock（PairingLine 空 -> legacy 不变）。
	reference := buildReferenceLine(p.ProductCategory, a)
	if input.Product.PairingLine != "" {
		reference = reference + " " + input.Product.PairingLine
	}
	if nonProductAtmosphere {
		reference = "Reference contract: use uploaded product images only for abstract palette, material, texture, light, and emotional-mood cues. Do not reproduce, display, crop, silhouette, or imply the product itself."
		modelLine = ""
	}
	// P3-02/R13：BrandVisual 段（mood/tone/studio set）仅对棚拍/非产品氛围等适用场景注入；
	// 人物上身图类（PersonImageTypes：产品上身图/对镜穿搭图/生活场景图）不注入（与人物图拍摄语境冲突）。
	// scene lock 时省略 studio set（场景图权威，不被棚拍覆盖）。Negatives 不受此门禁（负面约束不冲突场景）。
	var brandVisualParts []string
	if brandVisualAppliesToImageType(p.ImageType) {
		if input.BrandVisual.MoodLine != "" {
			brandVisualParts = append(brandVisualParts, input.BrandVisual.MoodLine)
		}
		if input.BrandVisual.ToneLine != "" {
			brandVisualParts = append(brandVisualParts, input.BrandVisual.ToneLine)
		}
		if !p.SceneLocked && input.BrandVisual.StudioSetLine != "" {
			brandVisualParts = append(brandVisualParts, input.BrandVisual.StudioSetLine)
		}
	}
	brandVisual := strings.Join(brandVisualParts, " ")
	season := a.SeasonLines[p.Season]
	if season == "" {
		season = a.SeasonLines["春"]
	}
	// A-2b：启用品牌季节时附加季节权威指令（季节 > 产品配色，V31Enabled+空季节不附加，D6 golden 零差异）。
	if p.V31Enabled {
		if d := seasonAuthorityDirective(p.Season); d != "" {
			season = season + "\n" + d
		}
	}
	light := a.LightLines[p.LightPreference]
	if light == "" {
		light = a.LightLines["自动匹配"]
	}

	productLine := input.Product.ProductLine
	styleLine := resolveStyleLine(p, a)
	seriesContinuity := buildSeriesContinuityLine(p, ctx, a, input.Model.IdentityLock)
	if nonProductAtmosphere {
		productLine = ""
		styleLine = ""
		seriesContinuity = ""
		extraLine = ""
		keywordLine = ""
		sceneLockLine = ""
		negativeLines = append(negativeLines, "No product, shoe, garment, logo, packaging, mannequin, person, face, body part, hand, reflection, or product-like silhouette.")
	}
	phoneMirror := buildPhoneMirrorCompositionLine(p, a)
	seriesPhoneContinuity := buildSeriesPhoneContinuityLine(ctx)
	phoneShot := buildPhoneSeriesShotLine(ctx, p.BridalKeywordProfileID == "phoneMirrorSelfieFitting")
	if nonProductAtmosphere {
		phoneMirror = ""
		seriesPhoneContinuity = ""
		phoneShot = ""
	}

	return &CanonicalPrompt{
		Category:              category,
		Style:                 styleLine,
		ImageType:             imageType,
		ProductPresence:       buildProductPresenceLine(p),
		Product:               productLine,
		Reference:             reference,
		Model:                 modelLine,
		Scene:                 scene,
		SceneLock:             sceneLockLine,
		Season:                season,
		Light:                 light,
		Keyword:               keywordLine,
		PhoneMirror:           phoneMirror,
		SeriesPhoneContinuity: seriesPhoneContinuity,
		PhoneShot:             phoneShot,
		SeriesContinuity:      seriesContinuity,
		BrandDirection:        brandDirection,
		BrandVisual:           brandVisual,
		Composition:           compositionLine,
		CameraFeel:            cameraFeelLine,
		Extra:                 extraLine,
		Negatives:             negativeLines,
		Meta: PromptMeta{
			SceneLocked:          p.SceneLocked && !nonProductAtmosphere,
			HasPerson:            shouldIncludePerson(p, a),
			NonProductAtmosphere: nonProductAtmosphere,
			IsPhoneMirror:        p.BridalKeywordProfileID == "phoneMirrorSelfieFitting",
			SeriesIndex:          ctx.Index,
			SeriesTotal:          ctx.Total,
			LeadPersonIndex:      ctx.LeadPersonIndex,
			LeadPhoneIndex:       ctx.LeadPhoneIndex,
			KeywordProfileID:     p.BridalKeywordProfileID,
		},
	}
}

// GeneratePrompt 保持原签名，内部 ResolvePromptInput + Compile + Image2Adapter.Render，保证 golden 逐字节不变。
// 供 golden 测试 + 未接 adapter 路径兜底；调用方需按线路渲染方言时直接 Compile(ResolvePromptInput(p), ...) + SelectAdapter(modelID).Render。
func GeneratePrompt(p Params, ctx SeriesContext, assets *Assets) string {
	return (&Image2Adapter{}).Render(Compile(ResolvePromptInput(p), ctx, assets)).Prompt
}

// intToStr 简单整数转字符串（避免引入 strconv 仅此一处）。
func intToStr(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	if neg {
		b = append([]byte{'-'}, b...)
	}
	return string(b)
}
