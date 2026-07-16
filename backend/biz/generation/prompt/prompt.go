// Package prompt 实现 bridal 生图 prompt 拼装，1:1 迁移自 server/prompt.mjs。
// 纯函数、确定性：相同输入产生相同 prompt，无随机。
package prompt

import (
	"strings"
)

// Params 生图参数，对应前端 PromptParams（types.ts:81-94）。
type Params struct {
	ProductCategory         string `json:"productCategory"`
	BridalStyle             string `json:"bridalStyle"`
	DressStyle              string `json:"dressStyle"`
	CustomProductName       string `json:"customProductName"`
	ImageType               string `json:"imageType"`
	ModelChoice             string `json:"modelChoice"`
	Season                  string `json:"season"`
	ScenePreference         string `json:"scenePreference"`
	LightPreference         string `json:"lightPreference"`
	ExtraRequirement        string `json:"extraRequirement"`
	GenerationNonce         int    `json:"generationNonce"`
	BridalKeywordProfileID  string `json:"bridalKeywordProfileId"`
	GeneratedImageName      string `json:"generatedImageName"`
	SceneLocked             bool   `json:"sceneLocked"` // 传了场景参考图则 true：强制复用场景图环境生成，跳过场景轮转
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
	Prompt        string
	IncludesPerson bool
	Name          string
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
	if productCategory == "裙装 / 女装" {
		scenes = a.DressScenesByImageType[imageType]
	} else {
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

// getBridalPromptKeywordProfileForParams 婚纱品类按 extraRequirement 关键词优先级推断档案（与 Node 一致）。
// 裙装返回 false（Node 返回 null）。
func getBridalPromptKeywordProfileForParams(p Params, resolvedScene string, a *Assets) (KeywordProfile, bool) {
	if p.ProductCategory == "裙装 / 女装" {
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
	if p.ProductCategory == "裙装 / 女装" {
		if customName != "" && !hasCjkText(customName) {
			return "Product style: " + customName + ". Use it as the exact style name while following the uploaded reference image."
		}
		return "Product style: " + a.DressStyleLines[p.DressStyle] + "."
	}
	if customName != "" && !hasCjkText(customName) {
		return "Product style: " + customName + ". Use it as the exact style name while following the uploaded reference image."
	}
	return "Product style: " + a.BridalStyleLines[p.BridalStyle] + "."
}

// buildReferenceLine 参考图细节行（与 Node 一致）。
func buildReferenceLine(productCategory string, a *Assets) string {
	details := a.BridalReferenceDetails
	if productCategory == "裙装 / 女装" {
		details = a.DressReferenceDetails
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
	if p.ModelChoice == "不指定人物，仅产品静物" {
		return false
	}
	return contains(a.WornImageTypes, p.ImageType)
}

// buildProductPresenceLine 产品存在方式行（与 Node 一致）。
func buildProductPresenceLine(p Params) string {
	switch p.ImageType {
	case "非产品氛围图":
		return "Product presence: optional. The image may show only the atmosphere, boutique space, material mood, preparation details, or emotional context."
	case "拍摄花絮 / 材质图", "产品静物图":
		return "Product presence: show accurate fabric and construction details through fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and clean material surfaces."
	default:
		return "Product presence: the dress or gown should be clearly visible, accurately proportioned, and naturally integrated into the scene."
	}
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

// buildPhoneSeriesShotLine 手机系列镜头行（与 Node 一致）。
func buildPhoneSeriesShotLine(ctx SeriesContext) string {
	if ctx.LeadPhoneIndex < 0 {
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

// buildSeriesContinuityLine 图组连续性行（与 Node 一致）。
func buildSeriesContinuityLine(p Params, ctx SeriesContext, a *Assets) string {
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

	if !shouldIncludePerson(p, a) {
		return sharedSceneLine + " Do not introduce a new model. Any visible hands, hair, body fragment, or reflection must belong to the established series model."
	}
	if index == leadPersonIndex {
		return sharedSceneLine + " Establish the one model identity used by the full series: one clearly identifiable woman with fixed facial structure, age, skin tone, hairstyle, hair color, and body proportions."
	}
	return sharedSceneLine + " The supplied continuity image is a strict identity and location reference. Show the exact same woman, not a similar-looking replacement: identical facial structure, age, skin tone, hairstyle, hair color, and body proportions."
}

// GeneratePrompt 拼装完整 prompt，1:1 对应 Node generatePrompt（prompt.mjs:373-402）。
// assets 为外部配置素材（来自 content_engines.config.imagePrompt），nil 或字段空时 MergeAssets 降级到代码默认。
func GeneratePrompt(p Params, ctx SeriesContext, assets *Assets) string {
	a := MergeAssets(assets)
	resolvedScene := resolveScene(p, a)
	extraRequirement := strings.TrimSpace(p.ExtraRequirement)

	var profile KeywordProfile
	var hasProfile bool
	if p.BridalKeywordProfileID != "" {
		profile, hasProfile = getBridalImageKeywordProfile(p.BridalKeywordProfileID, a)
	}
	if !hasProfile {
		profile, hasProfile = getBridalPromptKeywordProfileForParams(p, resolvedScene, a)
	}

	var negativeLines []string
	negativeLines = append(negativeLines, a.NegativeRules...)
	if hasProfile && profile.NegativeLine != "" {
		negativeLines = append(negativeLines, profile.NegativeLine)
	}

	// 人物行
	modelLine := a.ModelLines["不指定人物，仅产品静物"]
	if shouldIncludePerson(p, a) {
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

	// extraRequirement 行：含 CJK 则丢弃
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
	if p.SceneLocked {
		scene = "Scene: reuse the exact environment shown in the uploaded scene reference image."
		sceneLockLine = buildSceneLockLine()
	}
	season := a.SeasonLines[p.Season]
	if season == "" {
		season = a.SeasonLines["春"]
	}
	light := a.LightLines[p.LightPreference]
	if light == "" {
		light = a.LightLines["自动匹配"]
	}

	lines := []string{
		category,
		resolveStyleLine(p, a),
		imageType,
		buildProductPresenceLine(p),
		buildReferenceLine(p.ProductCategory, a),
		modelLine,
		scene,
		sceneLockLine,
		season,
		light,
		keywordLine,
		buildPhoneMirrorCompositionLine(p, a),
		buildSeriesPhoneContinuityLine(ctx),
		buildPhoneSeriesShotLine(ctx),
		buildSeriesContinuityLine(p, ctx, a),
		brandDirection,
		compositionLine,
		cameraFeelLine,
		"Negative constraints: " + strings.Join(negativeLines, " "),
		extraLine,
	}

	return cleanJoin(lines)
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
