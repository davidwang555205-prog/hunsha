package seeding

import (
	"regexp"
	"sort"
	"strings"
)

// blueprintSelector 单一策略的抽样实现签名。
type blueprintSelector func(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint

// blueprintSelectors 策略白名单（单一事实源）：selectBlueprints 分发与 admin
// 「给大模型的说明」文本（biz/engines prompt-helps）共用。新增策略必须在此登记实现；
// 未登记的策略名静默退回返回全部蓝图（生图链路不中断，但抽样失效）。
// v3.7.0 的两个 WithBatchDistinction 策略名：抽样算法与 v3.6.0 完全一致（复用
// selectContrastSilhouetteBlueprints），仅 prompt 层追加批次内动作区分约束
// （imagePrompt JSON 的 negativeLine + seeding JSON description 的英文 UPPER ACTION）。
var blueprintSelectors = map[string]blueprintSelector{
	"familySampling": func(b []XhsImageBlueprint, _ BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectFamilyBlueprints(b, "", c, s)
	},
	"familySamplingWithRequiredFirst": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectFamilyBlueprints(b, r.RequiredNamePrefix, c, s)
	},
	"angleBandExpressionSamplingWithFaceVisibleFirst": selectAngleExpressionDiverseBlueprints,
	"contrastSilhouetteAngleAwareSamplingWithFaceVisibleFirst": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastSilhouetteBlueprints(b, r, c, s, true)
	},
	"selfieContrastSilhouetteSamplingWithFaceVisibleFirst": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastSilhouetteBlueprints(b, r, c, s, false)
	},
	"contrastSilhouetteAngleAwareWithBatchDistinction": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastSilhouetteBlueprints(b, r, c, s, true)
	},
	"selfieContrastSilhouetteWithBatchDistinction": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastSilhouetteBlueprints(b, r, c, s, false)
	},
	// v3.10.0 起的两个 MaxVisualDistance 策略：count=3 改用最大视觉距离三元组
	// 穷举选择（chooseMaxDistanceTriple），与 v3.6.0/v3.7.0 随机抽取算法不同，
	// 随机数消耗顺序也不同，必须独立分支，不得复用旧函数。
	"contrastSilhouetteMaxVisualDistance": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastMaxVisualDistanceBlueprints(b, r, c, s, true)
	},
	"selfieContrastSilhouetteMaxVisualDistance": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastMaxVisualDistanceBlueprints(b, r, c, s, false)
	},
}

