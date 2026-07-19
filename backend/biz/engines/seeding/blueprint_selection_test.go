package seeding

import (
	"fmt"
	"strings"
	"testing"
)

func TestSelectBlueprintsFamilySamplingIsDeterministicAndDistinct(t *testing.T) {
	blueprints := []XhsImageBlueprint{
		{Name: "A｜F01-a"}, {Name: "B｜F01-b"}, {Name: "C｜F02-a"},
		{Name: "D｜F03-a"}, {Name: "E｜F04-a"}, {Name: "F｜F05-a"},
	}
	rule := BlueprintSelectionRule{Strategy: "familySampling"}
	first := selectBlueprints(blueprints, rule, 3, "same-seed")
	second := selectBlueprints(blueprints, rule, 3, "same-seed")
	if len(first) != 3 || len(second) != 3 {
		t.Fatalf("want 3 blueprints")
	}
	seen := map[string]bool{}
	for index, bp := range first {
		if seen[blueprintFamily(bp.Name)] {
			t.Fatalf("family duplicated: %s", bp.Name)
		}
		seen[blueprintFamily(bp.Name)] = true
		if bp.Name != second[index].Name {
			t.Fatal("same seed must be deterministic")
		}
	}
}

func TestSelectBlueprintsKeepsRequiredBlueprint(t *testing.T) {
	blueprints := []XhsImageBlueprint{
		{Name: "PMS-001｜F01-front"}, {Name: "B｜F02-a"}, {Name: "C｜F03-a"}, {Name: "D｜F04-a"},
	}
	selected := selectBlueprints(blueprints, BlueprintSelectionRule{Strategy: "familySamplingWithRequiredFirst", RequiredNamePrefix: "PMS-001｜F01-"}, 3, "seed")
	found := false
	for _, bp := range selected {
		found = found || bp.Name == "PMS-001｜F01-front"
	}
	if !found {
		t.Fatal("required blueprint must be selected")
	}
}

// TestSelectBlueprintsAngleBandExpressionFaceVisibleFirst 对齐 mjs v3.3.0
// angleBandExpressionSamplingWithFaceVisibleFirst：首图 F01-F03 露脸、批次内
// 角度带与微表情组不重复、5 张覆盖 F01-F05、相同种子确定性复现。
func TestSelectBlueprintsAngleBandExpressionFaceVisibleFirst(t *testing.T) {
	blueprints := make([]XhsImageBlueprint, 0, 101)
	for f := 1; f <= 5; f++ {
		for e := 1; e <= 5; e++ {
			for k := 0; k < 4; k++ {
				name := fmt.Sprintf("PMS-%03d｜F0%d-角度%d｜A0%d-动作｜E0%d-表情%d", f*100+e*10+k, f, f, k, e, e)
				blueprints = append(blueprints, XhsImageBlueprint{Name: name})
			}
		}
	}
	// 非候选前缀，验证 requiredNamePrefix 前缀过滤生效
	blueprints = append(blueprints, XhsImageBlueprint{Name: "OTHER-001｜F01-正面主图｜A01-动作｜E01-表情"})

	rule := BlueprintSelectionRule{Strategy: "angleBandExpressionSamplingWithFaceVisibleFirst", RequiredNamePrefix: "PMS-"}

	// 相同种子确定性复现（count=3）
	a := selectBlueprints(blueprints, rule, 3, "batch-seed-xyz")
	b := selectBlueprints(blueprints, rule, 3, "batch-seed-xyz")
	if len(a) != 3 || len(b) != 3 {
		t.Fatalf("want 3 blueprints, got %d / %d", len(a), len(b))
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			t.Fatalf("same seed must be deterministic: %s != %s", a[i].Name, b[i].Name)
		}
	}

	// 首图必须 F01-F03 露脸候选
	if !isFaceVisibleFirstCandidate(a[0].Name) {
		t.Fatalf("first image must be face-visible (F01-F03), got %s", a[0].Name)
	}

	// 批次内 angle band / expression group 不重复，且不泄漏非候选前缀蓝图
	bands := map[string]bool{}
	expressions := map[string]bool{}
	for _, bp := range a {
		if !strings.HasPrefix(bp.Name, "PMS-") {
			t.Fatalf("non-pool blueprint leaked: %s", bp.Name)
		}
		fb := angleBand(bp.Name)
		eb := expressionGroup(bp.Name)
		if bands[fb] {
			t.Fatalf("angle band duplicated within batch: %s", fb)
		}
		if expressions[eb] {
			t.Fatalf("expression group duplicated within batch: %s", eb)
		}
		bands[fb] = true
		expressions[eb] = true
	}

	// count=5 完整覆盖 F01-F05
	c := selectBlueprints(blueprints, rule, 5, "batch-seed-5")
	if len(c) != 5 {
		t.Fatalf("want 5 blueprints, got %d", len(c))
	}
	bands5 := map[string]bool{}
	for _, bp := range c {
		bands5[angleBand(bp.Name)] = true
	}
	if len(bands5) != 5 {
		t.Fatalf("5-count batch must cover F01-F05, got %v", bands5)
	}

	// count 非 3/5 降级返回原序
	d := selectBlueprints(blueprints, rule, 4, "seed")
	if len(d) != len(blueprints) {
		t.Fatalf("unsupported count must fall back to original order, got %d", len(d))
	}
}
