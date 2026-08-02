package engines

import (
	"strings"
	"testing"

	"bridal/backend/biz/engines/seeding"
)

// SeedingPromptHelp 的策略清单必须与 Go 白名单单一事实源逐字同步——
// 这是把文本从前端硬编码迁到后端生成的全部意义：新增策略分支后说明自动带上。
func TestSeedingPromptHelpContainsAllStrategies(t *testing.T) {
	text := SeedingPromptHelp()
	names := seeding.BlueprintStrategyNames()
	if len(names) < 8 {
		t.Fatalf("BlueprintStrategyNames got %d names, want >= 8 (fixed + 7)", len(names))
	}
	for _, name := range names {
		if !strings.Contains(text, name) {
			t.Errorf("seeding prompt help missing strategy %q", name)
		}
	}
	if strings.Contains(text, "{{STRATEGY_LIST}}") {
		t.Error("strategy list placeholder not replaced")
	}
	// 关键规则锚点：静默退回警告 + extraRequirement 中文剔除规则（v3.9.0 事故教训）
	for _, anchor := range []string{"静默退回", "extraRequirement", "自动剔除其中的中文字符"} {
		if !strings.Contains(text, anchor) {
			t.Errorf("seeding prompt help missing anchor %q", anchor)
		}
	}
}

func TestImagePromptHelpAnchors(t *testing.T) {
	text := ImagePromptHelp()
	for _, anchor := range []string{"字段级整体替换", "KeywordProfile", "bridalImageKeywordProfiles", "negativeRules"} {
		if !strings.Contains(text, anchor) {
			t.Errorf("imagePrompt help missing anchor %q", anchor)
		}
	}
}
