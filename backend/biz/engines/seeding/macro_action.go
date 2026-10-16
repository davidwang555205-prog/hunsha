package seeding

import "strings"

// selectMacroActionBlueprints 实现 macroActionDiversity 策略（2026-09 婚纱 macro 迁移
// 配套策略，线上四主题各 25 条 MACRO-* 蓝图：5 动作族 × 5 表情变体，每条带 action 元数据）。
//
// 升级特性（2026-10 动作多样性与局部细节图支持）：
// 1. 若候选池含局部特写蓝图（cameraScale="partial" 或细节/特写属性）：
//    - count=3：图1 证明帧 + 图2 差异最大动作族 + 图3 局部特写帧（固定位 3）；
//    - count=5：图1 证明帧 + 图2~4 三个互斥动作族 + 图5 局部特写帧（固定位 5）；
// 2. 若无局部特写蓝图，保持原行为：count=3 取三动作族，count=5 取五动作族全覆盖；
// 3. 彻底消除静默降级毒丸：候选条件不足时通过 fallbackDiverseBlueprints 跨家族轮流或洗牌抽样，
//    杜绝顺序截取前 N 条返回同动作族变体（彻底根除「三图同动作」事故）。
func selectMacroActionBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint {
	if count != 3 && count != 5 {
		return blueprints
	}
	pool := macroActionPool(blueprints, rule)
	if len(pool) == 0 {
		return fallbackDiverseBlueprints(blueprints, batchSeed)
	}
	groups, familyOrder := macroActionGroups(pool)
	proof := macroProofCandidates(pool)
	if len(proof) == 0 {
		return fallbackDiverseBlueprints(blueprints, batchSeed)
	}

	partials := filterPartialCandidates(blueprints, rule.RequiredNamePrefix)
	hasPartials := len(partials) > 0

	need := count - 1
	if hasPartials {
		need = count - 2
	}

	otherFamilies := make([]string, 0, len(groups))
	for _, family := range familyOrder {
		if family == macroProofFamily {
			continue
		}
		otherFamilies = append(otherFamilies, family)
	}
	if len(otherFamilies) < need {
		return fallbackDiverseBlueprints(blueprints, batchSeed)
	}

	random := seededBlueprintRandom(batchSeed)

	// 先定图1 证明帧：候选池按 seed 洗牌后取第一条。
	shuffledProof := make([]XhsImageBlueprint, len(proof))
	copy(shuffledProof, proof)
	shuffleBlueprints(shuffledProof, random)
	first := shuffledProof[0]

	// 选 need 个动作族：need=1 或 need=2 穷举组合最大化成对差异；need=3 或 4 洗牌定序。
	var chosenFamilies []string
	if need <= 2 {
		chosenFamilies = chooseMacroActionFamilies(first, otherFamilies, groups, need)
	} else {
		chosenFamilies = shuffleStrings(otherFamilies, random)
	}
	if len(chosenFamilies) < need {
		return fallbackDiverseBlueprints(blueprints, batchSeed)
	}

	out := make([]XhsImageBlueprint, 0, count)
	out = append(out, first)
	for _, family := range chosenFamilies[:need] {
		variants := groups[family]
		out = append(out, variants[int(random()*float64(len(variants)))])
	}

	// 若启用局部特写，末位注入 1 帧局部特写（固定位 3 或位 5）
	if hasPartials {
		shuffledPartials := make([]XhsImageBlueprint, len(partials))
		copy(shuffledPartials, partials)
		shuffleBlueprints(shuffledPartials, random)
		chosenPartial := shuffledPartials[0]
		if chosenPartial.CameraScale == "" {
			chosenPartial.CameraScale = "partial"
		}
		out = append(out, chosenPartial)
	}

	return out
}

// macroProofFamily 图1 证明帧动作族。
const macroProofFamily = "static_display"

// isPartialBlueprint 判断是否为局部特写蓝图。
func isPartialBlueprint(bp XhsImageBlueprint) bool {
	if bp.CameraScale == "partial" {
		return true
	}
	if bp.Action != nil && bp.Action.Family == "partial_detail" {
		return true
	}
	return strings.Contains(bp.Purpose, "细节") || strings.Contains(bp.Name, "细节") || strings.Contains(bp.Purpose, "特写")
}

// filterPartialCandidates 筛选符合前缀与局部特写属性的蓝图。
func filterPartialCandidates(blueprints []XhsImageBlueprint, requiredPrefix string) []XhsImageBlueprint {
	out := make([]XhsImageBlueprint, 0)
	for _, bp := range blueprints {
		if requiredPrefix != "" && !strings.HasPrefix(bp.Name, requiredPrefix) {
			continue
		}
		if isPartialBlueprint(bp) {
			out = append(out, bp)
		}
	}
	return out
}

