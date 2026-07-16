package prompt

import (
	"strings"
	"testing"
)

// TestSceneLock 验证传了场景参考图（SceneLocked=true）时 prompt 注入场景锁定行并替换 scene 行。
// 独立于 golden（Node 无此功能，无法 1:1 比对），仅校验关键断言。
// 同时验证 SceneLocked=false 时零行为变化（不出现场景锁定行），与 golden 用例一致。
func TestSceneLock(t *testing.T) {
	base := Params{
		ProductCategory: "婚纱 / 礼服",
		BridalStyle:     "法式蕾丝婚纱",
		ImageType:       "产品上身图",
		ModelChoice:     "亚洲新娘感模特 25–35",
		Season:          "春",
		ScenePreference: "自动匹配",
		LightPreference: "自动匹配",
	}
	ctx := SeriesContext{Index: 0, Total: 1}

	// 关：不应出现场景锁定行（零行为变化，与 golden 一致）
	off := GeneratePrompt(base, ctx, nil)
	if strings.Contains(off, "Scene lock") {
		t.Fatalf("SceneLocked=false 时不应出现场景锁定行\n实际输出:\n%s", off)
	}

	// 开：注入场景锁定行 + 替换 scene 行
	base.SceneLocked = true
	on := GeneratePrompt(base, ctx, nil)
	for _, want := range []string{
		"Scene lock (hard requirement)",
		"the first uploaded image is the scene reference",
		"Scene: reuse the exact environment shown in the uploaded scene reference image.",
	} {
		if !strings.Contains(on, want) {
			t.Errorf("SceneLocked=true 时缺少期望片段 %q\n实际输出:\n%s", want, on)
		}
	}
}
