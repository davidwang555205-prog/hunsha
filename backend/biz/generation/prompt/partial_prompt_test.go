package prompt

import (
	"strings"
	"testing"
)

func TestPartialPromptGeneration(t *testing.T) {
	p := Params{
		ProductCategory:  "婚纱 / 礼服",
		BridalStyle:      "法式蕾丝婚纱",
		ImageType:        "产品上身图",
		ModelChoice:      "亚洲新娘感模特 25–35",
		Season:           "春",
		ScenePreference:  "试纱间",
		LightPreference:  "室内窗边光",
		CameraScale:      "partial",
		ExtraRequirement: "Frame-filling detail crop: the neckline and embroidery occupy most of the frame.",
	}
	ctx := SeriesContext{Index: 2, Total: 3, LeadPersonIndex: 0, LeadPhoneIndex: -1}

	ir := Compile(ResolvePromptInput(p), ctx, nil)

	// 断言 Composition 动态切换为特写构图指令
	if !strings.Contains(ir.Composition, "tight close-up detail framing") {
		t.Fatalf("expected tight close-up in Composition, got: %s", ir.Composition)
	}

	// 断言 ProductPresence 不强制全身轮廓
	if !strings.Contains(ir.ProductPresence, "full gown silhouette and full body are not required") {
		t.Fatalf("expected relaxed product presence for partial, got: %s", ir.ProductPresence)
	}

	rendered := (&Image2Adapter{}).Render(ir).Prompt
	if !strings.Contains(rendered, "tight close-up detail framing") {
		t.Fatalf("rendered prompt missing close-up composition, got: %s", rendered)
	}
	if !strings.Contains(rendered, "Frame-filling detail crop") {
		t.Fatalf("rendered prompt missing extraRequirement, got: %s", rendered)
	}
}
