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
func getCompatibleSceneOptions(productCategory, imageType string) []string {
	var scenes []string
	if productCategory == "裙装 / 女装" {
		scenes = dressScenesByImageType[imageType]
	} else {
		scenes = bridalScenesByImageType[imageType]
	}
	if len(scenes) == 0 {
		return uniqueScenes([]string{"材质工作台"})
	}
	return uniqueScenes(scenes)
}

// resolveScene 解析场景：指定且非自动匹配则直接返回；否则按 generationNonce 轮转兼容场景（与 Node 一致）。
func resolveScene(p Params) string {
	if p.ScenePreference != "" && p.ScenePreference != autoScene {
		return p.ScenePreference
	}
	compatible := getCompatibleSceneOptions(p.ProductCategory, p.ImageType)
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
func getBridalImageKeywordProfile(id string) (keywordProfile, bool) {
	p, ok := bridalImageKeywordProfiles[id]
	return p, ok
}

// getBridalPromptKeywordProfileForParams 婚纱品类按 extraRequirement 关键词优先级推断档案（与 Node 一致）。
// 裙装返回 false（Node 返回 null）。
func getBridalPromptKeywordProfileForParams(p Params, resolvedScene string) (keywordProfile, bool) {
	if p.ProductCategory == "裙装 / 女装" {
		return keywordProfile{}, false
	}
	extra := p.ExtraRequirement
	if includesAny(extra, []string{"phone mirror selfie", "handheld phone", "mirror selfie", "selfie fitting", "手机", "对镜自拍"}) {
		return getBridalImageKeywordProfile("phoneMirrorSelfieFitting")
	}
	if includesAny(extra, []string{"companion-view", "mother or close friend", "朋友", "妈妈", "陪试"}) {
		return getBridalImageKeywordProfile("companionFitting")
	}
	if includesAny(extra, []string{"brand launch", "new collection", "新品", "系列", "发布"}) {
		return getBridalImageKeywordProfile("brandLaunch")
	}
	if includesAny(extra, []string{"appointment card", "checklist", "预约", "清单", "攻略", "避坑"}) {
		return getBridalImageKeywordProfile("fittingPrep")
	}
	if includesAny(extra, []string{"consultant", "adjusting", "beading adjustment", "beading tools", "顾问", "整理", "钉珠", "钉珠道具"}) {
		return getBridalImageKeywordProfile("fittingServiceDetail")
	}
	if contains(materialImageTypes, p.ImageType) {
		return getBridalImageKeywordProfile("bridalMaterialProof")
	}
	if resolvedScene == "婚纱店橱窗" || p.ImageType == "非产品氛围图" {
		return getBridalImageKeywordProfile("storePublishing")
	}
	if p.ModelChoice == "高级婚纱店真实试纱客户" || resolvedScene == "试纱间" || contains(wornImageTypes, p.ImageType) {
		return getBridalImageKeywordProfile("realCustomerFitting")
	}
	return getBridalImageKeywordProfile("storePublishing")
}

// resolveStyleLine 解析款式行（与 Node 一致）：自定义名不含 CJK 时覆盖 style line。
func resolveStyleLine(p Params) string {
	customName := strings.TrimSpace(p.CustomProductName)
	if p.ProductCategory == "裙装 / 女装" {
		if customName != "" && !hasCjkText(customName) {
			return "Product style: " + customName + ". Use it as the exact style name while following the uploaded reference image."
		}
		return "Product style: " + dressStyleLines[p.DressStyle] + "."
	}
	if customName != "" && !hasCjkText(customName) {
		return "Product style: " + customName + ". Use it as the exact style name while following the uploaded reference image."
	}
	return "Product style: " + bridalStyleLines[p.BridalStyle] + "."
}

// buildReferenceLine 参考图细节行（与 Node 一致）。
func buildReferenceLine(productCategory string) string {
	details := bridalReferenceDetails
	if productCategory == "裙装 / 女装" {
		details = dressReferenceDetails
	}
	return "Use the uploaded reference image as the design source. Preserve the reference image's " +
		strings.Join(details, ", ") + ". Do not redesign the garment."
}

// shouldIncludePerson 是否出现人物（与 Node 一致）。
func shouldIncludePerson(p Params) bool {
	if p.ModelChoice == "不指定人物，仅产品静物" {
		return false
	}
	return contains(wornImageTypes, p.ImageType)
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
func buildPhoneMirrorCompositionLine(p Params) string {
	if p.BridalKeywordProfileID != "phoneMirrorSelfieFitting" || !shouldIncludePerson(p) {
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
func buildSeriesContinuityLine(p Params, ctx SeriesContext) string {
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

	if !shouldIncludePerson(p) {
		return sharedSceneLine + " Do not introduce a new model. Any visible hands, hair, body fragment, or reflection must belong to the established series model."
	}
	if index == leadPersonIndex {
		return sharedSceneLine + " Establish the one model identity used by the full series: one clearly identifiable woman with fixed facial structure, age, skin tone, hairstyle, hair color, and body proportions."
	}
	return sharedSceneLine + " The supplied continuity image is a strict identity and location reference. Show the exact same woman, not a similar-looking replacement: identical facial structure, age, skin tone, hairstyle, hair color, and body proportions."
}

// GeneratePrompt 拼装完整 prompt，1:1 对应 Node generatePrompt（prompt.mjs:373-402）。
func GeneratePrompt(p Params, ctx SeriesContext) string {
	resolvedScene := resolveScene(p)
	extraRequirement := strings.TrimSpace(p.ExtraRequirement)

	var profile keywordProfile
	var hasProfile bool
	if p.BridalKeywordProfileID != "" {
		profile, hasProfile = getBridalImageKeywordProfile(p.BridalKeywordProfileID)
	}
	if !hasProfile {
		profile, hasProfile = getBridalPromptKeywordProfileForParams(p, resolvedScene)
	}

	var negativeLines []string
	negativeLines = append(negativeLines, negativeRules...)
	if hasProfile && profile.negativeLine != "" {
		negativeLines = append(negativeLines, profile.negativeLine)
	}

	// 人物行
	modelLine := modelLines["不指定人物，仅产品静物"]
	if shouldIncludePerson(p) {
		if ml, ok := modelLines[p.ModelChoice]; ok && ml != "" {
			modelLine = ml
		} else {
			modelLine = modelLines["亚洲新娘感模特 25–35"]
		}
	}

	// 关键词行
	var keywordLine string
	if hasProfile {
		keywordLine = buildBridalKeywordLine(profile.promptLine)
	}

	// extraRequirement 行：含 CJK 则丢弃
	var extraLine string
	if extraRequirement != "" && !hasCjkText(extraRequirement) {
		extraLine = "Additional visual requirement: " + extraRequirement
	}

	// 各映射表查表失败用 Node 的兜底默认值（与 prompt.mjs 一致）。
	category := categoryLines[p.ProductCategory]
	if category == "" {
		category = categoryLines["婚纱 / 礼服"]
	}
	imageType := imageTypeLines[p.ImageType]
	if imageType == "" {
		imageType = imageTypeLines["产品上身图"]
	}
	scene := sceneLines[resolvedScene]
	if scene == "" {
		scene = sceneLines["材质工作台"]
	}
	season := seasonLines[p.Season]
	if season == "" {
		season = seasonLines["春"]
	}
	light := lightLines[p.LightPreference]
	if light == "" {
		light = lightLines["自动匹配"]
	}

	lines := []string{
		category,
		resolveStyleLine(p),
		imageType,
		buildProductPresenceLine(p),
		buildReferenceLine(p.ProductCategory),
		modelLine,
		scene,
		season,
		light,
		keywordLine,
		buildPhoneMirrorCompositionLine(p),
		buildSeriesPhoneContinuityLine(ctx),
		buildPhoneSeriesShotLine(ctx),
		buildSeriesContinuityLine(p, ctx),
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
