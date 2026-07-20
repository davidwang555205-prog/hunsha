package seeding

import (
	"fmt"
	"sort"
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

// buildContrastSilhouettePool 合成 v3.6.0 蓝图：F01-F05 × E01-E05 × S01-S05 × U01-U10 × V01-V04 各 1 条，
// 总数 5000；按 prefix 前缀分组。用于 v3.6.0 两个策略的测试。
func buildContrastSilhouettePool(prefix string, totalPerCell int) []XhsImageBlueprint {
	out := make([]XhsImageBlueprint, 0)
	idx := 0
	for f := 1; f <= 5; f++ {
		for e := 1; e <= 5; e++ {
			for s := 1; s <= 5; s++ {
				for u := 1; u <= 10; u++ {
					for v := 1; v <= 4; v++ {
						for k := 0; k < totalPerCell; k++ {
							idx++
							name := fmt.Sprintf("%s-%05d｜F0%d-角度｜S0%d-轮廓｜U%02d-动作｜V0%d-支撑｜E0%d-表情",
								prefix, idx, f, s, u, v, e)
							out = append(out, XhsImageBlueprint{Name: name})
						}
					}
				}
			}
		}
	}
	return out
}

// TestSelectBlueprintsContrastSilhouetteAngleAware 对齐 mjs v3.6.0
// contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst：首图 F01-F03 露脸候选、
// S02/S03/S05 + F02/F04/F03/F05 走 angleAware 上半身动作约束、批次内
// angle band / expression / silhouette family 不重复、5 张覆盖 F01-F05 与 S01-S05、
// 3 张从审核过的 5 组家族组合中抽、相同种子确定性复现、count 非 3/5 降级、前缀过滤。
func TestSelectBlueprintsContrastSilhouetteAngleAware(t *testing.T) {
	blueprints := buildContrastSilhouettePool("FTE", 1)
	// 混入非前缀蓝图，验证前缀过滤
	blueprints = append(blueprints, XhsImageBlueprint{Name: "OTHER-001｜F01-正面｜S01-轮廓｜U01-动作｜V01-支撑｜E01-表情"})

	rule := BlueprintSelectionRule{
		Strategy:           "contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst",
		RequiredNamePrefix: "FTE-",
	}

	// 相同 seed 确定性复现（count=3）
	a := selectBlueprints(blueprints, rule, 3, "batch-seed-v360")
	b := selectBlueprints(blueprints, rule, 3, "batch-seed-v360")
	if len(a) != 3 || len(b) != 3 {
		t.Fatalf("want 3 blueprints, got %d / %d", len(a), len(b))
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			t.Fatalf("same seed must be deterministic: %s != %s", a[i].Name, b[i].Name)
		}
	}

	// 首图 F01-F03 露脸候选
	if !isFaceVisibleFirstCandidate(a[0].Name) {
		t.Fatalf("first image must be face-visible (F01-F03), got %s", a[0].Name)
	}

	// 批次内 angle band / expression group / silhouette family 不重复
	bands := map[string]bool{}
	expressions := map[string]bool{}
	families := map[string]bool{}
	for _, bp := range a {
		if !strings.HasPrefix(bp.Name, "FTE-") {
			t.Fatalf("non-pool blueprint leaked: %s", bp.Name)
		}
		fb := angleBand(bp.Name)
		eb := expressionGroup(bp.Name)
		sf := silhouetteFamily(bp.Name)
		if bands[fb] {
			t.Fatalf("angle band duplicated within batch: %s", fb)
		}
		if expressions[eb] {
			t.Fatalf("expression group duplicated within batch: %s", eb)
		}
		if families[sf] {
			t.Fatalf("silhouette family duplicated within batch: %s", sf)
		}
		bands[fb] = true
		expressions[eb] = true
		families[sf] = true
	}

	// angleAware：S02/S03/S05 + F02/F04/F03/F05 必须走配套上半身动作
	for _, bp := range a[1:] {
		if !isAngleCompatibleUpperAction(bp.Name) {
			t.Fatalf("angleAware violation (non-first): %s", bp.Name)
		}
	}

	// count=5 完整覆盖 F01-F05 + S01-S05
	c := selectBlueprints(blueprints, rule, 5, "batch-seed-5-v360")
	if len(c) != 5 {
		t.Fatalf("want 5 blueprints, got %d", len(c))
	}
	bands5 := map[string]bool{}
	families5 := map[string]bool{}
	for _, bp := range c {
		bands5[angleBand(bp.Name)] = true
		families5[silhouetteFamily(bp.Name)] = true
	}
	if len(bands5) != 5 {
		t.Fatalf("5-count batch must cover F01-F05, got %v", bands5)
	}
	if len(families5) != 5 {
		t.Fatalf("5-count batch must cover S01-S05, got %v", families5)
	}

	// count=3 必须从审核过的 5 组家族组合中抽一组
	familyKey := func(fams []string) string {
		cp := append([]string(nil), fams...)
		sort.Strings(cp)
		return strings.Join(cp, "|")
	}
	for _, seedSuffix := range []int{42, 43, 44, 45, 46} {
		sel := selectBlueprints(blueprints, rule, 3, fmt.Sprintf("f3-%d", seedSuffix))
		if len(sel) != 3 {
			t.Fatalf("want 3 blueprints, got %d", len(sel))
		}
		fams := []string{silhouetteFamily(sel[0].Name), silhouetteFamily(sel[1].Name), silhouetteFamily(sel[2].Name)}
		got := familyKey(fams)
		approved := false
		for _, set := range threeImageFamilySets {
			if familyKey(set) == got {
				approved = true
				break
			}
		}
		if !approved {
			t.Fatalf("3-count batch must use approved family set, got %v", fams)
		}
	}

	// count 非 3/5 降级返回原序
	d := selectBlueprints(blueprints, rule, 4, "seed")
	if len(d) != len(blueprints) {
		t.Fatalf("unsupported count must fall back to original order, got %d", len(d))
	}

	// 前缀过滤生效：非候选前缀蓝图永不入选
	for _, seed := range []string{"seed-a", "seed-b", "seed-c"} {
		sel := selectBlueprints(blueprints, rule, 5, seed)
		for _, bp := range sel {
			if !strings.HasPrefix(bp.Name, "FTE-") {
				t.Fatalf("non-pool blueprint leaked: %s", bp.Name)
			}
		}
	}
}

