package seeding

import "strings"

// 文案引擎算法（1:1 迁移自 TS :2087-2373）。依赖 assets（数据）+ NarrativePool（narrative.go 模板函数）。

// TitleContext 标题生成上下文（TS :1493-1505）
type TitleContext struct {
	ProductCategory string
	Topic           string
	BaseTitle       string
	AudienceCue     string
	FocusCue        string
	ConcernCue      string
	ProofCue        string
	SceneCue        string
	MaterialCue     string
	Starter         string
	Angle           string
	Closer          string
}

// uniqueItems TS :2087-2089。去重保序，每项先 toPhrase 再过滤空。
func uniqueItems(items []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(items))
	for _, v := range items {
		p := toPhrase(v)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

// ensureBankItems TS :2091-2096。合并去重，保证长度 VariantAxisSize。
func ensureBankItems(items, fallback []string, fallbackLabel string) []string {
	unique := uniqueItems(append(append([]string{}, items...), fallback...))
	safeItems := unique
	if len(safeItems) == 0 {
		safeItems = []string{fallbackLabel}
	}
	out := make([]string, VariantAxisSize)
	for i := 0; i < VariantAxisSize; i++ {
		out[i] = safeItems[i%len(safeItems)]
	}
	return out
}

// getDraftSourcePhrases TS :2098-2102
func getDraftSourcePhrases(assets *Assets, topic string) []string {
	if !IsXiaohongshuBridalTopic(topic) {
		return nil
	}
	drafts := assets.XiaohongshuBridalCopyDrafts[topic]
	out := []string{}
	for _, d := range drafts {
		out = append(out, d.Titles...)
		out = append(out, d.Paragraphs...)
	}
	return out
}

// buildCopyVariationBank TS :2117-2135
func buildCopyVariationBank(assets *Assets, productCategory, topic string, kit TopicCopyKit) CopyVariationBank {
	var categoryBank CopyVariationBank
	if productCategory == ProductCategoryBridal {
		categoryBank = assets.BridalVariationBank
	} else {
		categoryBank = assets.DressVariationBank
	}
	override := assets.XiaohongshuTopicOverrides[topic]
	draftPhrases := getDraftSourcePhrases(assets, topic)
	kitPhrases := concat(draftPhrases, kit.Openings, kit.Observations, kit.Scenes, kit.Closings)
	return CopyVariationBank{
		Audiences: ensureBankItems(override.Audiences, categoryBank.Audiences, topic+"用户"),
		Focuses:   ensureBankItems(concat(override.Focuses, categoryBank.Focuses, kit.Openings), nil, topic+"判断点"),
		Concerns:  ensureBankItems(concat(override.Concerns, categoryBank.Concerns, kit.Observations), nil, topic+"顾虑"),
		Proofs:    ensureBankItems(concat(override.Proofs, categoryBank.Proofs, kitPhrases), nil, topic+"证据"),
		Scenes:    ensureBankItems(concat(override.Scenes, categoryBank.Scenes, kit.Scenes), nil, topic+"场景"),
		Materials: ensureBankItems(concat(override.Materials, categoryBank.Materials, kit.Observations), nil, topic+"细节"),
		Services:  ensureBankItems(override.Services, categoryBank.Services, topic+"动作"),
		Takeaways: ensureBankItems(concat(override.Takeaways, categoryBank.Takeaways, kit.Closings), nil, topic+"收尾"),
		Tones:     ensureBankItems(override.Tones, categoryBank.Tones, topic+"语气"),
		TagExtras: ensureBankItems(override.TagExtras, categoryBank.TagExtras, "#"+topic),
	}
}

// buildVariantTags TS :2163-2170
func buildVariantTags(kit TopicCopyKit, bank CopyVariationBank, axes VariantAxes) []string {
	items := concat(kit.Tags, []string{
		pick(bank.TagExtras, axes.TagA),
		pick(bank.TagExtras, axes.TagB),
		pick(bank.TagExtras, axes.TagC),
	})
	unique := uniqueItems(items)
	if len(unique) > 7 {
		unique = unique[:7]
	}
	return unique
}

// buildVisualRecipe TS :2172-2180
func buildVisualRecipe(assets *Assets, productCategory string, axes VariantAxes) VisualRecipe {
	var recipes VisualRecipes
	if productCategory == ProductCategoryBridal {
		recipes = assets.BridalVisualRecipes
	} else {
		recipes = assets.DressVisualRecipes
	}
	return VisualRecipe{
		Camera:   pick(recipes.Cameras, axes.Primary),
		Evidence: pick(recipes.Evidence, axes.Secondary),
		Detail:   pick(recipes.Details, axes.Tertiary),
	}
}

// buildNarrativeTemplateContext TS :2182-2194
func buildNarrativeTemplateContext(ctx CopyAlignmentContext) NarrativeTemplateContext {
	return NarrativeTemplateContext{
		CopyAlignmentContext: ctx,
		AudienceCue:          narrativeCue(ctx.Audience, 24),
		FocusCue:             narrativeCue(ctx.Focus, 24),
		ConcernCue:           narrativeCue(ctx.Concern, 24),
		ProofCue:             narrativeCue(ctx.Proof, 24),
		SceneCue:             narrativeCue(ctx.Scene, 24),
		MaterialCue:          narrativeCue(ctx.Material, 24),
		ServiceCue:           narrativeCue(ctx.Service, 24),
		TakeawayCue:          narrativeCue(ctx.Takeaway, 24),
	}
}

// getNarrativeType TS :2196-2203
func getNarrativeType(productCategory, topic string) string {
	switch topic {
	case "手机对镜自拍试纱":
		return "phone"
	case "试纱避坑准备":
		return "prep"
	case "试纱陪同视角":
		return "companion"
	case "婚纱品牌发布":
		return "brand"
	case "婚纱店发布":
		return "store"
	}
	if productCategory == ProductCategoryBridal {
		return "bridal"
	}
	return "dress"
}

// buildNarrativeBody TS :2205-2221
func buildNarrativeBody(productCategory string, ctx CopyAlignmentContext, axes VariantAxes) string {
	narrativeType := getNarrativeType(productCategory, ctx.Topic)
	nc := buildNarrativeTemplateContext(ctx)
	openingTemplates := narrativePoolGet(characterMoodOpenings, narrativeType)
	environmentTemplates := narrativePoolGet(environmentDetails, narrativeType)
	productTemplates := narrativePoolGet(productObservationDetails, narrativeType)
	turnTemplates := narrativePoolGet(emotionalTurns, narrativeType)
	closingTemplates := narrativePoolGet(humanClosings, narrativeType)
	parts := []string{
		pickT(openingTemplates, axes.Primary)(nc),
		pickT(environmentTemplates, axes.Secondary)(nc),
		pickT(productTemplates, axes.Tertiary)(nc),
		pickT(turnTemplates, axes.Proof)(nc),
		pickT(closingTemplates, axes.Takeaway)(nc),
	}
	return strings.Join(parts, "\n\n")
}

// buildHumanPromptContext TS :2223-2249
func buildHumanPromptContext(topic, audience, focus, concern, proof, scene, material, service, takeaway, tone string, visualRecipe VisualRecipe) CopyAlignmentContext {
	return CopyAlignmentContext{
		Topic:        topic,
		Audience:     audience,
		Focus:        focus,
		Concern:      concern,
		Proof:        proof,
		Scene:        scene,
		Material:     material,
		Service:      service,
		Takeaway:     takeaway,
		Tone:         tone,
		VisualRecipe: visualRecipe,
	}
}

// buildXiaohongshuDraftCopy TS :2251-2311
func buildXiaohongshuDraftCopy(assets *Assets, productCategory, topic string, kit TopicCopyKit, bank CopyVariationBank, axes VariantAxes) TopicCopyDraft {
	draft := pickT(assets.XiaohongshuBridalCopyDrafts[topic], axes.Primary)
	audience := readableCue(pick(bank.Audiences, axes.Audience))
	focus := readableCue(pick(bank.Focuses, axes.Focus))
	concern := readableCue(pick(bank.Concerns, axes.Concern))
	proof := readableCue(pick(bank.Proofs, axes.Proof))
	scene := readableCue(pick(bank.Scenes, axes.Scene))
	material := readableCue(pick(bank.Materials, axes.Material))
	service := softenAction(pick(bank.Services, axes.Service))
	takeaway := readableCue(pick(bank.Takeaways, axes.Takeaway))
	tone := readableCue(pick(bank.Tones, axes.Tone))
	visualRecipe := buildVisualRecipe(assets, productCategory, axes)
	titleAudience := titleCue(audience, 10)
	shortFocus := titleCue(focus, 10)
	shortConcern := titleCue(concern, 10)
	titleProof := titleCue(proof, 12)
	titleScene := titleCue(scene, 10)
	titleMaterial := titleCue(material, 10)
	baseTitle := pick(draft.Titles, axes.Secondary)
	titleStarter := pick(assets.TitleStarters, axes.Primary)
	titleAngle := pick(assets.TitleAngles, axes.Secondary)
	titleCloser := pick(assets.TitleClosers, axes.Tertiary)
	promptContext := buildHumanPromptContext(topic, audience, focus, concern, proof, scene, material, service, takeaway, tone, visualRecipe)
	return TopicCopyDraft{
		Titles: buildNaturalTitles(TitleContext{
			ProductCategory: productCategory,
			Topic:           topic,
			BaseTitle:       baseTitle,
			AudienceCue:     titleAudience,
			FocusCue:        shortFocus,
			ConcernCue:      shortConcern,
			ProofCue:        titleProof,
			SceneCue:        titleScene,
			MaterialCue:     titleMaterial,
			Starter:         titleStarter,
			Angle:           titleAngle,
			Closer:          titleCloser,
		}),
		Body:          buildNarrativeBody(productCategory, promptContext, axes),
		Tags:          buildVariantTags(kit, bank, axes),
		Note:          "这一版主打" + tone + "，用" + proof + "和" + material + "回应" + audience + "最在意的" + concern + "。",
		PromptContext: promptContext,
	}
}

// buildNaturalTitles TS :1516-1572
func buildNaturalTitles(ctx TitleContext) []string {
	topic := ctx.Topic
	baseTitle := ctx.BaseTitle
	audienceCue := ctx.AudienceCue
	focusCue := ctx.FocusCue
	concernCue := ctx.ConcernCue
	proofCue := ctx.ProofCue
	sceneCue := ctx.SceneCue
	materialCue := ctx.MaterialCue
	starter := ctx.Starter
	angle := ctx.Angle
	closer := ctx.Closer

	if topic == "婚纱品牌发布" {
		return []string{
			cleanTitle(materialCue + "先看清，别急着喊命定"),
			cleanTitle(proofCue + "放前面，回应" + concernCue),
			cleanTitle(sceneCue + "看" + focusCue + "，" + closer),
		}
	}
	if topic == "婚纱店发布" {
		return []string{
			cleanTitle(orDefault(baseTitle, "婚纱店日常") + "，今天拍了" + sceneCue),
			cleanTitle("预约前我会先看" + proofCue),
			cleanTitle(starter + "，别只看装修，也看" + focusCue),
		}
	}
	if topic == "手机对镜自拍试纱" {
		return []string{
			cleanTitle(orDefault(baseTitle, "试纱自拍") + "，手机这张别急着删"),
			cleanTitle(starter + "，先看" + focusCue),
			cleanTitle(proofCue + "留好，" + closer),
		}
	}
	if topic == "试纱避坑准备" {
		return []string{
			cleanTitle(orDefault(baseTitle, "试纱前一天") + "，出门前看一遍"),
			cleanTitle(sceneCue + "这张留好，明天会用到"),
			cleanTitle(audienceCue + "别怕" + concernCue),
		}
	}
	if topic == "试纱陪同视角" {
		return []string{
			cleanTitle(orDefault(baseTitle, "陪她试纱，旁边人先看见变化")),
			cleanTitle(sceneCue + "别删，" + proofCue + "能对上"),
			cleanTitle(audienceCue + "看" + materialCue + "，少说都好看"),
		}
	}
	if ctx.ProductCategory == ProductCategoryBridal {
		return []string{
			cleanTitle(orDefault(baseTitle, starter) + "，试纱时先看" + focusCue),
			cleanTitle(sceneCue + "这张别删，" + proofCue + "很有用"),
			cleanTitle(audienceCue + "先别纠结" + concernCue),
		}
	}
	return []string{
		cleanTitle(starter + "，今天先看" + focusCue),
		cleanTitle(sceneCue + "这张我会留下"),
		cleanTitle(angle + "，尤其是" + materialCue),
	}
}

// buildCopyFromKit TS :2313-2373。文案生成入口。
func buildCopyFromKit(assets *Assets, productCategory, topic string, variantIndex int) TopicCopyDraft {
	kit := assets.TopicCopyKits[topic]
	bank := buildCopyVariationBank(assets, productCategory, topic, kit)
	axes := GetVariantAxes(variantIndex)
	if productCategory == ProductCategoryBridal && IsXiaohongshuBridalTopic(topic) {
		return buildXiaohongshuDraftCopy(assets, productCategory, topic, kit, bank, axes)
	}
	audience := readableCue(pick(bank.Audiences, axes.Audience))
	focus := readableCue(pick(bank.Focuses, axes.Focus))
	concern := readableCue(pick(bank.Concerns, axes.Concern))
	proof := readableCue(pick(bank.Proofs, axes.Proof))
	scene := readableCue(pick(bank.Scenes, axes.Scene))
	material := readableCue(pick(bank.Materials, axes.Material))
	service := softenAction(pick(bank.Services, axes.Service))
	takeaway := readableCue(pick(bank.Takeaways, axes.Takeaway))
	tone := readableCue(pick(bank.Tones, axes.Tone))
	visualRecipe := buildVisualRecipe(assets, productCategory, axes)
	shortAudience := titleCue(audience, 10)
	shortFocus := titleCue(focus, 10)
	shortConcern := titleCue(concern, 10)
	shortProof := titleCue(proof, 12)
	shortScene := titleCue(scene, 10)
	shortMaterial := titleCue(material, 10)
	titleStarter := pick(assets.TitleStarters, axes.Primary)
	titleAngle := pick(assets.TitleAngles, axes.Secondary)
	titleCloser := pick(assets.TitleClosers, axes.Tertiary)
	promptContext := buildHumanPromptContext(topic, audience, focus, concern, proof, scene, material, service, takeaway, tone, visualRecipe)
	return TopicCopyDraft{
		Titles: buildNaturalTitles(TitleContext{
			ProductCategory: productCategory,
			Topic:           topic,
			AudienceCue:     shortAudience,
			FocusCue:        shortFocus,
			ConcernCue:      shortConcern,
			ProofCue:        shortProof,
			SceneCue:        shortScene,
			MaterialCue:     shortMaterial,
			Starter:         titleStarter,
			Angle:           titleAngle,
			Closer:          titleCloser,
		}),
		Body:          buildNarrativeBody(productCategory, promptContext, axes),
		Tags:          buildVariantTags(kit, bank, axes),
		Note:          "本版面向" + audience + "，核心是" + focus + "，用" + proof + "和" + material + "回应" + concern + "；同主题共有 " + intToStr(TopicVariantCount) + " 组组合文案。",
		PromptContext: promptContext,
	}
}
