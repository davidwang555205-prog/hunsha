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

// TestSelectBlueprintsV370BatchDistinction 对齐 mjs v3.7.0
// contrastSilhouetteAngleAwareWithBatchDistinction：抽样算法与 v3.6.0 完全一致，
// 仅策略名变更（prompt 层追加批次动作区分约束，不影响抽样）。验证新策略名分支
// 行为：确定性复现、首图 F01-F03 露脸、批次内 band/expression/family 不重复、
// angleAware 上半身动作约束、count=5 覆盖 F01-F05+S01-S05、count 非 3/5 降级、前缀过滤。
func TestSelectBlueprintsV370BatchDistinction(t *testing.T) {
	blueprints := buildContrastSilhouettePool("FTE", 1)
	blueprints = append(blueprints, XhsImageBlueprint{Name: "OTHER-001｜F01-正面｜S01-轮廓｜U01-动作｜V01-支撑｜E01-表情"})
	rule := BlueprintSelectionRule{
		Strategy:           "contrastSilhouetteAngleAwareWithBatchDistinction",
		RequiredNamePrefix: "FTE-",
	}

	a := selectBlueprints(blueprints, rule, 3, "v370-seed")
	b := selectBlueprints(blueprints, rule, 3, "v370-seed")
	if len(a) != 3 || len(b) != 3 {
		t.Fatalf("want 3 blueprints, got %d / %d", len(a), len(b))
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			t.Fatalf("same seed must be deterministic: %s != %s", a[i].Name, b[i].Name)
		}
	}

	if !isFaceVisibleFirstCandidate(a[0].Name) {
		t.Fatalf("first image must be face-visible (F01-F03), got %s", a[0].Name)
	}

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
	for _, bp := range a[1:] {
		if !isAngleCompatibleUpperAction(bp.Name) {
			t.Fatalf("angleAware violation (non-first): %s", bp.Name)
		}
	}

	c := selectBlueprints(blueprints, rule, 5, "v370-5")
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

	d := selectBlueprints(blueprints, rule, 4, "seed")
	if len(d) != len(blueprints) {
		t.Fatalf("unsupported count must fall back to original order, got %d", len(d))
	}
}

// TestV370StrategyAliasEquivalence 验证 v3.7.0 新策略名与 v3.6.0 旧策略名在相同
// 输入下输出完全一致（CHANGELOG：抽样逻辑与 v3.6.0 完全一致，仅策略名变更）。
// 保护新策略名下不被偷偷替换算法。
func TestV370StrategyAliasEquivalence(t *testing.T) {
	fte := buildContrastSilhouettePool("FTE", 1)
	oldAngle := BlueprintSelectionRule{Strategy: "contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst", RequiredNamePrefix: "FTE-"}
	newAngle := BlueprintSelectionRule{Strategy: "contrastSilhouetteAngleAwareWithBatchDistinction", RequiredNamePrefix: "FTE-"}
	for _, seed := range []string{"alias-1", "alias-2", "alias-3", "中文种子-试纱"} {
		for _, count := range []int{3, 5} {
			o := selectBlueprints(fte, oldAngle, count, seed)
			n := selectBlueprints(fte, newAngle, count, seed)
			if len(o) != len(n) {
				t.Fatalf("seed=%s count=%d len mismatch: %d vs %d", seed, count, len(o), len(n))
			}
			for i := range o {
				if o[i].Name != n[i].Name {
					t.Fatalf("seed=%s count=%d alias mismatch: %s vs %s", seed, count, o[i].Name, n[i].Name)
				}
			}
		}
	}

	pms := buildContrastSilhouettePool("PMS", 1)
	oldSelfie := BlueprintSelectionRule{Strategy: "selfieContrastSilhouetteSamplingWithFaceVisibleFirst", RequiredNamePrefix: "PMS-"}
	newSelfie := BlueprintSelectionRule{Strategy: "selfieContrastSilhouetteWithBatchDistinction", RequiredNamePrefix: "PMS-"}
	for _, seed := range []string{"selfie-1", "selfie-2", "自拍种子"} {
		for _, count := range []int{3, 5} {
			o := selectBlueprints(pms, oldSelfie, count, seed)
			n := selectBlueprints(pms, newSelfie, count, seed)
			if len(o) != len(n) {
				t.Fatalf("selfie seed=%s count=%d len mismatch: %d vs %d", seed, count, len(o), len(n))
			}
			for i := range o {
				if o[i].Name != n[i].Name {
					t.Fatalf("selfie seed=%s count=%d alias mismatch: %s vs %s", seed, count, o[i].Name, n[i].Name)
				}
			}
		}
	}
}

