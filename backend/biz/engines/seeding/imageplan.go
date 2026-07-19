package seeding

import (
	"regexp"
	"strings"
)

// 配图计划 + 主入口 + format（1:1 迁移自 TS :2711-3148 + src/data/bridalDressSceneOptions）。
// 依赖 assets（场景映射/xhsContentProfiles/mainSceneByTopic/englishVisualAlignmentByTopic/personImageTypes）。

// englishCueFromChinese 正则（TS :2959-2979）
var (
	reCuePhone      = regexp.MustCompile("手机|自拍|相册")
	reCueMirror     = regexp.MustCompile("对镜|镜前|镜子|反射")
	reCueDistortion = regexp.MustCompile("广角|滤镜|拉腿|失真")
	reCueGarment    = regexp.MustCompile("主纱|婚纱|白纱|礼服|裙子|裙身|上身|试穿|穿上")
	reCueVolume     = regexp.MustCompile("压身|压人|撑不起|体量|显胖|显高|身高")
	reCueDecision   = regexp.MustCompile("喜欢|确定|选择|判断|顾虑|犹豫|排除|适合")
	reCueWaist      = regexp.MustCompile("腰线|收腰|腰腹|比例")
	reCueNeckline   = regexp.MustCompile("领口|肩颈|手臂|胸口")
	reCueSkirt      = regexp.MustCompile("裙摆|拖尾|走动|视频")
	reCueAngle      = regexp.MustCompile("侧面|背影|正面|同角度")
	reCueConsult    = regexp.MustCompile("顾问|钉珠|调整|整理")
	reCueFabric     = regexp.MustCompile("缎面|蕾丝|白纱|面料|材质|珠绣|刺绣")
	reCueVeil       = regexp.MustCompile("头纱|配饰|耳饰|手套")
	reCueSit        = regexp.MustCompile("坐下|敬茶|转身")
	reCuePrivacy    = regexp.MustCompile("隐私|屏幕|聊天|授权")
	reCueRetouch    = regexp.MustCompile("精修|店拍|漂亮|出片")
	reCueRelax      = regexp.MustCompile("放松|紧张|自然|舒服")
	reCueWedding    = regexp.MustCompile("场地|酒店|草坪|教堂|海边|登记|晚宴")
	reCueLifestyle  = regexp.MustCompile("通勤|咖啡|艺术馆|花店|城市|约会|周末|度假|衣橱")
)