// BlueprintStrategyNames 平台支持的蓝图抽样策略名（含 fixed），排序返回。
// admin 说明文本由此生成，保证说明与白名单永远一致。
func BlueprintStrategyNames() []string {
	names := make([]string, 0, len(blueprintSelectors)+1)
	names = append(names, "fixed")
	for name := range blueprintSelectors {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// selectBlueprints 是通用、确定性的图组选择器。业务只在 JSON 中声明策略和固定首图，
// 不上传或执行业务 JavaScript。family 名称取蓝图 name 中“｜”后的 F01/F02…标记。
func selectBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint {
	if len(blueprints) <= count || rule.Strategy == "" || rule.Strategy == "fixed" {
		return blueprints
	}
	if sel, ok := blueprintSelectors[rule.Strategy]; ok {
		return sel(blueprints, rule, count, batchSeed)
	}
	return blueprints
}

// selectFamilyBlueprints familySampling / familySamplingWithRequiredFirst 的实现。
// requiredNamePrefix 非空时先匹配固定首图，匹配不到退回返回全部蓝图。
func selectFamilyBlueprints(blueprints []XhsImageBlueprint, requiredNamePrefix string, count int, batchSeed string) []XhsImageBlueprint {
	required := XhsImageBlueprint{}
	hasRequired := false
	if requiredNamePrefix != "" {
		for _, bp := range blueprints {
			if strings.HasPrefix(bp.Name, requiredNamePrefix) {
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

// threeImageAngleSets 是 v3.10.0 审核过的 3 张角度带组合（每组从 F01-F05 取 3 个，
// 且必含 F01/F02/F03 之一作为首图候选）。count=3 时按 seed 从中抽一组。
// 对齐 mjs viewpoint-sampling v3.10.1 的 THREE_IMAGE_ANGLE_SETS。
var threeImageAngleSets = [][]string{
	{"F01", "F02", "F05"},
	{"F01", "F03", "F04"},
	{"F02", "F03", "F05"},
	{"F02", "F04", "F05"},
	{"F03", "F04", "F05"},
}

// anglePosition 角度带映射到机位数值（用于视觉距离计算）。
// 对齐 mjs viewpoint-sampling v3.10.1 的 ANGLE_POSITION。
var anglePosition = map[string]int{
	"F01": 0, "F02": -1, "F03": 1, "F04": -2, "F05": 2,
}

// upperMotionClass 上半身动作映射到动作大类（用于视觉距离计算）。
// 对齐 mjs viewpoint-sampling v3.10.1 的 UPPER_MOTION_CLASS。
var upperMotionClass = map[string]string{
	"U01": "low", "U02": "low",
	"U03": "bent", "U04": "bent",
	"U05": "lateral", "U06": "lateral",
	"U07": "double", "U08": "double",
	"U09": "crossed", "U10": "crossed",
}

// visualDistance 计算两张蓝图的视觉距离（越大越不相似）。
// angleGap 取机位差绝对值并封顶 3；轮廓家族不同 +4，上半身动作大类不同 +3，
// 上半身动作不同 +2，支撑变体不同 +2，微表情组不同 +1。
// 对齐 mjs viewpoint-sampling v3.10.1 的 visualDistance。
func visualDistance(left, right string) int {
	angleGap := anglePosition[angleBand(left)] - anglePosition[angleBand(right)]
	if angleGap < 0 {
		angleGap = -angleGap
	}
	if angleGap > 3 {
		angleGap = 3
	}
	dist := angleGap * 3
	if silhouetteFamily(left) != silhouetteFamily(right) {
		dist += 4
	}
	if upperMotionClass[upperBodyGroup(left)] != upperMotionClass[upperBodyGroup(right)] {
		dist += 3
	}
	if upperBodyGroup(left) != upperBodyGroup(right) {
		dist += 2
	}
	if supportVariant(left) != supportVariant(right) {
		dist += 2
	}
	if expressionGroup(left) != expressionGroup(right) {
		dist += 1
	}
	return dist
}

// chooseMaxDistanceTriple 从三个候选组中穷举所有三元组，选「最小成对视觉距离最大
// （并列时总和最大）」的三元组。每组先按 random 洗牌（消耗随机数顺序与 mjs 一致：
// 组 0 -> 组 1 -> 组 2 各洗一次），穷举过程不消耗随机数。
// 对齐 mjs viewpoint-sampling v3.10.1 的 chooseMaxDistanceTriple。
func chooseMaxDistanceTriple(groups [][]XhsImageBlueprint, random func() float64) []XhsImageBlueprint {
	shuffled := make([][]XhsImageBlueprint, len(groups))
	for i, g := range groups {
		shuffled[i] = make([]XhsImageBlueprint, len(g))
		copy(shuffled[i], g)
		shuffleBlueprints(shuffled[i], random)
	}
	var best []XhsImageBlueprint
	bestMinimum := -1
	bestTotal := -1
	for _, first := range shuffled[0] {
		for _, second := range shuffled[1] {
			for _, third := range shuffled[2] {
				d12 := visualDistance(first.Name, second.Name)
				d13 := visualDistance(first.Name, third.Name)
				d23 := visualDistance(second.Name, third.Name)
				minimum := d12
				if d13 < minimum {
					minimum = d13
				}
				if d23 < minimum {
					minimum = d23
				}
				total := d12 + d13 + d23
				if minimum > bestMinimum || (minimum == bestMinimum && total > bestTotal) {
					best = []XhsImageBlueprint{first, second, third}
					bestMinimum = minimum
					bestTotal = total
				}
			}
		}
	}
	return best
}

// selfieBatchIsDistinct 自拍批次四维不重复断言：批次内任意两条的
// (angleBand, silhouetteFamily, upperBodyGroup, expressionGroup) 四元组均不同，
// 且第 3 张与第 1 张在任一维度都不重复。mjs 命中即 throw；Go 侧不抛错，返回 false
// 由调用方降级（正常 JSON 数据不触发，chooseMaxDistanceTriple 已倾向选最大距离）。
// 对齐 mjs viewpoint-sampling v3.10.1 的 assertDistinctSelfieBatch。
func selfieBatchIsDistinct(batch []XhsImageBlueprint) bool {
	if len(batch) < 3 {
		return true
	}
	seen := make(map[string]bool, len(batch))
	for _, item := range batch {
		key := angleBand(item.Name) + "|" + silhouetteFamily(item.Name) + "|" +
			upperBodyGroup(item.Name) + "|" + expressionGroup(item.Name)
		if seen[key] {
			return false
		}
		seen[key] = true
	}
	return angleBand(batch[0].Name) != angleBand(batch[2].Name) &&
		silhouetteFamily(batch[0].Name) != silhouetteFamily(batch[2].Name) &&
		upperBodyGroup(batch[0].Name) != upperBodyGroup(batch[2].Name) &&
		expressionGroup(batch[0].Name) != expressionGroup(batch[2].Name)
}

// selectContrastMaxVisualDistanceBlueprints 实现 mjs viewpoint-sampling v3.10.1 的
// contrastSilhouetteMaxVisualDistance（非自拍，angleAware=true）与
// selfieContrastSilhouetteMaxVisualDistance（自拍，angleAware=false）策略。
//
// 与 v3.6.0/v3.7.0 的 WithBatchDistinction 核心差异：count=3 时不再随机抽取首图与
// 次图，而是按审核过的 5 组角度带组合（threeImageAngleSets）确定三张角度带，穷举
// 三组候选的所有三元组，选「最小成对视觉距离最大（并列时总和最大）」的三元组
// （chooseMaxDistanceTriple），保证三张视觉差异最大化；自拍策略在选完后追加四维
// 不重复断言（selfieBatchIsDistinct）。count=5 仍按家族覆盖 + 逐组随机选 + 尾部洗牌。
//
// 消耗随机数的顺序与 mjs 严格一致：①count==3 抽家族组 -> ②families 洗牌 ->
// ③count==3 抽角度组 -> ④首 band 池（selectedBands ∩ F01-F03）洗牌 ->
// ⑤首 expression 池洗牌 -> ⑥剩余 band 洗牌 -> ⑦剩余 expression 洗牌 ->
// count==3: ⑧三组候选各洗牌后穷举 / count==5: ⑨逐组随机选 + ⑩尾部洗牌。
// 相同 batchSeed 复现相同结果。requiredNamePrefix 作为主题候选池前缀。
// 数据不足以满足策略时降级返回原蓝图顺序（mjs throw 处改为降级，正常 JSON 不触发）。
func selectContrastMaxVisualDistanceBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string, angleAware bool) []XhsImageBlueprint {
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

	// ① families：count==5 全覆盖 S01-S05；count==3 从 5 组家族组合抽一组。
	var families []string
	if count == 5 {
		families = []string{"S01", "S02", "S03", "S04", "S05"}
	} else {
		src := threeImageFamilySets[int(random()*float64(len(threeImageFamilySets)))]
		families = make([]string, len(src))
		copy(families, src)
	}
	// ② orderedFamilies = shuffle(families)。
	shuffleBlueprints(families, random)
	firstFamily := families[0]

	// ③ selectedBands：count==3 从 5 组角度组抽一组；count==5 全 F01-F05。
	var selectedBands []string
	if count == 3 {
		src := threeImageAngleSets[int(random()*float64(len(threeImageAngleSets)))]
		selectedBands = make([]string, len(src))
		copy(selectedBands, src)
	} else {
		selectedBands = []string{"F01", "F02", "F03", "F04", "F05"}
	}

	// ④ firstBand = shuffle(selectedBands ∩ {F01,F02,F03})[0]。
	firstBandPool := make([]string, 0, 3)
	for _, band := range selectedBands {
		if band == "F01" || band == "F02" || band == "F03" {
			firstBandPool = append(firstBandPool, band)
		}
	}
	shuffleBlueprints(firstBandPool, random)
	firstBand := firstBandPool[0]

	// ⑤ firstExpression = shuffle(allExpressions)[0]。
	firstExprPool := []string{"E01", "E02", "E03", "E04", "E05"}
	shuffleBlueprints(firstExprPool, random)
	firstExpression := firstExprPool[0]

	// candidatesFor：按 (band, expression, family) 过滤，angleAware 时追加角度约束。
	candidatesFor := func(band, expression, family string) []XhsImageBlueprint {
		out := make([]XhsImageBlueprint, 0)
		for _, bp := range pool {
			if angleBand(bp.Name) != band || expressionGroup(bp.Name) != expression || silhouetteFamily(bp.Name) != family {
				continue
			}
			if angleAware && !isAngleCompatibleUpperAction(bp.Name) {
				continue
			}
			out = append(out, bp)
		}
		return out
	}

	// ⑥ bands：count==3 = shuffle(selectedBands - firstBand)；count==5 = shuffle(allBands - firstBand)[:count-1]。
	// count==5 时 selectedBands == allBands，两者等价；统一从 selectedBands 去首。
	bands := make([]string, 0, len(selectedBands)-1)
	for _, band := range selectedBands {
		if band != firstBand {
			bands = append(bands, band)
		}
	}
	shuffleBlueprints(bands, random)
	if count == 5 {
		bands = bands[:count-1]
	}

	// ⑦ expressions = shuffle(allExpressions - firstExpression)[:count-1]。
	remainingExprs := filterOutString(allExpressionGroups, firstExpression)
	shuffleBlueprints(remainingExprs, random)
	expressions := remainingExprs[:count-1]

	// 构建候选组：首组 + families[1:] 对应 (bands[i], expressions[i], family)。
	firstCandidates := candidatesFor(firstBand, firstExpression, firstFamily)
	if len(firstCandidates) == 0 {
		return blueprints
	}
	candidateGroups := make([][]XhsImageBlueprint, 0, count)
	candidateGroups = append(candidateGroups, firstCandidates)
	for index, family := range families[1:] {
		candidates := candidatesFor(bands[index], expressions[index], family)
		if len(candidates) == 0 {
			return blueprints
		}
		candidateGroups = append(candidateGroups, candidates)
	}

	if count == 3 {
		// ⑧ 每组候选洗牌后穷举选最大最小成对距离三元组。
		best := chooseMaxDistanceTriple(candidateGroups, random)
		if best == nil {
			return blueprints
		}
		if !angleAware && !selfieBatchIsDistinct(best) {
			return blueprints
		}
		return best
	}

	// count == 5：⑨ 逐组随机选一个。
	selected := make([]XhsImageBlueprint, 0, count)
	for _, candidates := range candidateGroups {
		selected = append(selected, candidates[int(random()*float64(len(candidates)))])
	}
	// ⑩ [selected[0], ...shuffle(selected[1:])]。
	tail := make([]XhsImageBlueprint, len(selected)-1)
	copy(tail, selected[1:])
	shuffleBlueprints(tail, random)
	return append([]XhsImageBlueprint{selected[0]}, tail...)
}