// TestSelectBlueprintsV311ThreeImageRoles 对齐 mjs v3.11.1
// contrastSilhouetteMaxVisualDistance（非自拍）count=3 三图角色结构：
// 图1 Proof（F01+U01/U02+V01+E01）、图2 Action Contrast（F02/F03+E02/E03，
// 相对图1 S/U/V 至少两项不同）、图3 Side-Safe（F04/F05+E04/E05+U01-U06）；三张轮廓家族/
// 上半身动作全不同；extraRequirement 注入对应角色文本（图3 前置 TORSO ORIENTATION
// LOCK，默认侧后安全文本 SIDE SAFE）；angleAware 约束生效；确定性复现、前缀过滤、
// count=5 覆盖 F01-F05+S01-S05 且不注入角色文本、count 非 3/5 降级。
func TestSelectBlueprintsV311ThreeImageRoles(t *testing.T) {
	blueprints := buildContrastSilhouettePool("FTE", 1)
	blueprints = append(blueprints, XhsImageBlueprint{Name: "OTHER-001｜F01-正面｜S01-轮廓｜U01-动作｜V01-支撑｜E01-表情"})
	rule := BlueprintSelectionRule{
		Strategy:           "contrastSilhouetteMaxVisualDistance",
		RequiredNamePrefix: "FTE-",
	}

	assertRoleStructure := func(t *testing.T, sel []XhsImageBlueprint, seed string) {
		t.Helper()
		if len(sel) != 3 {
			t.Fatalf("seed=%s: want 3 blueprints, got %d", seed, len(sel))
		}
		// 图1 Proof：F01 + U01/U02 + V01 + E01
		if angleBand(sel[0].Name) != "F01" {
			t.Fatalf("seed=%s: proof slot must be F01, got %s", seed, sel[0].Name)
		}
		if !proofSafeUpperActions[upperBodyGroup(sel[0].Name)] {
			t.Fatalf("seed=%s: proof upper must be U01/U02, got %s", seed, sel[0].Name)
		}
		if supportVariant(sel[0].Name) != "V01" {
			t.Fatalf("seed=%s: proof support must be V01, got %s", seed, sel[0].Name)
		}
		if !proofExpressions[expressionGroup(sel[0].Name)] {
			t.Fatalf("seed=%s: proof expression must be E01, got %s", seed, sel[0].Name)
		}
		// 图2 Action：F02/F03 + E02/E03
		if b := angleBand(sel[1].Name); b != "F02" && b != "F03" {
			t.Fatalf("seed=%s: action slot must be F02/F03, got %s", seed, sel[1].Name)
		}
		if !actionExpressions[expressionGroup(sel[1].Name)] {
			t.Fatalf("seed=%s: action expression must be E02/E03, got %s", seed, sel[1].Name)
		}
		// 图3 Side：F04/F05 + E04/E05 + U01-U06（v3.11.1 侧身兼容上肢白名单）
		if !sideAngles[angleBand(sel[2].Name)] {
			t.Fatalf("seed=%s: side slot must be F04/F05, got %s", seed, sel[2].Name)
		}
		if !sideExpressions[expressionGroup(sel[2].Name)] {
			t.Fatalf("seed=%s: side expression must be E04/E05, got %s", seed, sel[2].Name)
		}
		if !sideCompatibleUpperActions[upperBodyGroup(sel[2].Name)] {
			t.Fatalf("seed=%s: side upper must be U01-U06, got %s", seed, sel[2].Name)
		}
		// 图2 相对图1 S/U/V 至少两项不同
		if n := actionContrastCount(sel[0].Name, sel[1].Name); n < 2 {
			t.Fatalf("seed=%s: action must differ from proof in >=2 of S/U/V, got %d", seed, n)
		}
		// 三张轮廓家族全不同、上半身动作全不同
		if !allDistinct3(silhouetteFamily(sel[0].Name), silhouetteFamily(sel[1].Name), silhouetteFamily(sel[2].Name)) {
			t.Fatalf("seed=%s: silhouette families must be all distinct", seed)
		}
		if !allDistinct3(upperBodyGroup(sel[0].Name), upperBodyGroup(sel[1].Name), upperBodyGroup(sel[2].Name)) {
			t.Fatalf("seed=%s: upper actions must be all distinct", seed)
		}
		// 角色文本注入（v3.11.1：图3 前置 TORSO ORIENTATION LOCK，默认侧后安全文本 SIDE SAFE；
		// 非自拍主题不注入 PMS PHYSICAL TURN LOCK）
		if !strings.HasPrefix(sel[0].ExtraRequirement, "IMAGE ROLE — PROOF.") {
			t.Fatalf("seed=%s: proof extraRequirement must start with PROOF role text, got %.60s", seed, sel[0].ExtraRequirement)
		}
		if !strings.HasPrefix(sel[1].ExtraRequirement, "IMAGE ROLE — ACTION CONTRAST.") {
			t.Fatalf("seed=%s: action extraRequirement must start with ACTION role text", seed)
		}
		if !strings.HasPrefix(sel[2].ExtraRequirement, "TORSO ORIENTATION LOCK — IMAGE 3.") {
			t.Fatalf("seed=%s: side extraRequirement must start with TORSO ORIENTATION LOCK text", seed)
		}
		if !strings.Contains(sel[2].ExtraRequirement, "IMAGE ROLE — SIDE SAFE.") {
			t.Fatalf("seed=%s: side extraRequirement must contain SIDE SAFE role text", seed)
		}
		if strings.Contains(sel[2].ExtraRequirement, "PMS PHYSICAL TURN LOCK") {
			t.Fatalf("seed=%s: non-selfie side must not contain PMS PHYSICAL TURN LOCK", seed)
		}
	}

	// 相同 seed 确定性复现（count=3，含注入的角色文本）
	a := selectBlueprints(blueprints, rule, 3, "v311-seed")
	b := selectBlueprints(blueprints, rule, 3, "v311-seed")
	if len(a) != 3 || len(b) != 3 {
		t.Fatalf("want 3 blueprints, got %d / %d", len(a), len(b))
	}
	for i := range a {
		if a[i].Name != b[i].Name || a[i].ExtraRequirement != b[i].ExtraRequirement {
			t.Fatalf("same seed must be deterministic at index %d", i)
		}
	}
	assertRoleStructure(t, a, "v311-seed")

	// 不泄漏非候选前缀
	for _, bp := range a {
		if !strings.HasPrefix(bp.Name, "FTE-") {
			t.Fatalf("non-pool blueprint leaked: %s", bp.Name)
		}
	}

	// angleAware：action/side 槽位（F02-F05）必须走配套上半身动作（proof 槽 F01 恒兼容）
	for _, bp := range a[1:] {
		if !isAngleCompatibleUpperAction(bp.Name) {
			t.Fatalf("angleAware violation (action/side): %s", bp.Name)
		}
	}

	// 多 seed 角色结构验证
	for _, seed := range []string{"v311-a", "v311-b", "v311-c", "v311-d", "v311-e"} {
		assertRoleStructure(t, selectBlueprints(blueprints, rule, 3, seed), seed)
	}

	// count=5 完整覆盖 F01-F05 + S01-S05（v3.11.0 保持 Five-View 不变）且不注入角色文本
	c := selectBlueprints(blueprints, rule, 5, "v311-5")
	if len(c) != 5 {
		t.Fatalf("want 5 blueprints, got %d", len(c))
	}
	bands5 := map[string]bool{}
	families5 := map[string]bool{}
	for _, bp := range c {
		bands5[angleBand(bp.Name)] = true
		families5[silhouetteFamily(bp.Name)] = true
		if strings.Contains(bp.ExtraRequirement, "IMAGE ROLE") {
			t.Fatalf("count=5 must not inject role text: %s", bp.Name)
		}
	}
	if len(bands5) != 5 {
		t.Fatalf("5-count batch must cover F01-F05, got %v", bands5)
	}
	if len(families5) != 5 {
		t.Fatalf("5-count batch must cover S01-S05, got %v", families5)
	}

	// count 非 3/5 降级返回原序
	d := selectBlueprints(blueprints, rule, 4, "seed")
	if len(d) != len(blueprints) {
		t.Fatalf("unsupported count must fall back to original order, got %d", len(d))
	}
}

