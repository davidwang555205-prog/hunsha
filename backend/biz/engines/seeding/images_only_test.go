package seeding

import (
	"strings"
	"testing"
	"time"
)

func TestImagesOnlyUsesJSONBlueprintsWithoutCopyAlignment(t *testing.T) {
	assets := &Assets{
		BridalTopics: []string{"JSON 新主题"},
		XiaohongshuBridalContentProfiles: map[string]XhsContentProfile{
			"JSON 新主题": {
				ImageBlueprints: []XhsImageBlueprint{
					{Name: "JSON-001｜F01-正面", Purpose: "front view", ImageType: "产品上身图", ScenePreference: "试纱间", ExtraRequirement: "BLUEPRINT FRONT VIEW"},
					{Name: "JSON-002｜F02-侧面", Purpose: "side view", ImageType: "生活场景图", ScenePreference: "试纱间", ExtraRequirement: "BLUEPRINT SIDE VIEW"},
					{Name: "JSON-003｜F03-细节", Purpose: "detail view", ImageType: "拍摄花絮 / 材质图", ScenePreference: "材质工作台", ExtraRequirement: "BLUEPRINT DETAIL VIEW"},
				},
			},
		},
		BridalScenesByImageType: map[string][]string{
			"产品上身图":         {"试纱间"},
			"生活场景图":         {"试纱间"},
			"拍摄花絮 / 材质图": {"材质工作台"},
		},
	}
	content := GenerateFashionSeedingImagesOnly(FashionSeedingInput{
		ProductCategory: ProductCategoryBridal,
		Topic:           "JSON 新主题",
		ImageCount:      3,
		Date:            time.Date(2026, 7, 19, 0, 0, 0, 0, ChinaFixedZone()),
		BaseParams:      PromptParams{ProductCategory: ProductCategoryBridal},
	}, assets)

	if len(content.Images) != 3 {
		t.Fatalf("want 3 JSON blueprints, got %d", len(content.Images))
	}
	// ImageDraft.Name 由 buildDisplayImageName 生成（"图N-imageType 简称"，半角连字符），
	// 验 "蓝图被正确加载 + 文案不混入" 的核心断言保留（ExtraRequirement 含 BLUEPRINT、无 Visual recipe）。
	for index, wantName := range []string{"图1-主图", "图2-生活", "图3-细节"} {
		image := content.Images[index]
		if image.Name != wantName {
			t.Fatalf("image %d = %q, want %q", index+1, image.Name, wantName)
		}
		if !strings.Contains(image.Params.ExtraRequirement, "BLUEPRINT") {
			t.Fatalf("image %d lost its JSON blueprint requirement: %q", index+1, image.Params.ExtraRequirement)
		}
		if strings.Contains(image.Params.ExtraRequirement, "Visual recipe:") {
			t.Fatalf("image %d inherited copy alignment: %q", index+1, image.Params.ExtraRequirement)
		}
	}
	if len(content.Titles) != 0 || len(content.Tags) != 0 || content.Body != "" || content.Note != "" {
		t.Fatalf("images-only content must not create copy: %#v", content)
	}
}