// TestSelectBlueprintsSelfieContrastSilhouette 对齐 mjs v3.6.0
// selfieContrastSilhouetteSamplingWithFaceVisibleFirst：自拍主题不做 angleAware
// 上半身动作约束（F02/F04/F03/F05 可选任意 U01-U10），其余规则与 angleAware 版本一致。
func TestSelectBlueprintsSelfieContrastSilhouette(t *testing.T) {
	blueprints := buildContrastSilhouettePool("PMS", 1)
	rule := BlueprintSelectionRule{
		Strategy:           "selfieContrastSilhouetteSamplingWithFaceVisibleFirst",
		RequiredNamePrefix: "PMS-",
	}

	// 相同 seed 确定性复现（count=3）
	a := selectBlueprints(blueprints, rule, 3, "selfie-seed-1")
	b := selectBlueprints(blueprints, rule, 3, "selfie-seed-1")
	if len(a) != 3 {
		t.Fatalf("want 3 blueprints, got %d", len(a))
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			t.Fatalf("same seed must be deterministic: %s != %s", a[i].Name, b[i].Name)
		}
	}

	// 首图 F01-F03 露脸候选
	if !isFaceVisibleFirstCandidate(a[0].Name) {
		t.Fatalf("first image must be face-visible (F01-F03), got %s", a[0].Name)
	}

	// 批次内不重复
	bands := map[string]bool{}
	expressions := map[string]bool{}
	families := map[string]bool{}
	for _, bp := range a {
		fb := angleBand(bp.Name)
		eb := expressionGroup(bp.Name)
		sf := silhouetteFamily(bp.Name)
		if bands[fb] {
			t.Fatalf("angle band duplicated: %s", fb)
		}
		if expressions[eb] {
			t.Fatalf("expression duplicated: %s", eb)
		}
		if families[sf] {
			t.Fatalf("silhouette duplicated: %s", sf)
		}
		bands[fb] = true
		expressions[eb] = true
		families[sf] = true
	}

	// selfie 不做 angleAware 约束：构造一条 angleAware 不兼容的蓝图仍能入选
	// F04 + S02 + U01（angleAware 要求 U03/U05/U09）应能入选。
	// 同时用同一 odd 蓝图跑 angleAware 策略验证 angleAware 过滤生效。
	odd := XhsImageBlueprint{Name: "PMS-99999｜F04-左侧｜S02-轮廓｜U01-动作｜V01-支撑｜E03-表情"}
	poolWithOdd := append(append([]XhsImageBlueprint{}, blueprints...), odd)

	selfieHit := false
	for i := 0; i < 5000; i++ {
		sel := selectBlueprints(poolWithOdd, rule, 3, fmt.Sprintf("selfie-odd-%d", i))
		for _, bp := range sel {
			if strings.HasPrefix(bp.Name, "PMS-99999") {
				selfieHit = true
				break
			}
		}
		if selfieHit {
			break
		}
	}
	if !selfieHit {
		t.Fatalf("selfie strategy must allow non-angleAware upper-body combos, never selected odd blueprint in 5000 seeds")
	}

	// angleAware 策略：同一 odd 蓝图永不入选（angleAware 过滤生效反证）
	angleRule := BlueprintSelectionRule{
		Strategy:           "contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst",
		RequiredNamePrefix: "PMS-",
	}
	for i := 0; i < 5000; i++ {
		sel := selectBlueprints(poolWithOdd, angleRule, 3, fmt.Sprintf("angle-odd-%d", i))
		for _, bp := range sel {
			if strings.HasPrefix(bp.Name, "PMS-99999") {
				t.Fatalf("angleAware strategy must reject odd (S02+F04+U01), got %s in seed angle-odd-%d", bp.Name, i)
			}
		}
	}
}