// TestSelectBlueprintsV311SelfieThreeImageRoles 对齐 mjs v3.11.1
// selfieContrastSilhouetteMaxVisualDistance：自拍不做 angleAware 约束，角色结构与
// 非自拍相同（Proof/Action/Side 槽位）；图3 另限 U01-U06 并注入 PMS PHYSICAL TURN
// LOCK；四维不重复断言仅 count=3 生效（mjs 行 271，能返回 3 条即断言通过）；
// count=5 覆盖 F01-F05+S01-S05。
func TestSelectBlueprintsV311SelfieThreeImageRoles(t *testing.T) {
	blueprints := buildContrastSilhouettePool("PMS", 1)
	rule := BlueprintSelectionRule{
		Strategy:           "selfieContrastSilhouetteMaxVisualDistance",
		RequiredNamePrefix: "PMS-",
	}

	// 确定性复现 + 自拍断言不阻断正常数据（返回 3 条即断言通过）
	a := selectBlueprints(blueprints, rule, 3, "selfie-v311-1")
	b := selectBlueprints(blueprints, rule, 3, "selfie-v311-1")
	if len(a) != 3 || len(b) != 3 {
		t.Fatalf("want 3 blueprints, got %d / %d", len(a), len(b))
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			t.Fatalf("same seed must be deterministic: %s != %s", a[i].Name, b[i].Name)
		}
	}

	// 角色槽位结构（与非自拍一致）
	if angleBand(a[0].Name) != "F01" {
		t.Fatalf("proof slot must be F01, got %s", a[0].Name)
	}
	if b2 := angleBand(a[1].Name); b2 != "F02" && b2 != "F03" {
		t.Fatalf("action slot must be F02/F03, got %s", a[1].Name)
	}
	if !sideAngles[angleBand(a[2].Name)] {
		t.Fatalf("side slot must be F04/F05, got %s", a[2].Name)
	}
	if !sideCompatibleUpperActions[upperBodyGroup(a[2].Name)] {
		t.Fatalf("side upper must be U01-U06, got %s", a[2].Name)
	}
	// v3.11.1 PMS 图3 物理转身锁（自拍蓝图 name 以 PMS- 开头）
	if !strings.Contains(a[2].ExtraRequirement, "PMS PHYSICAL TURN LOCK") {
		t.Fatalf("PMS image 3 must contain PMS PHYSICAL TURN LOCK, got %.60s", a[2].ExtraRequirement)
	}
	if !strings.HasPrefix(a[2].ExtraRequirement, "TORSO ORIENTATION LOCK — IMAGE 3.") {
		t.Fatalf("PMS image 3 must start with TORSO ORIENTATION LOCK")
	}
	if n := actionContrastCount(a[0].Name, a[1].Name); n < 2 {
		t.Fatalf("action must differ from proof in >=2 of S/U/V, got %d", n)
	}
	if !allDistinct3(silhouetteFamily(a[0].Name), silhouetteFamily(a[1].Name), silhouetteFamily(a[2].Name)) ||
		!allDistinct3(upperBodyGroup(a[0].Name), upperBodyGroup(a[1].Name), upperBodyGroup(a[2].Name)) {
		t.Fatal("silhouette families and upper actions must be all distinct")
	}

	// selfie 不做 angleAware 约束：与 v3.6.0 共用 isAngleCompatibleUpperAction，
	// 该过滤逻辑已由 TestSelectBlueprintsSelfieContrastSilhouette 充分覆盖（5000
	// 循环证明自拍允许 angleAware-incompatible 组合）。v3.11.0 此处仅断言自拍
	// 策略不因角色结构穷举 + 自拍断言降级（返回 3 条即通过）。

	// count=5 覆盖 F01-F05 + S01-S05
	c := selectBlueprints(blueprints, rule, 5, "selfie-v311-5")
	if len(c) != 5 {
		t.Fatalf("want 5 blueprints, got %d", len(c))
	}
	bands5 := map[string]bool{}
	families5 := map[string]bool{}
	for _, bp := range c {
		bands5[angleBand(bp.Name)] = true
		families5[silhouetteFamily(bp.Name)] = true
	}
	if len(bands5) != 5 || len(families5) != 5 {
		t.Fatalf("5-count batch must cover F01-F05 + S01-S05, got bands=%v families=%v", bands5, families5)
	}
}

