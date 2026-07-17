package seeding

import (
	"testing"
	"time"
)

// TestMergeAssets_NilConfig nil/无 seeding config 回退默认（永不阻塞）。
func TestMergeAssets_NilConfig(t *testing.T) {
	def := DefaultAssets()
	merged := MergeAssets(nil, nil)
	if len(merged.BridalVariationBank.Audiences) != len(def.BridalVariationBank.Audiences) {
		t.Fatal("nil config should return default")
	}
	// 无 seeding key
	merged2 := MergeAssets(nil, map[string]any{"imagePrompt": map[string]any{}})
	if len(merged2.BridalVariationBank.Audiences) != len(def.BridalVariationBank.Audiences) {
		t.Fatal("config without seeding should return default")
	}
}

// TestMergeAssets_PartialOverride 部分覆盖：覆盖字段生效，未覆盖字段保留默认。
func TestMergeAssets_PartialOverride(t *testing.T) {
	def := DefaultAssets()
	config := map[string]any{
		"seeding": map[string]any{
			"bridalVariationBank": map[string]any{
				"audiences": []any{"自定义受众A", "自定义受众B"},
			},
		},
	}
	merged := MergeAssets(nil, config)
	// audiences 被整体覆盖
	if len(merged.BridalVariationBank.Audiences) != 2 || merged.BridalVariationBank.Audiences[0] != "自定义受众A" {
		t.Fatalf("audiences should be overridden: %v", merged.BridalVariationBank.Audiences)
	}
	// focuses 未覆盖，保留默认
	if len(merged.BridalVariationBank.Focuses) != len(def.BridalVariationBank.Focuses) {
		t.Fatalf("focuses should remain default: %d vs %d", len(merged.BridalVariationBank.Focuses), len(def.BridalVariationBank.Focuses))
	}
	// dressVariationBank 未覆盖
	if len(merged.DressVariationBank.Audiences) != len(def.DressVariationBank.Audiences) {
		t.Fatal("dressVariationBank should remain default")
	}
}

// TestMergeAssets_TopicOverridePerField per-topic per-field 覆盖：覆盖某主题某字段，其他主题/字段保留。
func TestMergeAssets_TopicOverridePerField(t *testing.T) {
	def := DefaultAssets()
	config := map[string]any{
		"seeding": map[string]any{
			"xiaohongshuTopicOverrides": map[string]any{
				"试纱体验": map[string]any{
					"audiences": []any{"试纱体验自定义受众"},
				},
			},
		},
	}
	merged := MergeAssets(nil, config)
	override := merged.XiaohongshuTopicOverrides["试纱体验"]
	if len(override.Audiences) != 1 || override.Audiences[0] != "试纱体验自定义受众" {
		t.Fatalf("试纱体验.audiences should be overridden: %v", override.Audiences)
	}
	// 试纱体验.focuses 未覆盖，保留 default（若有）或零值
	defOverride := def.XiaohongshuTopicOverrides["试纱体验"]
	if len(override.Focuses) != len(defOverride.Focuses) {
		t.Fatalf("试纱体验.focuses should remain default: %d vs %d", len(override.Focuses), len(defOverride.Focuses))
	}
	// 其他主题（婚纱店发布）保留默认
	storeMerged := merged.XiaohongshuTopicOverrides["婚纱店发布"]
	storeDef := def.XiaohongshuTopicOverrides["婚纱店发布"]
	if len(storeMerged.Audiences) != len(storeDef.Audiences) {
		t.Fatal("婚纱店发布 should remain default")
	}
}

// TestMergeAssets_TitleStartersOverride 覆盖顶层 string[] 字段。
func TestMergeAssets_TitleStartersOverride(t *testing.T) {
	config := map[string]any{
		"seeding": map[string]any{
			"titleStarters": []any{"新开头1", "新开头2"},
		},
	}
	merged := MergeAssets(nil, config)
	if len(merged.TitleStarters) != 2 || merged.TitleStarters[0] != "新开头1" {
		t.Fatalf("titleStarters should be overridden: %v", merged.TitleStarters)
	}
	// titleAngles 未覆盖
	def := DefaultAssets()
	if len(merged.TitleAngles) != len(def.TitleAngles) {
		t.Fatal("titleAngles should remain default")
	}
}

func TestConfiguredTopicOptions_JsonControlsCustomTopicOrderAndDailyTopic(t *testing.T) {
	config := map[string]any{
		"seeding": map[string]any{
			"bridalTopics": []any{"主推轻婚礼", "森系外景试纱"},
		},
	}
	assets := MergeAssets(nil, config)
	topics := GetConfiguredTopicOptions(ProductCategoryBridal, assets)
	if len(topics) != 2 || topics[0] != "主推轻婚礼" || topics[1] != "森系外景试纱" {
		t.Fatalf("configured topics should preserve custom order: %v", topics)
	}

	input := FashionSeedingInput{
		ProductCategory: ProductCategoryBridal,
		Date:            time.Date(2026, 1, 1, 0, 0, 0, 0, ChinaFixedZone()),
	}
	safeTopic, _, _, daily := computeScalarFields(input, assets)
	if safeTopic != daily.Topic || !contains(topics, safeTopic) {
		t.Fatalf("daily topic should come from JSON: safe=%q daily=%q topics=%v", safeTopic, daily.Topic, topics)
	}
	content := GenerateFashionSeedingContent(input, assets)
	if content.Topic != safeTopic || len(content.Titles) == 0 || len(content.Images) == 0 {
		t.Fatalf("custom topic should generate generic content: %#v", content)
	}
}

func TestValidateTopicVisibilityConfig(t *testing.T) {
	valid := map[string]any{
		"seeding": map[string]any{
			"bridalTopics": []any{"新主题", "主题改名后"},
		},
	}
	if err := ValidateTopicVisibilityConfig(valid); err != nil {
		t.Fatalf("valid whitelist should pass: %v", err)
	}

	invalid := map[string]any{
		"seeding": map[string]any{
			"bridalTopics": []any{"重复主题", "重复主题"},
		},
	}
	if err := ValidateTopicVisibilityConfig(invalid); err == nil {
		t.Fatal("duplicate topic should be rejected")
	}
}
