package seeding

import (
	"encoding/json"
	"fmt"
	"testing"
)

// macroTestDims 对齐线上 macro JSON 的五个动作族四维度（movement/orientation/arm/garment）。
var macroTestDims = map[string][4]string{
	"static_display":    {"stationary", "frontal", "lowered", "resting"},
	"walking":           {"stepping", "oblique", "bent", "trailing"},
	"body_turn":         {"turning", "side", "lowered", "asymmetric"},
	"lateral_extension": {"stationary", "oblique", "lateral", "resting"},
	"elevated_forearm":  {"stationary", "side", "raised", "resting"},
}

var macroTestFamilyOrder = []string{"static_display", "walking", "body_turn", "lateral_extension", "elevated_forearm"}

var macroTestFamilyNames = map[string]string{
	"static_display":    "正面完整展示",
	"walking":           "斜向迈步",
	"body_turn":         "整体转身",
	"lateral_extension": "侧向展开手臂",
	"elevated_forearm":  "侧身抬起前臂",
}

var macroTestAllowedFamilies = []string{
	"static_display", "walking", "body_turn", "lateral_extension", "elevated_forearm",
}

// macroTestPool 构造对齐线上 macro JSON 的 25 条蓝图池（5 动作族 × 5 表情变体）。
func macroTestPool(prefix string) []XhsImageBlueprint {
	out := make([]XhsImageBlueprint, 0, 25)
	for i, family := range macroTestFamilyOrder {
		dims := macroTestDims[family]
		for e := 1; e <= 5; e++ {
			out = append(out, XhsImageBlueprint{
				Name: fmt.Sprintf("%s-MACRO-%d-E0%d｜%s", prefix, i+1, e, macroTestFamilyNames[family]),
				Action: &BlueprintAction{
					Family:            family,
					Movement:          dims[0],
					Standing:          true,
					Orientation:       dims[1],
					ArmSilhouette:     dims[2],
					GarmentSilhouette: dims[3],
					ProofSafe:         family == "static_display",
				},
			})
		}
	}
	return out
}

func macroTestRule() BlueprintSelectionRule {
	return BlueprintSelectionRule{
		Strategy:              "macroActionDiversity",
		RequiredNamePrefix:    "PMS-",
		AllowedActionFamilies: macroTestAllowedFamilies,
	}
}

func macroFamilyOf(batch []XhsImageBlueprint) []string {
	families := make([]string, 0, len(batch))
	for _, bp := range batch {
		families = append(families, bp.Action.Family)
	}
	return families
}

func TestSelectMacroActionDiversityThreeImages(t *testing.T) {
	blueprints := macroTestPool("PMS")
	rule := macroTestRule()
	for _, seed := range []string{"seed-a", "seed-b", "seed-c", "seed-d", "seed-e"} {
		got := selectMacroActionBlueprints(blueprints, rule, 3, seed)
		if len(got) != 3 {
			t.Fatalf("seed=%s: len=%d, want 3", seed, len(got))
		}
		// 图1：static_display + frontal + proofSafe 证明帧。
		first := got[0].Action
		if first.Family != "static_display" || first.Orientation != "frontal" || !first.ProofSafe {
			t.Fatalf("seed=%s: first=%+v, want static_display+frontal+proofSafe", seed, first)
		}
		// 三张动作族全不同。
		families := macroFamilyOf(got)
		if families[0] == families[1] || families[0] == families[2] || families[1] == families[2] {
			t.Fatalf("seed=%s: families=%v, want all distinct", seed, families)
		}
		// 图2/图3 与图1在动作维度至少两项不同。
		for i := 1; i < 3; i++ {
			if d := macroActionDistance(got[0].Action, got[i].Action); d < 2 {
				t.Fatalf("seed=%s: image%d distance from first=%d, want >=2", seed, i+1, d)
			}
		}
	}
}

func TestSelectMacroActionDiversityFiveImages(t *testing.T) {
	blueprints := macroTestPool("PMS")
	rule := macroTestRule()
	for _, seed := range []string{"seed-a", "seed-b"} {
		got := selectMacroActionBlueprints(blueprints, rule, 5, seed)
		if len(got) != 5 {
			t.Fatalf("seed=%s: len=%d, want 5", seed, len(got))
		}
		first := got[0].Action
		if first.Family != "static_display" || first.Orientation != "frontal" || !first.ProofSafe {
			t.Fatalf("seed=%s: first=%+v, want static_display+frontal+proofSafe", seed, first)
		}
		// 五个动作族全覆盖且不重复。
		seen := map[string]bool{}
		for _, bp := range got {
			if seen[bp.Action.Family] {
				t.Fatalf("seed=%s: duplicated family %s in %v", seed, bp.Action.Family, macroFamilyOf(got))
			}
			seen[bp.Action.Family] = true
		}
		for _, family := range macroTestFamilyOrder {
			if !seen[family] {
				t.Fatalf("seed=%s: family %s missing in %v", seed, family, macroFamilyOf(got))
			}
		}
	}
}

func TestSelectMacroActionDiversityDeterministicAndVaried(t *testing.T) {
	blueprints := macroTestPool("PMS")
	rule := macroTestRule()

	firstRun := selectMacroActionBlueprints(blueprints, rule, 3, "same-seed")
	secondRun := selectMacroActionBlueprints(blueprints, rule, 3, "same-seed")
	if fmt.Sprint(firstRun) != fmt.Sprint(secondRun) {
		t.Fatalf("same seed must reproduce same batch: %v vs %v", macroFamilyOf(firstRun), macroFamilyOf(secondRun))
	}

	// 多 seed 下选出批次应有多样性（证明帧变体或后两张家族组合随 seed 变化）。
	selections := map[string]bool{}
	for i := 0; i < 16; i++ {
		got := selectMacroActionBlueprints(blueprints, rule, 3, fmt.Sprintf("seed-%d", i))
		names := ""
		for _, bp := range got {
			names += bp.Name + ";"
		}
		selections[names] = true
	}
	if len(selections) < 2 {
		t.Fatalf("16 seeds produced a single selection, want variety")
	}
}