// TestBackReferenceSafeRoleText v3.11.0 新增 options.backReferenceSafe：
// false（默认）图3 注入 SIDE SAFE 文本，true 注入 VERIFIED BACK-SAFE 文本；
// 两种模式同 seed 选中的蓝图 name 一致（该选项只影响注入文本，不影响抽样）。
// v3.11.1 起图3 前缀为 TORSO ORIENTATION LOCK，侧后安全文本在其后。
func TestBackReferenceSafeRoleText(t *testing.T) {
	blueprints := buildContrastSilhouettePool("FTE", 1)
	offRule := BlueprintSelectionRule{Strategy: "contrastSilhouetteMaxVisualDistance", RequiredNamePrefix: "FTE-"}
	onRule := BlueprintSelectionRule{Strategy: "contrastSilhouetteMaxVisualDistance", RequiredNamePrefix: "FTE-", BackReferenceSafe: true}

	off := selectBlueprints(blueprints, offRule, 3, "brs-seed")
	on := selectBlueprints(blueprints, onRule, 3, "brs-seed")
	if len(off) != 3 || len(on) != 3 {
		t.Fatalf("want 3/3 blueprints, got %d/%d", len(off), len(on))
	}
	for i := range off {
		if off[i].Name != on[i].Name {
			t.Fatalf("backReferenceSafe must not change sampling at index %d: %s != %s", i, off[i].Name, on[i].Name)
		}
	}
	if !strings.HasPrefix(off[2].ExtraRequirement, "TORSO ORIENTATION LOCK — IMAGE 3.") {
		t.Fatalf("image 3 must start with TORSO ORIENTATION LOCK, got %.60s", off[2].ExtraRequirement)
	}
	if !strings.Contains(off[2].ExtraRequirement, "IMAGE ROLE — SIDE SAFE.") {
		t.Fatalf("default must inject SIDE SAFE text, got %.60s", off[2].ExtraRequirement)
	}
	if strings.Contains(off[2].ExtraRequirement, "VERIFIED BACK-SAFE") {
		t.Fatalf("default must not contain VERIFIED BACK-SAFE text")
	}
	if !strings.Contains(on[2].ExtraRequirement, "IMAGE ROLE — VERIFIED BACK-SAFE.") {
		t.Fatalf("backReferenceSafe=true must inject VERIFIED BACK-SAFE text, got %.60s", on[2].ExtraRequirement)
	}
	if strings.Contains(on[2].ExtraRequirement, "IMAGE ROLE — SIDE SAFE.") {
		t.Fatalf("backReferenceSafe=true must not contain SIDE SAFE text")
	}
}

