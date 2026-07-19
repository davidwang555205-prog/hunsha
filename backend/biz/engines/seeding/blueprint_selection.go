package seeding

import (
	"strings"
)

// selectBlueprints 是通用、确定性的图组选择器。业务只在 JSON 中声明策略和固定首图，
// 不上传或执行业务 JavaScript。family 名称取蓝图 name 中“｜”后的 F01/F02…标记。
func selectBlueprints(blueprints []XhsImageBlueprint, rule BlueprintSelectionRule, count int, batchSeed string) []XhsImageBlueprint {
	if len(blueprints) <= count || rule.Strategy == "" || rule.Strategy == "fixed" {
		return blueprints
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