// fallbackDiverseBlueprints 降级多样性抽样：
// 保持总长度 len(blueprints) 兼容平台既有契约，同时通过家族交错（Round-Robin Interleaving）
// 重新排列，杜绝前 N 条出现连续同家族变体，防止外部切取前 3 条时发生「三图同动作」。
func fallbackDiverseBlueprints(blueprints []XhsImageBlueprint, batchSeed string) []XhsImageBlueprint {
	if len(blueprints) <= 1 {
		return blueprints
	}
	random := seededBlueprintRandom(batchSeed)
	groups := map[string][]XhsImageBlueprint{}
	families := make([]string, 0)
	for _, bp := range blueprints {
		fam := ""
		if bp.Action != nil && bp.Action.Family != "" {
			fam = bp.Action.Family
		} else {
			fam = blueprintFamily(bp.Name)
		}
		if fam == "" {
			fam = "default"
		}
		if _, exists := groups[fam]; !exists {
			families = append(families, fam)
		}
		groups[fam] = append(groups[fam], bp)
	}

	if len(families) > 1 {
		shuffledFamilies := make([]string, len(families))
		copy(shuffledFamilies, families)
		shuffleStrings(shuffledFamilies, random)
		out := make([]XhsImageBlueprint, 0, len(blueprints))
		maxLen := 0
		for _, v := range groups {
			if len(v) > maxLen {
				maxLen = len(v)
			}
		}
		for round := 0; round < maxLen; round++ {
			for _, fam := range shuffledFamilies {
				vars := groups[fam]
				if round < len(vars) {
					out = append(out, vars[round])
				}
			}
		}
		return out
	}

	shuffled := make([]XhsImageBlueprint, len(blueprints))
	copy(shuffled, blueprints)
	shuffleBlueprints(shuffled, random)
	return shuffled
}

// macroActionPool 按 requiredNamePrefix + action 元数据完整性 + standing + 动作族白名单
// 过滤候选池；无任何候选时返回空切片，由调用方降级。
func macroActionPool(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule) []XhsImageBlueprint {
	allowed := map[string]bool{}
	for _, family := range rule.AllowedActionFamilies {
		allowed[family] = true
	}
	pool := blueprints
	if rule.RequiredNamePrefix != "" {
		filtered := make([]XhsImageBlueprint, 0, len(blueprints))
		for _, bp := range blueprints {
			if strings.HasPrefix(bp.Name, rule.RequiredNamePrefix) {
				filtered = append(filtered, bp)
			}
		}
		pool = filtered
	}
	out := make([]XhsImageBlueprint, 0, len(pool))
	for _, bp := range pool {
		action := bp.Action
		if action == nil || !action.Standing {
			continue
		}
		if len(allowed) > 0 && !allowed[action.Family] {
			continue
		}
		out = append(out, bp)
	}
	return out
}

// macroActionGroups 按 action.family 分组并返回按池内首次出现排序的 family 列表；
// 同族蓝图保持池内原序。family 顺序进入抽样路径，必须确定（不可遍历 map）。
func macroActionGroups(pool []XhsImageBlueprint) (map[string][]XhsImageBlueprint, []string) {
	groups := map[string][]XhsImageBlueprint{}
	order := make([]string, 0)
	for _, bp := range pool {
		family := bp.Action.Family
		if _, exists := groups[family]; !exists {
			order = append(order, family)
		}
		groups[family] = append(groups[family], bp)
	}
	return groups, order
}

// macroProofCandidates 图1 证明帧候选：static_display + frontal + proofSafe。
func macroProofCandidates(pool []XhsImageBlueprint) []XhsImageBlueprint {
	out := make([]XhsImageBlueprint, 0)
	for _, bp := range pool {
		action := bp.Action
		if action.Family == macroProofFamily && action.Orientation == "frontal" && action.ProofSafe {
			out = append(out, bp)
		}
	}
	return out
}

// macroActionDistance 两条蓝图在 movement / orientation / armSilhouette /
// garmentSilhouette 四条动作维度上的差异数（0-4）。
func macroActionDistance(left, right *BlueprintAction) int {
	n := 0
	if left.Movement != right.Movement {
		n++
	}
	if left.Orientation != right.Orientation {
		n++
	}
	if left.ArmSilhouette != right.ArmSilhouette {
		n++
	}
	if left.GarmentSilhouette != right.GarmentSilhouette {
		n++
	}
	return n
}

// chooseMacroActionFamilies 从其余动作族中选 need 个不同 family：
// 穷举全部 need 元组合（保持 otherFamilies 原序，保证确定性），计算组内（含图1）最小
// 成对动作维度差，取最大者（并列取总和最大）。无组合返回 nil。
func chooseMacroActionFamilies(first XhsImageBlueprint, families []string, groups map[string][]XhsImageBlueprint, need int) []string {
	indexes := make([]int, 0, need)
	var best []string
	bestMin, bestTotal := -1, -1
	var walk func(start int)
	walk = func(start int) {
		if len(indexes) == need {
			chosen := make([]string, need)
			for i, idx := range indexes {
				chosen[i] = families[idx]
			}
			minimum, total := macroBatchDistance(first, chosen, groups)
			if minimum > bestMin || (minimum == bestMin && total > bestTotal) {
				best, bestMin, bestTotal = chosen, minimum, total
			}
			return
		}
		for i := start; i < len(families); i++ {
			indexes = append(indexes, i)
			walk(i + 1)
			indexes = indexes[:len(indexes)-1]
		}
	}
	walk(0)
	return best
}

// macroBatchDistance 图1 + 所选动作族代表（各族取首条，同族四维度一致）的两两动作距离：
// 返回最小成对距离与距离总和。
func macroBatchDistance(first XhsImageBlueprint, families []string, groups map[string][]XhsImageBlueprint) (int, int) {
	actions := make([]*BlueprintAction, 0, len(families)+1)
	actions = append(actions, first.Action)
	for _, family := range families {
		actions = append(actions, groups[family][0].Action)
	}
	minimum, total := -1, 0
	for i := 0; i < len(actions); i++ {
		for j := i + 1; j < len(actions); j++ {
			d := macroActionDistance(actions[i], actions[j])
			total += d
			if minimum < 0 || d < minimum {
				minimum = d
			}
		}
	}
	return minimum, total
}