// TestVisualDistanceAndChooseMaxDistanceRoleBatch 单元验证 v3.11.0 的视觉距离计算与
// 角色批次穷举选择：相同蓝图距离 0；各维度差异按权重累加；
// chooseMaxDistanceRoleBatch 跳过「图1图2 S/U/V 不同数<2」「三张 S/U 非全不同」的
// 组合后，必选最小成对距离最大（并列时总和最大）的合法三元组。
func TestVisualDistanceAndChooseMaxDistanceRoleBatch(t *testing.T) {
	mk := func(tag string, f, s, u, v, e int) string {
		return fmt.Sprintf("%s｜F0%d-角度｜S0%d-轮廓｜U%02d-动作｜V0%d-支撑｜E0%d-表情", tag, f, s, u, v, e)
	}
	same := mk("A", 1, 1, 1, 1, 1)
	if d := visualDistance(same, same); d != 0 {
		t.Fatalf("identical blueprint distance must be 0, got %d", d)
	}
	// C: F02 S02 U03 V02 E02 vs same(F01 S01 U01 V01 E01)
	// angleGap=|0-(-1)|=1*3=3, family+4, upperClass low!=bent +3, upper+2, support+2, expr+1 = 15
	c := mk("C", 2, 2, 3, 2, 2)
	if d := visualDistance(same, c); d != 15 {
		t.Fatalf("distance(A,C) want 15, got %d", d)
	}
	// D: F05 S01 U01 V01 E01 vs same -> angleGap=|0-2|=2*3=6, 其余同 = 6
	d := mk("D", 5, 1, 1, 1, 1)
	if got := visualDistance(same, d); got != 6 {
		t.Fatalf("distance(A,D) want 6, got %d", got)
	}

	// chooseMaxDistanceRoleBatch：独立穷举合法三元组（应用同样跳过条件）找最优
	// （最小成对距离最大，并列时总和最大），对比函数返回三元组的 minimum/total。
	// 不比具体 name：并列时函数内部 shuffle 影响选哪个，但最优 minimum/total 必唯一。
	groups := [][]XhsImageBlueprint{
		{{Name: mk("A1", 1, 1, 1, 1, 1)}, {Name: mk("A2", 2, 2, 3, 2, 2)}, {Name: mk("A3", 3, 3, 5, 3, 3)}},
		{{Name: mk("B1", 2, 3, 4, 2, 1)}, {Name: mk("B2", 4, 1, 7, 4, 5)}, {Name: mk("B3", 1, 5, 2, 1, 3)}},
		{{Name: mk("C1", 5, 4, 9, 3, 2)}, {Name: mk("C2", 3, 2, 6, 1, 4)}, {Name: mk("C3", 2, 5, 1, 2, 5)}},
	}
	min3 := func(a, b, c int) int {
		m := a
		if b < m {
			m = b
		}
		if c < m {
			m = c
		}
		return m
	}
	legal := func(a, b, c XhsImageBlueprint) bool {
		if actionContrastCount(a.Name, b.Name) < 2 {
			return false
		}
		if !allDistinct3(silhouetteFamily(a.Name), silhouetteFamily(b.Name), silhouetteFamily(c.Name)) {
			return false
		}
		return allDistinct3(upperBodyGroup(a.Name), upperBodyGroup(b.Name), upperBodyGroup(c.Name))
	}
	bestMin, bestTotal := -1, -1
	for _, a := range groups[0] {
		for _, b := range groups[1] {
			for _, c := range groups[2] {
				if !legal(a, b, c) {
					continue
				}
				dab := visualDistance(a.Name, b.Name)
				dac := visualDistance(a.Name, c.Name)
				dbc := visualDistance(b.Name, c.Name)
				m := min3(dab, dac, dbc)
				tot := dab + dac + dbc
				if m > bestMin || (m == bestMin && tot > bestTotal) {
					bestMin, bestTotal = m, tot
				}
			}
		}
	}
	got := chooseMaxDistanceRoleBatch(groups, seededBlueprintRandom("role-seed"))
	if len(got) != 3 {
		t.Fatalf("want 3 blueprints, got %d", len(got))
	}
	// 返回三元组必须满足跳过条件
	if !legal(got[0], got[1], got[2]) {
		t.Fatalf("chosen batch violates role constraints: %v / %v / %v", got[0].Name, got[1].Name, got[2].Name)
	}
	gm := min3(visualDistance(got[0].Name, got[1].Name), visualDistance(got[0].Name, got[2].Name), visualDistance(got[1].Name, got[2].Name))
	if gm != bestMin {
		t.Fatalf("chosen triple minimum pairwise distance %d != optimal %d", gm, bestMin)
	}
	gt := visualDistance(got[0].Name, got[1].Name) + visualDistance(got[0].Name, got[2].Name) + visualDistance(got[1].Name, got[2].Name)
	if gt != bestTotal {
		t.Fatalf("chosen triple total distance %d != optimal %d", gt, bestTotal)
	}
}

