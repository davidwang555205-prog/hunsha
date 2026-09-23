package seeding

import (
	"encoding/json"
	"os"
	"testing"
)

// liveMacroFixture 生产基线 fixtures（testdata/macro-action/，2026-09-23 从 101 生产库
// bridalv2 导出）：婚纱四主题 macro 蓝图（每条带 action 元数据）+ blueprintSelection 规则。
// 线上「三图同动作」事故（JSON 已切 macroActionDiversity 但后端未部署策略支持，回退取
// 前 3 条同动作蓝图）的回归基线：本测试直接对生产数据断言抽样结果的动作多样性。
type liveMacroFixture struct {
	Profiles map[string]struct {
		ImageBlueprints []XhsImageBlueprint `json:"imageBlueprints"`
	} `json:"profiles"`
	Rules map[string]BlueprintSelectionRule `json:"rules"`
}

func loadLiveMacroFixture(t *testing.T) *liveMacroFixture {
	t.Helper()
	profilesRaw, err := os.ReadFile("testdata/macro-action/live_profiles.json")
	if err != nil {
		t.Fatalf("read live_profiles.json: %v", err)
	}
	rulesRaw, err := os.ReadFile("testdata/macro-action/live_rules.json")
	if err != nil {
		t.Fatalf("read live_rules.json: %v", err)
	}
	var profiles map[string]struct {
		ImageBlueprints []XhsImageBlueprint `json:"imageBlueprints"`
	}
	if err := json.Unmarshal(profilesRaw, &profiles); err != nil {
		t.Fatalf("unmarshal live_profiles.json: %v", err)
	}
	var rules map[string]BlueprintSelectionRule
	if err := json.Unmarshal(rulesRaw, &rules); err != nil {
		t.Fatalf("unmarshal live_rules.json: %v", err)
	}
	return &liveMacroFixture{Profiles: profiles, Rules: rules}
}

// TestSelectMacroActionDiversityLiveData 用 101 生产库真实 macro 数据跑抽样：
// 四主题 × count 3/5 × 多 seed，断言动作族多样性与图1 证明帧结构。
func TestSelectMacroActionDiversityLiveData(t *testing.T) {
	fixture := loadLiveMacroFixture(t)
	seeds := []string{"live-a", "live-b", "live-c", "live-d", "live-e", "live-f"}

	topics := make([]string, 0, len(fixture.Rules))
	for topic := range fixture.Rules {
		topics = append(topics, topic)
	}

	for _, topic := range topics {
		rule, ok := fixture.Rules[topic]
		if !ok || rule.Strategy != "macroActionDiversity" {
			t.Fatalf("topic %s: rule=%+v, want macroActionDiversity", topic, rule)
		}
		profile := fixture.Profiles[topic]
		if len(profile.ImageBlueprints) == 0 {
			t.Fatalf("topic %s: no imageBlueprints", topic)
		}
		// 契约完整性：macro 蓝图全部带 action 元数据且 standing=true。
		for _, bp := range profile.ImageBlueprints {
			if bp.Action == nil {
				t.Fatalf("topic %s: blueprint %s missing action metadata", topic, bp.Name)
			}
			if !bp.Action.Standing {
				t.Fatalf("topic %s: blueprint %s standing=false", topic, bp.Name)
			}
		}

		// count=3：图1 证明帧 + 三族不同 + 后两张与图1 至少两项动作维度不同。
		for _, seed := range seeds {
			got := selectBlueprints(profile.ImageBlueprints, rule, 3, seed)
			if len(got) != 3 {
				t.Fatalf("topic %s seed=%s: len=%d, want 3", topic, seed, len(got))
			}
			first := got[0].Action
			if first.Family != "static_display" || first.Orientation != "frontal" || !first.ProofSafe {
				t.Fatalf("topic %s seed=%s: first=%+v, want static_display+frontal+proofSafe", topic, seed, first)
			}
			families := macroFamilyOf(got)
			if families[0] == families[1] || families[0] == families[2] || families[1] == families[2] {
				t.Fatalf("topic %s seed=%s: families=%v, want all distinct", topic, seed, families)
			}
			for i := 1; i < 3; i++ {
				if d := macroActionDistance(got[0].Action, got[i].Action); d < 2 {
					t.Fatalf("topic %s seed=%s: image%d distance=%d, want >=2", topic, seed, i+1, d)
				}
			}
		}

		// count=5：五族全覆盖，图1 仍为证明帧。
		for _, seed := range seeds {
			got := selectBlueprints(profile.ImageBlueprints, rule, 5, seed)
			if len(got) != 5 {
				t.Fatalf("topic %s seed=%s: len=%d, want 5", topic, seed, len(got))
			}
			if got[0].Action.Family != "static_display" || !got[0].Action.ProofSafe {
				t.Fatalf("topic %s seed=%s: first=%+v, want static_display proof", topic, seed, got[0].Action)
			}
			seen := map[string]bool{}
			for _, bp := range got {
				if seen[bp.Action.Family] {
					t.Fatalf("topic %s seed=%s: duplicated family %s", topic, seed, bp.Action.Family)
				}
				seen[bp.Action.Family] = true
			}
			if len(seen) != 5 {
				t.Fatalf("topic %s seed=%s: families=%v, want 5 distinct", topic, seed, macroFamilyOf(got))
			}
		}
	}
}
