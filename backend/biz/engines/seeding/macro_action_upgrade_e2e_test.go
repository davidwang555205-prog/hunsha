package seeding

import (
	"strings"
	"testing"

	"bridal/backend/biz/generation/prompt"
)

// TestMacroActionDiversityWithPartialE2E 端到端验证：
// 1. 抽样阶段：基于线上生产真实蓝图库注入 partial 蓝图，3 档时稳定产出 [证明帧, 差异动作帧, 局部特写帧]；
// 2. 编译阶段：局部特写帧的提示词中，Composition 动态替换为 close-up 特写构图，ProductPresence 解耦完整轮廓；
// 3. 全身动作帧：提示词中完整保留 WHOLE-BODY ACTION 动作指令与 balanced crop 全貌构图。
func TestMacroActionDiversityWithPartialE2E(t *testing.T) {
	fixture := loadLiveMacroFixture(t)
	topic := "试纱体验"
	profile := fixture.Profiles[topic]
	rule := fixture.Rules[topic]

	// 注入婚纱局部细节特写蓝图（领口与胸衣珠绣特写）
	partialBlueprint := XhsImageBlueprint{
		Name:             "FTE-MACRO-PARTIAL-E01｜领口与胸衣珠绣特写",
		Purpose:          "展示领口珠绣与蕾丝面料细节",
		Description:      "领口胸衣手工珠绣微距细节图",
		ImageType:        "产品上身图",
		CameraScale:      "partial",
		ExtraRequirement: "Frame-filling detail crop: the neckline, beading, and lace embroidery occupy most of the frame; for this frame only, the complete product silhouette is NOT required; no full body, no face.",
	}
	blueprints := append(profile.ImageBlueprints, partialBlueprint)

	// 1. 抽样验证 (count=3)
	got := selectMacroActionBlueprints(blueprints, rule, 3, "batch-seed-e2e-live-1")
	if len(got) != 3 {
		t.Fatalf("len=%d, want 3", len(got))
	}
	if got[0].Action.Family != "static_display" {
		t.Fatalf("frame 1: got family %s, want static_display", got[0].Action.Family)
	}
	if got[1].Action.Family == "static_display" {
		t.Fatalf("frame 2: should have distinct action, got %s", got[1].Action.Family)
	}
	if got[2].CameraScale != "partial" {
		t.Fatalf("frame 3: got cameraScale %s, want partial", got[2].CameraScale)
	}

	// 2. 模拟前端参数打包成 prompt.Params 并传入编译层
	var paramsList []prompt.Params
	for i, bp := range got {
		p := prompt.Params{
			ProductCategory:  "婚纱 / 礼服",
			BridalStyle:      "法式蕾丝婚纱",
			ImageType:        bp.ImageType,
			CameraScale:      bp.CameraScale,
			ExtraRequirement: bp.ExtraRequirement,
			GenerationNonce:  i + 1,
		}
		paramsList = append(paramsList, p)
	}

	// 3. 编译验证
	for i, p := range paramsList {
		ctx := prompt.SeriesContext{Index: i, Total: len(paramsList), LeadPersonIndex: 0, LeadPhoneIndex: -1}
		ir := prompt.Compile(prompt.ResolvePromptInput(p), ctx, nil)
		rendered := (&prompt.Image2Adapter{}).Render(ir).Prompt

		if p.CameraScale == "partial" {
			// 局部特写帧断言
			if !strings.Contains(rendered, "tight close-up detail framing") {
				t.Fatalf("frame %d: partial prompt missing close-up framing directive", i+1)
			}
			if !strings.Contains(rendered, "full gown silhouette and full body are not required") {
				t.Fatalf("frame %d: partial prompt did not decouple full silhouette", i+1)
			}
		} else {
			// 全身动作帧断言
			if !strings.Contains(rendered, "balanced crop, natural posture if a person appears") {
				t.Fatalf("frame %d: whole-body prompt missing standard balanced crop", i+1)
			}
			if !strings.Contains(rendered, "WHOLE-BODY ACTION —") {
				t.Fatalf("frame %d: whole-body prompt missing action directive", i+1)
			}
		}
	}
}