// TestStandingOnlyBatchOk 单元验证 v3.11.0 站姿断言：name/purpose/description 任一
// 命中非站姿黑名单（忽略大小写）或支撑变体非 V01-V04 -> false；extraRequirement
// 不扫描（standing lock 文本故意提到禁止姿势）。
func TestStandingOnlyBatchOk(t *testing.T) {
	base := XhsImageBlueprint{Name: "PMS-0001｜F01-正面｜S01-轮廓｜U01-动作｜V01-支撑｜E01-表情"}
	if !standingOnlyBatchOk([]XhsImageBlueprint{base}) {
		t.Fatal("normal standing blueprint must pass")
	}
	// name 命中 sitting -> false
	seated := base
	seated.Name = "PMS-0002 sitting pose｜F01-正面｜S01-轮廓｜U01-动作｜V01-支撑｜E01-表情"
	if standingOnlyBatchOk([]XhsImageBlueprint{seated}) {
		t.Fatal("sitting in name must fail")
	}
	// description 命中 Seated（大小写不敏感）-> false
	desc := base
	desc.Description = "A Seated portrait moment"
	if standingOnlyBatchOk([]XhsImageBlueprint{desc}) {
		t.Fatal("Seated in description must fail")
	}
	// purpose 命中 crouching -> false
	purp := base
	purp.Purpose = "show a crouching detail"
	if standingOnlyBatchOk([]XhsImageBlueprint{purp}) {
		t.Fatal("crouching in purpose must fail")
	}
	// extraRequirement 含禁止词但不扫描 -> true
	er := base
	er.ExtraRequirement = "Do not show sitting or crouching poses; stay standing"
	if !standingOnlyBatchOk([]XhsImageBlueprint{er}) {
		t.Fatal("extraRequirement must not be scanned")
	}
	// 支撑变体缺失（无 V 标记）-> false
	noV := XhsImageBlueprint{Name: "PMS-0003｜F01-正面｜S01-轮廓｜U01-动作｜E01-表情"}
	if standingOnlyBatchOk([]XhsImageBlueprint{noV}) {
		t.Fatal("missing support variant must fail")
	}
}