func TestSelectMacroActionDiversityFallbacks(t *testing.T) {
	blueprints := macroTestPool("PMS")
	rule := macroTestRule()

	// count 非 3/5：原样返回。
	if got := selectMacroActionBlueprints(blueprints, rule, 4, "s"); len(got) != len(blueprints) {
		t.Fatalf("count=4: len=%d, want fallback to all %d", len(got), len(blueprints))
	}

	// 无证明帧候选（白名单排除 static_display）：降级返回原池。
	noProof := macroTestPool("PMS")
	noProofRule := rule
	noProofRule.AllowedActionFamilies = []string{"walking", "body_turn", "lateral_extension", "elevated_forearm"}
	if got := selectMacroActionBlueprints(noProof, noProofRule, 3, "s"); len(got) != len(noProof) {
		t.Fatalf("no proof candidates: len=%d, want fallback", len(got))
	}

	// requiredNamePrefix 匹配不到：降级返回原池。
	prefixRule := rule
	prefixRule.RequiredNamePrefix = "ZZZ-"
	if got := selectMacroActionBlueprints(blueprints, prefixRule, 3, "s"); len(got) != len(blueprints) {
		t.Fatalf("prefix mismatch: len=%d, want fallback", len(got))
	}

	// 全部蓝图缺 action 元数据：候选池为空，降级返回原池。
	noAction := make([]XhsImageBlueprint, 0, len(blueprints))
	for _, bp := range blueprints {
		bp.Action = nil
		noAction = append(noAction, bp)
	}
	if got := selectMacroActionBlueprints(noAction, rule, 3, "s"); len(got) != len(noAction) {
		t.Fatalf("no action metadata: len=%d, want fallback", len(got))
	}

	// 非站姿蓝图不进候选池：把 static_display 全改成 standing=false 且无其他证明帧 -> 降级。
	notStanding := macroTestPool("PMS")
	for i := range notStanding {
		if notStanding[i].Action.Family == "static_display" {
			notStanding[i].Action.Standing = false
		}
	}
	if got := selectMacroActionBlueprints(notStanding, rule, 3, "s"); len(got) != len(notStanding) {
		t.Fatalf("no standing proof: len=%d, want fallback", len(got))
	}

	// AllowedActionFamilies 为空 = 不限制，正常工作。
	openRule := rule
	openRule.AllowedActionFamilies = nil
	got := selectMacroActionBlueprints(blueprints, openRule, 3, "s")
	if len(got) != 3 || got[0].Action.Family != "static_display" {
		t.Fatalf("nil allowedActionFamilies: got %v, want 3 images with static_display first", macroFamilyOf(got))
	}
}

func TestSelectBlueprintsDispatchesMacroActionDiversity(t *testing.T) {
	blueprints := macroTestPool("PMS")
	rule := macroTestRule()
	got := selectBlueprints(blueprints, rule, 3, "dispatch-seed")
	if len(got) != 3 {
		t.Fatalf("selectBlueprints dispatch: len=%d, want 3", len(got))
	}
	families := macroFamilyOf(got)
	if families[0] != "static_display" || families[1] == families[2] {
		t.Fatalf("selectBlueprints dispatch: families=%v, want static_display first and distinct rest", families)
	}
}

func TestMacroActionJSONContract(t *testing.T) {
	// 线上 macro JSON 的 action 字段契约：反序列化字段名与类型必须逐字对齐。
	raw := `{
		"name": "PMS-MACRO-1-E01｜正面完整展示",
		"action": {
			"family": "static_display",
			"movement": "stationary",
			"standing": true,
			"phoneSafe": true,
			"proofSafe": true,
			"orientation": "frontal",
			"armSilhouette": "lowered",
			"garmentSilhouette": "resting"
		},
		"extraRequirement": "WHOLE-BODY ACTION — static_display: ..."
	}`
	var bp XhsImageBlueprint
	if err := json.Unmarshal([]byte(raw), &bp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if bp.Action == nil {
		t.Fatal("action must be parsed")
	}
	want := BlueprintAction{
		Family: "static_display", Movement: "stationary", Standing: true, PhoneSafe: true,
		ProofSafe: true, Orientation: "frontal", ArmSilhouette: "lowered", GarmentSilhouette: "resting",
	}
	if *bp.Action != want {
		t.Fatalf("action=%+v, want %+v", *bp.Action, want)
	}

	// 规则契约：allowedActionFamilies 反序列化。
	ruleRaw := `{"strategy":"macroActionDiversity","requiredNamePrefix":"PMS-","allowedActionFamilies":["static_display","walking"]}`
	var rule BlueprintSelectionRule
	if err := json.Unmarshal([]byte(ruleRaw), &rule); err != nil {
		t.Fatalf("unmarshal rule: %v", err)
	}
	if len(rule.AllowedActionFamilies) != 2 || rule.AllowedActionFamilies[1] != "walking" {
		t.Fatalf("allowedActionFamilies=%v, want [static_display walking]", rule.AllowedActionFamilies)
	}
}
