package seeding

import (
	"regexp"
	"strings"
)

// selectBlueprints 是通用、确定性的图组选择器。业务只在 JSON 中声明策略和固定首图，
// 不上传或执行业务 JavaScript。family 名称取蓝图 name 中“｜”后的 F01/F02…标记。
func selectBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint {
	if len(blueprints) <= count || rule.Strategy == "" || rule.Strategy == "fixed" {
		return blueprints
	}
	if rule.Strategy == "angleBandExpressionSamplingWithFaceVisibleFirst" {
		return selectAngleExpressionDiverseBlueprints(blueprints, rule, count, batchSeed)
	}
	if rule.Strategy == "contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst" {
		return selectContrastSilhouetteBlueprints(blueprints, rule, count, batchSeed, true)
	}
	if rule.Strategy == "selfieContrastSilhouetteSamplingWithFaceVisibleFirst" {
		return selectContrastSilhouetteBlueprints(blueprints, rule, count, batchSeed, false)
	}
	if rule.Strategy != "familySampling" && rule.Strategy != "familySamplingWithRequiredFirst" {
		return blueprints
	}
	required := XhsImageBlueprint{}
	hasRequired := false
	if rule.Strategy == "familySamplingWithRequiredFirst" {
		for _, bp := range blueprints {
			if strings.HasPrefix(bp.Name, rule.RequiredNamePrefix) {
				required, hasRequired = bp, true
				break
			}
		}
		if !hasRequired {
			return blueprints
		}
	}
	groups := map[string][]XhsImageBlueprint{}
	families := make([]string, 0)
	for _, bp := range blueprints {
		family := blueprintFamily(bp.Name)
		if family == "" || (hasRequired && family == blueprintFamily(required.Name)) {
			continue
		}
		if _, exists := groups[family]; !exists {
			families = append(families, family)
		}
		groups[family] = append(groups[family], bp)
	}
	need := count
	if hasRequired {
		need--
	}
	if len(groups) < need {
		return blueprints
	}
	random := seededBlueprintRandom(batchSeed)
	shuffleBlueprints(families, random)
	out := make([]XhsImageBlueprint, 0, count)
	if hasRequired {
		out = append(out, required)
	}
	for _, family := range families[:need] {
		variants := groups[family]
		out = append(out, variants[int(random()*float64(len(variants)))])
	}
	shuffleBlueprints(out, random)
	return out
}

func blueprintFamily(name string) string {
	parts := strings.Split(name, "｜")
	if len(parts) < 2 || len(parts[1]) < 3 || parts[1][0] != 'F' {
		return ""
	}
	if parts[1][1] < '0' || parts[1][1] > '9' || parts[1][2] < '0' || parts[1][2] > '9' {
		return ""
	}
	return parts[1][:3]
}

func seededBlueprintRandom(seed string) func() float64 {
	var hash uint32 = 2166136261
	for _, char := range seed {
		hash ^= uint32(char)
		hash *= 16777619
	}
	if hash == 0 {
		hash = 1
	}
	state := hash
	return func() float64 {
		state += 0x6d2b79f5
		value := state
		value = (value ^ (value >> 15)) * (value | 1)
		value ^= value + (value^(value>>7))*(value|61)
		value ^= value >> 14
		return float64(value) / 4294967296
	}
}

func shuffleBlueprints[T any](items []T, random func() float64) {
	for index := len(items) - 1; index > 0; index-- {
		target := int(random() * float64(index+1))
		items[index], items[target] = items[target], items[index]
	}
}

var (
	reAngleBand     = regexp.MustCompile(`｜(F0[1-5])-`)
	reExpressionGrp = regexp.MustCompile(`｜(E0[1-5])-`)
	reSilhouette    = regexp.MustCompile(`｜(S0[1-5])-`)
	reUpperBody     = regexp.MustCompile(`｜(U(?:0[1-9]|10))-`)
	reSupportVar    = regexp.MustCompile(`｜(V0[1-4])-`)
)

