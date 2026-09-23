package seeding

import "strings"

// selectMacroActionBlueprints 实现 macroActionDiversity 策略（2026-09 婚纱 macro 迁移
// 配套策略，线上四主题各 25 条 MACRO-* 蓝图：5 动作族 × 5 表情变体，每条带 action 元数据）。
//
// count=3：图1 从「static_display + frontal + proofSafe」证明帧候选中按 batchSeed 随机
// 取一条；图2/图3 从其余动作族（AllowedActionFamilies 白名单内）穷举二元组合，选与图1
// 及彼此「最小成对动作维度差最大（并列时总和最大）」的两个不同 family，各按 seed 随机
// 取一条变体。动作维度为 movement / orientation / armSilhouette / garmentSilhouette
// 四项，维度差计数即两条蓝图的动作距离（0-4）。
// count=5：五个动作族各取一条（图1 仍为 static_display + frontal + proofSafe 证明帧），
// 其余家族按 seed 洗牌定序，各随机取一条变体。
//
// 候选必须带 action 元数据且 standing=true；AllowedActionFamilies 非空时 family 必须在
// 白名单内。数据不足以满足策略时降级返回原蓝图顺序（与既有策略一致，保证生图链路不中断）。
func selectMacroActionBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint {
	if count != 3 && count != 5 {
		return blueprints
	}
	pool := macroActionPool(blueprints, rule)
	if len(pool) == 0 {
		return blueprints
	}
	groups, familyOrder := macroActionGroups(pool)
	proof := macroProofCandidates(pool)
	if len(proof) == 0 {
		return blueprints
	}
	need := count - 1
	otherFamilies := make([]string, 0, len(groups))
	for _, family := range familyOrder {
		if family == macroProofFamily {
			continue
		}
		otherFamilies = append(otherFamilies, family)
	}
	if len(otherFamilies) < need {
		return blueprints
	}

	random := seededBlueprintRandom(batchSeed)

	// 先定图1 证明帧：候选池按 seed 洗牌后取第一条。
	shuffledProof := make([]XhsImageBlueprint, len(proof))
	copy(shuffledProof, proof)
	shuffleBlueprints(shuffledProof, random)
	first := shuffledProof[0]

	// 选 need 个动作族：count=3 穷举二元组最大化成对差异；count=5 全家集、seed 洗牌定序。
	var chosenFamilies []string
	if count == 3 {
		chosenFamilies = chooseMacroActionFamilies(first, otherFamilies, groups, need)
	} else {
		chosenFamilies = shuffleStrings(otherFamilies, random)
	}
	if len(chosenFamilies) < need {
		return blueprints
	}

	out := make([]XhsImageBlueprint, 0, count)
	out = append(out, first)
	for _, family := range chosenFamilies[:need] {
		variants := groups[family]
		out = append(out, variants[int(random()*float64(len(variants)))])
	}
	return out
}

// macroProofFamily 图1 证明帧动作族。
const macroProofFamily = "static_display"

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

// chooseMacroActionFamilies 从其余动作族中选 need 个（count=3 即 2 个）不同 family：
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