func uniqueStrings(items []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(items))
	for _, v := range items {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// englishCueFromChinese TS :2956-2982
func englishCueFromChinese(value string) string {
	var cues []string
	if reCuePhone.MatchString(value) {
		cues = append(cues, "handheld phone-camera evidence")
	}
	if reCueMirror.MatchString(value) {
		cues = append(cues, "full-length mirror reflection")
	}
	if reCueDistortion.MatchString(value) {
		cues = append(cues, "normal lens perspective without beauty-filter distortion")
	}
	if reCueGarment.MatchString(value) {
		cues = append(cues, "worn garment fit evidence")
	}
	if reCueVolume.MatchString(value) {
		cues = append(cues, "skirt volume and body-scale relationship")
	}
	if reCueDecision.MatchString(value) {
		cues = append(cues, "clear visual decision evidence")
	}
	if reCueWaist.MatchString(value) {
		cues = append(cues, "clear waistline and real body proportion")
	}
	if reCueNeckline.MatchString(value) {
		cues = append(cues, "visible neckline, shoulder, and arm line")
	}
	if reCueSkirt.MatchString(value) {
		cues = append(cues, "skirt volume, train length, and natural walking evidence")
	}
	if reCueAngle.MatchString(value) {
		cues = append(cues, "one clearly assigned viewpoint in this frame, with other angles shown only in separate series images")
	}
	if reCueConsult.MatchString(value) {
		cues = append(cues, "consultant adjustment and beading-tool evidence")
	}
	if reCueFabric.MatchString(value) {
		cues = append(cues, "accurate fabric texture and white-gown detail")
	}
	if reCueVeil.MatchString(value) {
		cues = append(cues, "veil and accessory relationship")
	}
	if reCueSit.MatchString(value) {
		cues = append(cues, "sitting, turning, and ceremony-movement comfort")
	}
	if reCuePrivacy.MatchString(value) {
		cues = append(cues, "no readable phone screen or private information")
	}
	if reCueRetouch.MatchString(value) {
		cues = append(cues, "honest non-retouched review value")
	}
	if reCueRelax.MatchString(value) {
		cues = append(cues, "relaxed real-client posture")
	}
	if reCueWedding.MatchString(value) {
		cues = append(cues, "wedding-scene suitability")
	}
	if reCueLifestyle.MatchString(value) {
		cues = append(cues, "wearable lifestyle context")
	}
	unique := uniqueStrings(cues)
	if len(unique) > 4 {
		unique = unique[:4]
	}
	if len(unique) == 0 {
		return "specific visual evidence from the generated post"
	}
	return strings.Join(unique, ", ")
}

// buildEnglishVariantAlignment TS :2984-2997
func buildEnglishVariantAlignment(context CopyAlignmentContext) string {
	var visualRecipeLine string
	if context.Topic == "手机对镜自拍试纱" {
		visualRecipeLine = "Visual evidence: " + context.VisualRecipe.Evidence + "; " + context.VisualRecipe.Detail + ". The camera viewpoint is assigned separately for this frame and must not be replaced by a different angle."
	} else {
		visualRecipeLine = "Visual recipe: " + context.VisualRecipe.Camera + "; " + context.VisualRecipe.Evidence + "; " + context.VisualRecipe.Detail + "."
	}
	parts := []string{
		"Variant-specific cues: focus on " + englishCueFromChinese(context.Focus) + ".",
		"Resolve the viewer concern through " + englishCueFromChinese(context.Concern) + ".",
		"Use visual proof such as " + englishCueFromChinese(context.Proof) + " in " + englishCueFromChinese(context.Scene) + ".",
		"Emphasize detail cues including " + englishCueFromChinese(context.Material) + ".",
		visualRecipeLine,
	}
	return strings.Join(parts, " ")
}

// buildPromptAlignmentRequirement TS :2999-3007
func buildPromptAlignmentRequirement(assets *Assets, draft ImageDraft, context *CopyAlignmentContext) string {
	if context == nil {
		return draft.ExtraRequirement
	}
	return strings.Join([]string{
		draft.ExtraRequirement,
		buildEnglishVariantAlignment(*context),
		"Create it as part of " + assets.EnglishVisualAlignmentByTopic[context.Topic] + ". Keep the result photographic and scene-based, not a text page, instruction sheet, UI screen, poster, or brochure layout. Do not render readable Chinese text, captions, labels, watermarks, or document-style blocks inside the image.",
	}, " ")
}

// buildSeriesContinuityRequirement TS :3011-3032
func buildSeriesContinuityRequirement(assets *Assets, draft ImageDraft, index, imageCount, leadPersonIndex int) string {
	seriesLine := "Series continuity is a hard requirement for image " + intToStr(index+1) + " of " + intToStr(imageCount) + ". " +
		"Keep the exact same physical location and preserve its permanent room architecture, mirror design, curtains, walls, floor, fixed furniture, light direction, color temperature, time of day, and garment design established by the series cover. Recurring movable props must keep the same design, while the client, consultant, phone, veil, train, and small tabletop items may move only as required by the assigned shot. " +
		"Output exactly one continuous photograph with one camera viewpoint and one instance of the main person. This is one separately generated frame in the series, never a collage, split screen, triptych, diptych, contact sheet, before-and-after layout, or multiple-angle composite. " +
		"Treat every image as one assigned camera angle or detail captured during one uninterrupted shoot. Do not move to a material worktable, another room, another storefront, or another outdoor location even if an earlier instruction suggests one."
	if !contains(assets.PersonImageTypes, draft.ImageType) {
		return seriesLine + " This frame may omit the face, but any visible person, hands, hair, or garment must belong to the same model and the same fitting session. Do not introduce another model."
	}
	if index == leadPersonIndex {
		return seriesLine + " Establish one clearly identifiable woman for the complete series. Keep her exact facial identity, age, facial structure, skin tone, hairstyle, hair color, and body proportions unchanged in every later frame where a face appears."
	}
	return seriesLine + " Use the supplied series identity reference as a strict character reference. Show the exact same woman as the cover, with identical facial identity, age, facial structure, skin tone, hairstyle, hair color, and body proportions. Do not generate a lookalike or a different model."
}

// getCompatibleSceneOptions TS src/data getCompatibleSceneOptions + uniqueScenes
func getCompatibleSceneOptions(assets *Assets, productCategory, imageType string) []string {
	var sceneMap map[string][]string
	if productCategory == ProductCategoryBridal {
		sceneMap = assets.BridalScenesByImageType
	} else {
		sceneMap = assets.DressScenesByImageType
	}
	scenes := sceneMap[imageType]
	seen := make(map[string]struct{})
	out := make([]string, 0, len(scenes)+1)
	add := func(s string) {
		if _, ok := seen[s]; ok {
			return
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	add("自动匹配")
	for _, s := range scenes {
		add(s)
	}
	return out
}

// isSceneCompatibleWithImageType TS src/data isSceneCompatibleWithImageType
func isSceneCompatibleWithImageType(assets *Assets, productCategory, imageType, scene string) bool {
	if scene == "自动匹配" {
		return true
	}
	for _, s := range getCompatibleSceneOptions(assets, productCategory, imageType) {
		if s == scene {
			return true
		}
	}
	return false
}

// getCompatibleSceneOrFallback TS :2832-2836
func getCompatibleSceneOrFallback(assets *Assets, baseParams PromptParams, draft ImageDraft, scene string) string {
	if isSceneCompatibleWithImageType(assets, baseParams.ProductCategory, draft.ImageType, scene) {
		return scene
	}
	if isSceneCompatibleWithImageType(assets, baseParams.ProductCategory, draft.ImageType, draft.ScenePreference) {
		return draft.ScenePreference
	}
	return "自动匹配"
}

// resolveAlignedScenePreference TS :2838-2880
func resolveAlignedScenePreference(assets *Assets, baseParams PromptParams, draft ImageDraft, context *CopyAlignmentContext) string {
	if context == nil {
		return getCompatibleSceneOrFallback(assets, baseParams, draft, draft.ScenePreference)
	}
	text := context.Scene
	isMaterialImage := draft.ImageType == "拍摄花絮 / 材质图" || draft.ImageType == "产品静物图"
	fallback := func(scene string) string {
		return getCompatibleSceneOrFallback(assets, baseParams, draft, scene)
	}
	if isMaterialImage {
		if strings.Contains(text, "衣帽间") {
			return fallback("衣帽间")
		}
		if strings.Contains(text, "材质") || strings.Contains(text, "面料") || strings.Contains(text, "桌面") || strings.Contains(text, "挂装") {
			return fallback("材质工作台")
		}
		return fallback(draft.ScenePreference)
	}
	if strings.Contains(text, "试纱") || strings.Contains(text, "镜前") || strings.Contains(text, "顾问") || strings.Contains(text, "头纱") || strings.Contains(text, "候场") {
		return fallback("试纱间")
	}
	if strings.Contains(text, "橱窗") {
		return fallback("婚纱店橱窗")
	}
	if strings.Contains(text, "酒店晨光") || strings.Contains(text, "酒店套房") {
		return fallback("酒店套房晨光")
	}
	if strings.Contains(text, "草坪") {
		return fallback("草坪婚礼")
	}
	if strings.Contains(text, "教堂") {
		return fallback("教堂门口")
	}
	if strings.Contains(text, "登记") {
		return fallback("登记照")
	}
	if strings.Contains(text, "海边") || strings.Contains(text, "度假") {
		if baseParams.ProductCategory == ProductCategoryBridal {
			return fallback("海边旅拍")
		}
		return fallback("度假海边")
	}
	if strings.Contains(text, "入户") {
		return fallback("入户镜前")
	}
	if strings.Contains(text, "写字楼") {
		return fallback("通勤写字楼")
	}
	if strings.Contains(text, "咖啡") {
		return fallback("咖啡馆")
	}
	if strings.Contains(text, "艺术馆") {
		return fallback("艺术馆")
	}
	if strings.Contains(text, "花店") {
		return fallback("花店")
	}
	if strings.Contains(text, "城市街角") {
		return fallback("城市街角")
	}
	if strings.Contains(text, "晚餐") {
		return fallback("晚餐约会")
	}
	if strings.Contains(text, "电梯") {
		return fallback("电梯镜拍")
	}
	if strings.Contains(text, "衣帽间") {
		return fallback("衣帽间")
	}
	return fallback(draft.ScenePreference)
}

// resolveImageModelChoice TS :2882-2899
func resolveImageModelChoice(baseParams PromptParams, draft ImageDraft) string {
	if baseParams.ProductCategory != ProductCategoryBridal {
		return baseParams.ModelChoice
	}
	if draft.ImageType != "产品上身图" && draft.ImageType != "对镜穿搭图" && draft.ImageType != "生活场景图" {
		return baseParams.ModelChoice
	}
	switch draft.BridalKeywordProfileID {
	case "realCustomerFitting", "phoneMirrorSelfieFitting", "companionFitting", "fittingServiceDetail", "storePublishing":
		return "高级婚纱店真实试纱客户"
	}
	return baseParams.ModelChoice
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}

// getBridalImageDrafts TS :2711-2772
func getBridalImageDrafts(assets *Assets, topic string, imageCount int, batchSeed string) []ImageDraft {
	if profile, ok := assets.XiaohongshuBridalContentProfiles[topic]; ok && len(profile.ImageBlueprints) > 0 {
		blueprints := selectBlueprints(profile.ImageBlueprints, assets.BlueprintSelection[topic], imageCount, batchSeed)
		drafts := make([]ImageDraft, 0, len(blueprints))
		for _, bp := range blueprints {
			drafts = append(drafts, ImageDraft{
				Name:                   bp.Name,
				Purpose:                bp.Purpose,
				Description:            bp.Description,
				ImageType:              bp.ImageType,
				ScenePreference:        bp.ScenePreference,
				ExtraRequirement:       bp.ExtraRequirement,
				BridalKeywordProfileID: bp.KeywordProfileID,
			})
		}
		return drafts
	}
	mainScene := orDefault(assets.BridalMainSceneByTopic[topic], "试纱间")
	return []ImageDraft{
		{
			Name:             "图1｜主图｜完整状态",
			Purpose:          "作为内容封面，展示婚纱或礼服的整体比例。",
			Description:      "人物、场景和服装结构同时清楚，保留真实新娘状态。",
			ImageType:        "产品上身图",
			ScenePreference:  mainScene,
			ExtraRequirement: "Create the cover image with the full gown clearly visible, preserving neckline, waistline, skirt volume, hemline, and fabric detail from the reference.",
		},
		{
			Name:             "图2｜情绪｜同一模特风格",
			Purpose:          "补充更接近真实试纱或婚礼前状态的情绪图。",
			Description:      "延续同一模特气质，动作更轻，重点是新娘状态。",
			ImageType:        ternary(topic == "试纱体验", "对镜穿搭图", "生活场景图"),
			ScenePreference:  ternary(topic == "试纱体验", "试纱间", mainScene),
			ExtraRequirement: "Keep a consistent model style with the cover image if a person appears. Capture a quieter emotional moment, not a commercial pose.",
		},
		{
			Name:             "图3｜细节｜面料与工艺",
			Purpose:          "展示蕾丝、缎面、珠绣、裙摆或头纱细节。",
			Description:      "可用于说明材质质感，让内容更可信。",
			ImageType:        "拍摄花絮 / 材质图",
			ScenePreference:  "材质工作台",
			ExtraRequirement: "Focus on fabric close-up, lace pattern, satin drape, veil texture, embroidery, beadwork, hanger, dress rack, sketch notes, and refined tactile details.",
		},
		{
			Name:             "图4｜氛围｜场景铺垫",
			Purpose:          "不强制产品出现，建立婚纱馆或婚礼场景情绪。",
			Description:      "适合做组图过渡，不像广告硬切。",
			ImageType:        "非产品氛围图",
			ScenePreference:  ternary(topic == "法式婚纱", "婚纱店橱窗", mainScene),
			ExtraRequirement: "Create a non-product atmosphere image that may show boutique space, veil, flowers, mirror reflection, morning light, garment rack, or quiet ceremony details.",
		},
		{
			Name:             "图5｜静物｜挂装与配件",
			Purpose:          "收尾展示婚纱静物、衣架、头纱或配件。",
			Description:      "形成可收藏的品牌细节图。",
			ImageType:        "产品静物图",
			ScenePreference:  "材质工作台",
			ExtraRequirement: "Create a refined still life with the dress on a hanger or dress rack, veil, satin, lace, bouquet detail, mood board, and soft daylight. Keep the garment structure accurate.",
		},
	}
}

// getDressImageDrafts TS :2774-2824
func getDressImageDrafts(assets *Assets, topic string) []ImageDraft {
	mainScene := assets.DressMainSceneByTopic[topic]
	mirrorScene := "入户镜前"
	if topic == "通勤裙装" {
		mirrorScene = "电梯镜拍"
	}
	return []ImageDraft{
		{
			Name:             "图1｜主图｜完整穿搭",
			Purpose:          "作为内容封面，展示裙装完整比例和场合感。",
			Description:      "人物状态自然，裙长、腰线和面料垂坠清楚。",
			ImageType:        "产品上身图",
			ScenePreference:  mainScene,
			ExtraRequirement: "Create the cover image with the dress clearly visible, preserving silhouette, waist shape, skirt length, drape, texture, hemline, fit, and styling proportion from the reference.",
		},
		{
			Name:             "图2｜对镜｜比例确认",
			Purpose:          "补充真实穿搭视角，强调比例修饰。",
			Description:      "延续同一模特风格，像出门前确认穿搭。",
			ImageType:        "对镜穿搭图",
			ScenePreference:  mirrorScene,
			ExtraRequirement: "Keep a consistent model style with the cover image if a person appears. Show a realistic mirror outfit moment with clear waistline and skirt length.",
		},
		{
			Name:             "图3｜生活｜场景代入",
			Purpose:          "把裙子放进真实日常或约会场景。",
			Description:      "画面像朋友记录，不要硬凹姿势。",
			ImageType:        "生活场景图",
			ScenePreference:  mainScene,
			ExtraRequirement: "Create a natural lifestyle image with relaxed movement, real-camera composition, and the dress integrated into the setting without over-styling.",
		},
		{
			Name:             "图4｜细节｜面料与垂坠",
			Purpose:          "展示面料、褶裥、裙摆或纹理。",
			Description:      "让用户看清衣服本身，而不是只看氛围。",
			ImageType:        "拍摄花絮 / 材质图",
			ScenePreference:  "材质工作台",
			ExtraRequirement: "Focus on fabric drape, pleats, texture, hemline, print or solid color, hanger, dress rack, swatches, and calm daylight.",
		},
		{
			Name:             "图5｜静物｜衣橱与搭配",
			Purpose:          "收尾展示裙装静物和搭配线索。",
			Description:      "适合做收藏图，提示一条裙子的生活范围。",
			ImageType:        "产品静物图",
			ScenePreference:  "衣帽间",
			ExtraRequirement: "Create a refined still life with the dress on a hanger or dress rack, neutral accessories, fabric close-up, mood board, and organized wardrobe setting.",
		},
	}
}

// getImageDrafts TS :2826-2830
func getImageDrafts(assets *Assets, productCategory, topic string, imageCount int, batchSeed string) []ImageDraft {
	if productCategory == ProductCategoryBridal {
		return getBridalImageDrafts(assets, topic, imageCount, batchSeed)
	}
	return getDressImageDrafts(assets, topic)
}

// buildImagePlan TS :3034-3063
func buildImagePlan(assets *Assets, baseParams PromptParams, draft ImageDraft, index, variantIndex int, context *CopyAlignmentContext, seriesScenePreference string, imageCount, leadPersonIndex int) FashionSeedingImagePlan {
	params := baseParams
	params.ImageType = draft.ImageType
	params.ModelChoice = resolveImageModelChoice(baseParams, draft)
	params.ScenePreference = seriesScenePreference
	params.ExtraRequirement = strings.Join([]string{
		buildPromptAlignmentRequirement(assets, draft, context),
		buildSeriesContinuityRequirement(assets, draft, index, imageCount, leadPersonIndex),
	}, " ")
	params.GenerationNonce = baseParams.GenerationNonce + variantIndex*10 + index + 1
	params.BridalKeywordProfileID = draft.BridalKeywordProfileID
	return FashionSeedingImagePlan{
		Name:        draft.Name,
		Purpose:     draft.Purpose,
		Description: draft.Description,
		Params:      params,
	}
}

// GenerateFashionSeedingContent 生成带标题、正文和标签的完整内容包。
func GenerateFashionSeedingContent(input FashionSeedingInput, assets *Assets) FashionSeedingContent {
	return generateFashionSeedingContent(input, assets, true)
}

// GenerateFashionSeedingImagesOnly 只生成配图计划。不能把旧文案的视觉配方拼入提示词，
// 否则会覆盖 JSON 蓝图为每张图定义的视角、动作和场景差异。
func GenerateFashionSeedingImagesOnly(input FashionSeedingInput, assets *Assets) FashionSeedingContent {
	return generateFashionSeedingContent(input, assets, false)
}

func generateFashionSeedingContent(input FashionSeedingInput, assets *Assets, includeCopy bool) FashionSeedingContent {
	if assets == nil {
		assets = DefaultAssets()
	}
	imageCount := 5
	if input.ImageCount == 3 {
		imageCount = 3
	}
	safeTopic, variantIndex, variantCount, daily := computeScalarFields(input, assets)
	copyDraft := TopicCopyDraft{Titles: []string{}, Tags: []string{}}
	if includeCopy {
		copyDraft = buildCopyFromKit(assets, input.ProductCategory, safeTopic, variantIndex)
	}
	imageDrafts := getImageDrafts(assets, input.ProductCategory, safeTopic, imageCount, safeTopic+"|"+intToStr(variantIndex)+"|"+intToStr(input.ContentNonce))
	if len(imageDrafts) > imageCount {
		imageDrafts = imageDrafts[:imageCount]
	}
	leadPersonIndex := -1
	for i, d := range imageDrafts {
		if contains(assets.PersonImageTypes, d.ImageType) {
			leadPersonIndex = i
			break
		}
	}
	sceneLeadDraft := imageDrafts[0]
	if leadPersonIndex >= 0 {
		sceneLeadDraft = imageDrafts[leadPersonIndex]
	}
	var promptContext *CopyAlignmentContext
	if includeCopy && copyDraft.PromptContext.Topic != "" {
		pc := copyDraft.PromptContext
		promptContext = &pc
	}
	seriesScenePreference := resolveAlignedScenePreference(assets, input.BaseParams, sceneLeadDraft, promptContext)
	images := make([]FashionSeedingImagePlan, len(imageDrafts))
	for i, draft := range imageDrafts {
		images[i] = buildImagePlan(assets, input.BaseParams, draft, i, variantIndex, promptContext, seriesScenePreference, imageCount, leadPersonIndex)
	}
	return FashionSeedingContent{
		Topic:        safeTopic,
		DateKey:      daily.DateKey,
		DailySlot:    daily.DailySlot,
		VariantIndex: variantIndex,
		VariantCount: variantCount,
		VariantLabel: "第 " + intToStr(variantIndex+1) + " / " + intToStr(variantCount) + " 版",
		Titles:       copyDraft.Titles,
		Body:         copyDraft.Body,
		Images:       images,
		Tags:         copyDraft.Tags,
		Note:         copyDraft.Note,
	}
}

// FormatFashionSeedingContent TS :3114-3139
func FormatFashionSeedingContent(content FashionSeedingContent) string {
	parts := []string{
		"# 小红书内容｜" + content.DateKey + "｜第 " + intToStr(content.DailySlot) + " 篇｜" + content.Topic + "｜" + content.VariantLabel,
		"",
		"## 标题备选",
	}
	for i, title := range content.Titles {
		parts = append(parts, intToStr(i+1)+". "+title)
	}
	parts = append(parts, "", "## 正文", content.Body, "", "## 标签", strings.Join(content.Tags, " "), "", "## 内容逻辑", content.Note, "", "## 配图方案")
	for i, image := range content.Images {
		parts = append(parts, "", "### "+intToStr(i+1)+". "+image.Name, "用途："+image.Purpose, "配图建议："+image.Description, "参数："+image.Params.ProductCategory+"｜"+image.Params.ImageType+"｜"+image.Params.ScenePreference+"｜"+image.Params.ModelChoice+"｜"+image.Params.LightPreference)
	}
	return strings.Join(parts, "\n")
}

// FormatFashionSeedingKeywords TS :3141-3148
func FormatFashionSeedingKeywords(content FashionSeedingContent) string {
	parts := make([]string, len(content.Images))
	for i, image := range content.Images {
		parts[i] = "配图 " + intToStr(i+1) + "\n用途：" + image.Purpose + "\n配图建议：" + image.Description + "\n参数：" + image.Params.ProductCategory + "｜" + image.Params.ImageType + "｜" + image.Params.ScenePreference + "｜" + image.Params.ModelChoice + "｜" + image.Params.LightPreference
	}
	return strings.Join(parts, "\n\n---\n\n")
}