// TestSelectBlueprintsContrastSilhouetteFallback 验证候选不足时降级返回原蓝图顺序。
func TestSelectBlueprintsContrastSilhouetteFallback(t *testing.T) {
	// 故意构造缺 S03 的池：first 选 S03 候选为空 → 降级
	blueprints := []XhsImageBlueprint{
		{Name: "FTE-001｜F01-正面｜S01-轮廓｜U01-动作｜V01-支撑｜E01-表情"},
		{Name: "FTE-002｜F02-左前｜S02-轮廓｜U03-动作｜V01-支撑｜E01-表情"},
		{Name: "FTE-003｜F03-右前｜S04-轮廓｜U01-动作｜V01-支撑｜E01-表情"},
		{Name: "FTE-004｜F04-左侧｜S05-轮廓｜U03-动作｜V01-支撑｜E01-表情"},
		{Name: "FTE-005｜F05-右侧｜S04-轮廓｜U01-动作｜V01-支撑｜E01-表情"},
	}
	rule := BlueprintSelectionRule{
		Strategy:           "contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst",
		RequiredNamePrefix: "FTE-",
	}
	for _, seed := range []string{"s1", "s2", "s3", "s4", "s5"} {
		sel := selectBlueprints(blueprints, rule, 3, seed)
		if len(sel) != len(blueprints) {
			t.Fatalf("seed=%s: insufficient candidates must fall back to original order, got %d", seed, len(sel))
		}
	}
}
