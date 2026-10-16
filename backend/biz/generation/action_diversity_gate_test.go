package generation

import (
	"strings"
	"testing"

	"bridal/backend/biz/generation/prompt"
)

func TestValidateGroupActionDiversity(t *testing.T) {
	// 场景 1：两个完全相同的动作族（static_display），必须拦截并点名
	dupParams := []prompt.Params{
		{
			ExtraRequirement: "WHOLE-BODY ACTION — static_display: Face the torso toward the viewer.",
		},
		{
			ExtraRequirement: "WHOLE-BODY ACTION — static_display: Face the torso toward the viewer with different smile.",
		},
	}
	err := validateGroupActionDiversity(dupParams)
	if err == nil {
		t.Fatal("expected error on duplicate action family, got nil")
	}
	if !strings.Contains(err.Error(), "动作族重复（static_display）") {
		t.Fatalf("expected error to name static_display, got: %v", err)
	}

	// 场景 2：完全相同的长动作指令文本，必须拦截
	dupTextParams := []prompt.Params{
		{
			ExtraRequirement: "Custom detailed pose requirement for bridal gown fitting with specific walking gait.",
		},
		{
			ExtraRequirement: "Custom detailed pose requirement for bridal gown fitting with specific walking gait.",
		},
	}
	err = validateGroupActionDiversity(dupTextParams)
	if err == nil {
		t.Fatal("expected error on identical extraRequirement, got nil")
	}
	if !strings.Contains(err.Error(), "动作指令完全重复") {
		t.Fatalf("expected error to mention duplicate instruction, got: %v", err)
	}

	// 场景 3：多样性动作 + 局部特写帧（partial），必须放行
	validWithPartial := []prompt.Params{
		{
			ExtraRequirement: "WHOLE-BODY ACTION — static_display: Face the torso toward the viewer.",
		},
		{
			ExtraRequirement: "WHOLE-BODY ACTION — walking: Move forward with natural stride.",
		},
		{
			CameraScale:      "partial",
			ExtraRequirement: "Frame-filling detail crop: the lace, beading, and neckline occupy most of the frame.",
		},
	}
	if err := validateGroupActionDiversity(validWithPartial); err != nil {
		t.Fatalf("expected valid with partial to pass, got: %v", err)
	}

	// 场景 4：单张图，无条件放行
	single := []prompt.Params{
		{ExtraRequirement: "WHOLE-BODY ACTION — static_display: Single frame."},
	}
	if err := validateGroupActionDiversity(single); err != nil {
		t.Fatalf("single frame should always pass, got: %v", err)
	}
}