// angleBand 返回蓝图 name 中的角度带 F01-F05；无标记返回空串。
// 对齐 mjs viewpoint-sampling v3.3.0 的 angleBand。
func angleBand(name string) string {
	match := reAngleBand.FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

// expressionGroup 返回蓝图 name 中的微表情组 E01-E05；无标记返回空串。
// 对齐 mjs viewpoint-sampling v3.3.0 的 expressionGroup。
func expressionGroup(name string) string {
	match := reExpressionGrp.FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

// silhouetteFamily 返回蓝图 name 中的强对比上半身轮廓家族 S01-S05；无标记返回空串。
// 对齐 mjs viewpoint-sampling v3.6.0 的 silhouetteFamily。
func silhouetteFamily(name string) string {
	match := reSilhouette.FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

// upperBodyGroup 返回蓝图 name 中的上半身动作 U01-U10；无标记返回空串。
// 对齐 mjs viewpoint-sampling v3.6.0 的 upperBodyGroup。
func upperBodyGroup(name string) string {
	match := reUpperBody.FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

// supportVariant 返回蓝图 name 中的支撑变体 V01-V04；无标记返回空串。
// 对齐 mjs viewpoint-sampling v3.6.0 的 supportVariant。
func supportVariant(name string) string {
	match := reSupportVar.FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

// isFaceVisibleFirstCandidate 首图露脸候选仅取正面与左前/右前 45 度（F01-F03）。
func isFaceVisibleFirstCandidate(name string) bool {
	switch angleBand(name) {
	case "F01", "F02", "F03":
		return true
	}
	return false
}

// selectAngleExpressionDiverseBlueprints 实现 mjs v3.3.0
// angleBandExpressionSamplingWithFaceVisibleFirst 策略：首图从 F01/F02/F03 确定性
// 随机抽取并保证五官可见，3/5 张批次内角度带与微表情组均不重复，5 张时完整覆盖
// F01-F05。消耗随机数的顺序与 mjs 严格一致，相同 batchSeed 复现相同结果。
// requiredNamePrefix 在本策略中作为主题候选池前缀使用（匹配主题全部蓝图），
// 不再代表固定首图。数据不足以满足策略时降级返回原蓝图顺序，不抛错以保证生图链路不中断。
func selectAngleExpressionDiverseBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint {
	if count != 3 && count != 5 {
		return blueprints
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
	if len(pool) == 0 {
		return blueprints
	}

	random := seededBlueprintRandom(batchSeed)

	firstBand := shuffleStrings([]string{"F01", "F02", "F03"}, random)[0]
	firstExpression := shuffleStrings([]string{"E01", "E02", "E03", "E04", "E05"}, random)[0]

	firstCandidates := make([]XhsImageBlueprint, 0)
	for _, bp := range pool {
		if angleBand(bp.Name) == firstBand && expressionGroup(bp.Name) == firstExpression && isFaceVisibleFirstCandidate(bp.Name) {
			firstCandidates = append(firstCandidates, bp)
		}
	}
	if len(firstCandidates) == 0 {
		return blueprints
	}
	first := firstCandidates[int(random()*float64(len(firstCandidates)))]

	selectedBands := shuffleStrings(filterOutString([]string{"F01", "F02", "F03", "F04", "F05"}, firstBand), random)[:count-1]
	selectedExpressions := shuffleStrings(filterOutString([]string{"E01", "E02", "E03", "E04", "E05"}, firstExpression), random)[:count-1]

	secondary := make([]XhsImageBlueprint, 0, count-1)
	for index, band := range selectedBands {
		expression := selectedExpressions[index]
		candidates := make([]XhsImageBlueprint, 0)
		for _, bp := range pool {
			if angleBand(bp.Name) == band && expressionGroup(bp.Name) == expression {
				candidates = append(candidates, bp)
			}
		}
		if len(candidates) == 0 {
			return blueprints
		}
		secondary = append(secondary, candidates[int(random()*float64(len(candidates)))])
	}

	shuffleBlueprints(secondary, random)
	return append([]XhsImageBlueprint{first}, secondary...)
}

// filterOutString 返回不含 exclude 的副本。
func filterOutString(values []string, exclude string) []string {
	out := make([]string, 0, len(values)-1)
	for _, v := range values {
		if v != exclude {
			out = append(out, v)
		}
	}
	return out
}

// shuffleStrings 复用泛型 shuffleBlueprints 原地洗牌字符串切片并返回入参本身。
func shuffleStrings(values []string, random func() float64) []string {
	shuffleBlueprints(values, random)
	return values
}

// threeImageFamilySets 是 v3.6.0 审核过的 3 张高对比上半身轮廓家族组合。
// count=3 时按 seed 从中抽一组；count=5 时直接覆盖 S01-S05。
// 对齐 mjs viewpoint-sampling v3.6.0 的 THREE_IMAGE_FAMILY_SETS。
var threeImageFamilySets = [][]string{
	{"S01", "S03", "S04"},
	{"S01", "S02", "S05"},
	{"S01", "S04", "S05"},
	{"S02", "S03", "S04"},
	{"S02", "S04", "S05"},
}

var allAngleBands = []string{"F01", "F02", "F03", "F04", "F05"}
var allExpressionGroups = []string{"E01", "E02", "E03", "E04", "E05"}

// isAngleCompatibleUpperAction 实现 mjs viewpoint-sampling v3.6.0 的
// isAngleCompatibleUpperAction：S02/S03/S05 家族需要按角度带配套上半身动作，
// F02/F04 走左侧近镜动作 U03/U05/U09，F03/F05 走右侧近镜动作 U04/U06/U10；
// 其余家族（S01/S04）或 F01 角度带无强约束。
func isAngleCompatibleUpperAction(name string) bool {
	family := silhouetteFamily(name)
	if family != "S02" && family != "S03" && family != "S05" {
		return true
	}
	band := angleBand(name)
	upper := upperBodyGroup(name)
	switch band {
	case "F01":
		return true
	case "F02", "F04":
		return upper == "U03" || upper == "U05" || upper == "U09"
	case "F03", "F05":
		return upper == "U04" || upper == "U06" || upper == "U10"
	}
	return false
}

// selectContrastSilhouetteBlueprints 实现 mjs viewpoint-sampling v3.6.0 的
// contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst 与
// selfieContrastSilhouetteSamplingWithFaceVisibleFirst 共享逻辑。
//
// 首图从 F01/F02/F03 确定性随机抽取并保证五官可见（与 v3.3.0 一致），同时按
// 强对比上半身轮廓家族 S01-S05 分组：3 张从审核过的 5 组家族组合中抽一组、
// 5 张完整覆盖 S01-S05。非自拍主题（angleAware=true）按角度带约束上半身动作
// （F02/F04 左侧近镜、F03/F05 右侧近镜）；自拍主题不做角度感知约束。
//
// 消耗随机数的顺序与 mjs 严格一致（family 选择 → family 洗牌 → first band 洗牌
// → first expression 洗牌 → first 候选选择 → 剩余 band/expression 洗牌 →
// secondary 逐个候选选择 → secondary 洗牌），相同 batchSeed 复现相同结果。
// requiredNamePrefix 在本策略中作为主题候选池前缀使用，匹配主题全部蓝图。
// 数据不足以满足策略时降级返回原蓝图顺序（mjs throw 处改为降级以保证生图
// 链路不中断，正常 JSON 数据完整不会触发）。
func selectContrastSilhouetteBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string, angleAware bool) []XhsImageBlueprint {
	if count != 3 && count != 5 {
		return blueprints
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
	if len(pool) == 0 {
		return blueprints
	}

	random := seededBlueprintRandom(batchSeed)

	var families []string
	if count == 5 {
		families = []string{"S01", "S02", "S03", "S04", "S05"}
	} else {
		src := threeImageFamilySets[int(random()*float64(len(threeImageFamilySets)))]
		families = make([]string, len(src))
		copy(families, src)
	}
	shuffleBlueprints(families, random)
	firstFamily := families[0]

	firstBandPool := []string{"F01", "F02", "F03"}
	shuffleBlueprints(firstBandPool, random)
	firstBand := firstBandPool[0]

	firstExprPool := []string{"E01", "E02", "E03", "E04", "E05"}
	shuffleBlueprints(firstExprPool, random)
	firstExpression := firstExprPool[0]

	firstCandidates := make([]XhsImageBlueprint, 0)
	for _, bp := range pool {
		if angleBand(bp.Name) != firstBand || expressionGroup(bp.Name) != firstExpression || silhouetteFamily(bp.Name) != firstFamily {
			continue
		}
		if angleAware && !isAngleCompatibleUpperAction(bp.Name) {
			continue
		}
		firstCandidates = append(firstCandidates, bp)
	}
	if len(firstCandidates) == 0 {
		return blueprints
	}
	first := firstCandidates[int(random()*float64(len(firstCandidates)))]

	remainingBands := filterOutString(allAngleBands, firstBand)
	shuffleBlueprints(remainingBands, random)
	selectedBands := remainingBands[:count-1]

	remainingExprs := filterOutString(allExpressionGroups, firstExpression)
	shuffleBlueprints(remainingExprs, random)
	selectedExpressions := remainingExprs[:count-1]

	secondary := make([]XhsImageBlueprint, 0, count-1)
	for index, family := range families[1:] {
		band := selectedBands[index]
		expression := selectedExpressions[index]
		candidates := make([]XhsImageBlueprint, 0)
		for _, bp := range pool {
			if angleBand(bp.Name) != band || expressionGroup(bp.Name) != expression || silhouetteFamily(bp.Name) != family {
				continue
			}
			if angleAware && !isAngleCompatibleUpperAction(bp.Name) {
				continue
			}
			candidates = append(candidates, bp)
		}
		if len(candidates) == 0 {
			return blueprints
		}
		secondary = append(secondary, candidates[int(random()*float64(len(candidates)))])
	}

	shuffleBlueprints(secondary, random)
	return append([]XhsImageBlueprint{first}, secondary...)
}
