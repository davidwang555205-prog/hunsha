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