// TestSelfieBatchIsDistinct 单元验证自拍四维不重复断言：正常批次 true，
// 第 3 张重复第 1 张任一维度或批次内四元组重复时 false。
func TestSelfieBatchIsDistinct(t *testing.T) {
	mk := func(tag string, f, s, u, e int) string {
		return fmt.Sprintf("%s｜F0%d-角度｜S0%d-轮廓｜U%02d-动作｜V01-支撑｜E0%d-表情", tag, f, s, u, e)
	}
	// 三条四维全不同 -> true
	distinct := []XhsImageBlueprint{
		{Name: mk("X", 1, 1, 1, 1)},
		{Name: mk("Y", 2, 2, 3, 2)},
		{Name: mk("Z", 3, 3, 5, 3)},
	}
	if !selfieBatchIsDistinct(distinct) {
		t.Fatal("fully distinct batch must pass")
	}
	// 第 3 张重复第 1 张的 band -> false
	repeatBand := []XhsImageBlueprint{
		{Name: mk("X", 1, 1, 1, 1)},
		{Name: mk("Y", 2, 2, 3, 2)},
		{Name: mk("Z", 1, 3, 5, 3)}, // band=F01 重复第 1 张
	}
	if selfieBatchIsDistinct(repeatBand) {
		t.Fatal("batch with image3 repeating image1 band must fail")
	}
	// 批次内四元组重复 -> false
	repeatQuad := []XhsImageBlueprint{
		{Name: mk("X", 1, 1, 1, 1)},
		{Name: mk("Y", 2, 2, 3, 2)},
		{Name: mk("Z", 2, 2, 3, 2)}, // 与第 2 张四元组完全相同
	}
	if selfieBatchIsDistinct(repeatQuad) {
		t.Fatal("batch with repeated quad must fail")
	}
	// < 3 张不断言 -> true
	if !selfieBatchIsDistinct(distinct[:2]) {
		t.Fatal("batch < 3 must pass")
	}
}

// TestV310NotAliasOfV360 验证 v3.11.0 MaxVisualDistance 与 v3.6.0/v3.7.0
// WithBatchDistinction 是不同算法（非别名）：相同 seed 下 count=3 至少有一处输出不同。
// 对照 TestV370StrategyAliasEquivalence（v3.7.0 是 v3.6.0 别名，输出完全一致）。
func TestV310NotAliasOfV360(t *testing.T) {
	fte := buildContrastSilhouettePool("FTE", 1)
	oldRule := BlueprintSelectionRule{Strategy: "contrastSilhouetteAngleAwareWithBatchDistinction", RequiredNamePrefix: "FTE-"}
	newRule := BlueprintSelectionRule{Strategy: "contrastSilhouetteMaxVisualDistance", RequiredNamePrefix: "FTE-"}
	diffFound := false
	for _, seed := range []string{"cmp-1", "cmp-2", "cmp-3", "cmp-4", "cmp-5", "cmp-6", "cmp-7", "cmp-8"} {
		o := selectBlueprints(fte, oldRule, 3, seed)
		n := selectBlueprints(fte, newRule, 3, seed)
		if len(o) != 3 || len(n) != 3 {
			t.Fatalf("seed=%s: want 3/3, got %d/%d", seed, len(o), len(n))
		}
		for i := range o {
			if o[i].Name != n[i].Name {
				diffFound = true
				break
			}
		}
		if diffFound {
			break
		}
	}
	if !diffFound {
		t.Fatal("v3.11.0 must differ from v3.6.0/v3.7.0 on at least one seed (not an alias)")
	}
}
