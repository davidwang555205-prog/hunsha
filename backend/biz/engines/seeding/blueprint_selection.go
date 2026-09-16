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
	// v3.10.0 引入、当前对齐 mjs v3.11.1 的两个 MaxVisualDistance 策略：v3.11.0 起
	// count=3 改用三图角色结构（Proof -> Action Contrast -> Side-Safe 槽位 +
	// chooseMaxDistanceRoleBatch 穷举 + 角色文本注入 + 站姿断言），count=5 保持
	// Five-View 家族覆盖不变（仅追加站姿断言）。与 v3.6.0/v3.7.0 算法不同，
	// 随机数消耗顺序也不同，必须独立分支，不得复用旧函数。
	"contrastSilhouetteMaxVisualDistance": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastMaxVisualDistanceBlueprints(b, r, c, s, true)
	},
	"selfieContrastSilhouetteMaxVisualDistance": func(b []XhsImageBlueprint, r BlueprintSelectionRule, c int, s string) []XhsImageBlueprint {
		return selectContrastMaxVisualDistanceBlueprints(b, r, c, s, false)
	},
	// 2026-09 婚纱 macro 迁移配套策略：按蓝图 action 元数据做动作族多样性抽样，
	// 图1 固定 static_display + frontal + proofSafe 稳定证明帧。实现见 macro_action.go。
	"macroActionDiversity": selectMacroActionBlueprints,
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

// ===== v3.11.0/v3.11.1 三图角色结构（count=3）常量 =====
// 槽位约束：图1 Proof（F01 + U01/U02 + V01 + E01）、图2 Action Contrast
// （F02/F03 + E02/E03）、图3 Side-Safe（F04/F05 + E04/E05 + v3.11.1 起 U01-U06）。
// 对齐 mjs viewpoint-sampling v3.11.1 的 PROOF_SAFE_UPPER_ACTIONS / PROOF_EXPRESSIONS /
// ACTION_EXPRESSIONS / SIDE_EXPRESSIONS / SIDE_ANGLES / SIDE_COMPATIBLE_UPPER_ACTIONS。
var (
	proofSafeUpperActions = map[string]bool{"U01": true, "U02": true}
	proofExpressions      = map[string]bool{"E01": true}
	actionExpressions     = map[string]bool{"E02": true, "E03": true}
	sideExpressions       = map[string]bool{"E04": true, "E05": true}
	sideAngles            = map[string]bool{"F04": true, "F05": true}
	// sideCompatibleUpperActions v3.11.1 图3 侧身上肢白名单：避免大幅双臂展开
	// 迫使胸口转回正面。mjs isSideCompatibleUpperAction 另查 SIDE_ANGLES，
	// 图3 候选池已限定 F04/F05，此处只需 U 白名单即等价。
	sideCompatibleUpperActions = map[string]bool{"U01": true, "U02": true, "U03": true, "U04": true, "U05": true, "U06": true}
)

// standingForbiddenRe 非站姿姿势黑名单（忽略大小写、词边界）。
// 对齐 mjs viewpoint-sampling v3.11.0 的 STANDING_FORBIDDEN（/i）。
var standingForbiddenRe = regexp.MustCompile(`(?i)\b(?:seat(?:ed|ing)?|sitting|crouch(?:ed|ing)?|kneel(?:ed|ing)?|squat(?:ted|ting)?|floor sitting|half sitting)\b`)

// standingVariantRe 站姿支撑变体白名单 V01-V04。
// 对齐 mjs viewpoint-sampling v3.11.0 的 /^V0[1-4]$/。
var standingVariantRe = regexp.MustCompile(`^V0[1-4]$`)

// 三图角色文本，注入对应槽位蓝图 extraRequirement 前缀（角色文本 + 空格 + 原文）。
// 图3 注入顺序对齐 mjs：躯干转向锁 [+ PMS 物理转身锁] + 侧后安全文本。
// 对齐 mjs viewpoint-sampling v3.11.1 的 withThreeImageRoles。
const (
	roleProofText  = "IMAGE ROLE — PROOF. Create a stable standing, full-length product proof with the face, neckline, shoulder line, waistline, skirt volume, hemline, train and body-to-gown proportion clearly readable. Keep the upper action restrained and do not block the neckline or waistline."
	roleActionText = "IMAGE ROLE — ACTION CONTRAST. Keep a realistic standing fitting pose and execute the selected S, U and V assignments visibly; this frame must read as a different whole-body posture from image 1, not merely a gaze, expression, head-direction or camera change."
	// roleTorsoOrientationText v3.11.1 图3 最高优先级躯干转向锁（高于 S/U 指令）+ 正面替身禁令。
	roleTorsoOrientationText = "TORSO ORIENTATION LOCK — IMAGE 3. Image 3 must show a clearly side-turned torso. The bride's torso, shoulder line, chest plane and waist or pelvis direction must all rotate approximately 45–75 degrees away from frontal orientation. One shoulder must visibly sit closer to the viewer than the other. The neckline and bodice must show natural perspective foreshortening caused by the body turn. A frontal torso with only the head, gaze, arm, phone or camera angle changed does not satisfy this requirement. Do not keep the chest square to the viewer or use a frontal standing pose plus a sideways arm gesture as a substitute. For Image 3, TORSO ORIENTATION has higher priority than SILHOUETTE FAMILY and UPPER ACTION. If the selected upper-body action cannot remain clearly visible while preserving the required torso rotation, preserve the torso rotation and use an angle-compatible action instead of rotating the torso back toward frontal. FRONTAL SUBSTITUTION BAN — IMAGE 3. If both shoulders and the chest remain nearly parallel to the image plane, the pose is invalid. Image 3 must visibly read as a side-turned body even at thumbnail size."
	// roleSelfieTorsoText v3.11.1 PMS 图3 物理转身锁：手机朝镜面不能代替身体转向（仅 name 以 PMS- 开头的图3 注入）。
	roleSelfieTorsoText = "PMS PHYSICAL TURN LOCK — The bride's physical body must rotate relative to the mirror. The phone may remain aimed toward the mirror, but the torso itself must visibly turn 45–75 degrees. Do not keep both shoulders parallel to the mirror or preserve a frontal chest plane merely to make the phone selfie easier."
	roleSideSafeText    = "IMAGE ROLE — SIDE SAFE. Use a genuine side-profile or side-turned standing orientation. Slight natural side-back body surface is allowed, but do not create a full back-facing product presentation or invent any unseen back construction."
	roleBackSafeText    = "IMAGE ROLE — VERIFIED BACK-SAFE. Use the selected genuine side or three-quarter-back standing orientation and reproduce only back construction visibly supported by trusted uploaded references. Do not add or reinterpret any back detail."
)

// anglePosition 角度带映射到机位数值（用于视觉距离计算）。
// 对齐 mjs viewpoint-sampling v3.11.0 的 ANGLE_POSITION。
var anglePosition = map[string]int{
	"F01": 0, "F02": -1, "F03": 1, "F04": -2, "F05": 2,
}

// upperMotionClass 上半身动作映射到动作大类（用于视觉距离计算）。
// 对齐 mjs viewpoint-sampling v3.11.0 的 UPPER_MOTION_CLASS。
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
// 对齐 mjs viewpoint-sampling v3.11.0 的 visualDistance。
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

// actionContrastCount 计算两张蓝图在轮廓家族/上半身动作/支撑变体三个维度上的不同数。
// 对齐 mjs viewpoint-sampling v3.11.0 的 actionContrastCount。
func actionContrastCount(left, right string) int {
	n := 0
	if silhouetteFamily(left) != silhouetteFamily(right) {
		n++
	}
	if upperBodyGroup(left) != upperBodyGroup(right) {
		n++
	}
	if supportVariant(left) != supportVariant(right) {
		n++
	}
	return n
}

// allDistinct3 三值互不相同（对齐 mjs 的 new Set([...]).size === 3 判定）。
func allDistinct3(a, b, c string) bool {
	return a != b && a != c && b != c
}

// chooseMaxDistanceRoleBatch 从 proof/action/side 三组候选中穷举三元组：跳过
// 「图1图2 S/U/V 不同数 <2」「三张轮廓家族非全不同」「三张上半身动作非全不同」的组合，
// 在剩余组合中选「最小成对视觉距离最大（并列时总和最大）」者。
// 每组先按 random 洗牌（消耗随机数顺序与 mjs 一致：组 0 -> 组 1 -> 组 2 各洗一次），
// 穷举过程不消耗随机数。无合法三元组返回 nil（mjs throw 处，Go 由调用方降级）。
// 对齐 mjs viewpoint-sampling v3.11.0 的 chooseMaxDistanceRoleBatch。
func chooseMaxDistanceRoleBatch(groups [][]XhsImageBlueprint, random func() float64) []XhsImageBlueprint {
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
			if actionContrastCount(first.Name, second.Name) < 2 {
				continue
			}
			for _, third := range shuffled[2] {
				if !allDistinct3(silhouetteFamily(first.Name), silhouetteFamily(second.Name), silhouetteFamily(third.Name)) {
					continue
				}
				if !allDistinct3(upperBodyGroup(first.Name), upperBodyGroup(second.Name), upperBodyGroup(third.Name)) {
					continue
				}
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

// standingOnlyBatchOk 站姿断言：批次内每条蓝图的 name+purpose+description 拼接文本
// （空字段跳过，对齐 mjs filter(Boolean)）不得命中非站姿黑名单，且支撑变体必须为
// V01-V04。不扫 extraRequirement（standing lock 文本故意提到禁止姿势）。
// mjs 命中即 throw；Go 返回 false 由调用方降级。
// 对齐 mjs viewpoint-sampling v3.11.0 的 assertStandingOnlyBatch。
func standingOnlyBatchOk(batch []XhsImageBlueprint) bool {
	for _, bp := range batch {
		parts := make([]string, 0, 3)
		for _, s := range []string{bp.Name, bp.Purpose, bp.Description} {
			if s != "" {
				parts = append(parts, s)
			}
		}
		if standingForbiddenRe.MatchString(strings.Join(parts, " ")) {
			return false
		}
		if !standingVariantRe.MatchString(supportVariant(bp.Name)) {
			return false
		}
	}
	return true
}

// withThreeImageRoles 给三图角色批次的每条蓝图 extraRequirement 前置对应角色文本；
// backReferenceSafe=true 时第三张侧后安全文本用 VERIFIED BACK-SAFE，否则 SIDE SAFE（平台默认）。
// 图3 注入顺序：躯干转向锁 +（PMS 蓝图追加物理转身锁）+ 侧后安全文本。
// 对齐 mjs viewpoint-sampling v3.11.1 的 withThreeImageRoles。
func withThreeImageRoles(batch []XhsImageBlueprint, backReferenceSafe bool) []XhsImageBlueprint {
	sideText := roleSideSafeText
	if backReferenceSafe {
		sideText = roleBackSafeText
	}
	image3Text := roleTorsoOrientationText + " "
	if strings.HasPrefix(batch[2].Name, "PMS-") {
		image3Text += roleSelfieTorsoText + " "
	}
	image3Text += sideText
	texts := []string{roleProofText, roleActionText, image3Text}
	out := make([]XhsImageBlueprint, len(batch))
	for i, bp := range batch {
		out[i] = bp
		out[i].ExtraRequirement = texts[i] + " " + bp.ExtraRequirement
	}
	return out
}

// selectThreeImageRoleBatch 实现 mjs viewpoint-sampling v3.11.1 的三图角色结构选择：
// proof/action/side 三槽位候选池（均保 pool 原序，band 互斥故一条蓝图只入一池；
// 图3 v3.11.1 起另限 U01-U06 侧身兼容上肢）-> chooseMaxDistanceRoleBatch 穷举 ->
// 站姿断言 -> 角色文本注入。
// 随机数消耗：仅穷举前三组各洗牌一次（组 0 -> 组 1 -> 组 2），候选过滤不消耗。
// mjs 的 assertThreeImageRoleStructure / assertImage2ActionContrast / assertImage3SideSafe
// 由候选池构建与穷举跳过条件结构性保证（恒真），不单独断言。
// 候选池为空 / 无合法三元组 / 站姿断言失败时返回 nil，由调用方降级（mjs throw 处）。
func selectThreeImageRoleBatch(pool []XhsImageBlueprint, random func() float64, angleAware, backReferenceSafe bool) []XhsImageBlueprint {
	compatible := func(name string) bool { return !angleAware || isAngleCompatibleUpperAction(name) }
	var proof, action, side []XhsImageBlueprint
	for _, bp := range pool {
		band := angleBand(bp.Name)
		expr := expressionGroup(bp.Name)
		if band == "F01" && proofSafeUpperActions[upperBodyGroup(bp.Name)] &&
			supportVariant(bp.Name) == "V01" && proofExpressions[expr] && compatible(bp.Name) {
			proof = append(proof, bp)
		}
		if (band == "F02" || band == "F03") && actionExpressions[expr] && compatible(bp.Name) {
			action = append(action, bp)
		}
		if sideAngles[band] && sideExpressions[expr] && sideCompatibleUpperActions[upperBodyGroup(bp.Name)] && compatible(bp.Name) {
			side = append(side, bp)
		}
	}
	if len(proof) == 0 || len(action) == 0 || len(side) == 0 {
		return nil
	}
	batch := chooseMaxDistanceRoleBatch([][]XhsImageBlueprint{proof, action, side}, random)
	if batch == nil {
		return nil
	}
	if !standingOnlyBatchOk(batch) {
		return nil
	}
	return withThreeImageRoles(batch, backReferenceSafe)
}

// selfieBatchIsDistinct 自拍批次四维不重复断言：批次内任意两条的
// (angleBand, silhouetteFamily, upperBodyGroup, expressionGroup) 四元组均不同，
// 且第 3 张与第 1 张在任一维度都不重复。mjs 命中即 throw；Go 侧不抛错，返回 false
// 由调用方降级（正常 JSON 数据不触发）。mjs v3.11.0 仅对 count=3 批次执行本断言。
// 对齐 mjs viewpoint-sampling v3.11.0 的 assertDistinctSelfieBatch。
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

// selectContrastMaxVisualDistanceBlueprints 实现 mjs viewpoint-sampling v3.11.1 的
// contrastSilhouetteMaxVisualDistance（非自拍，angleAware=true）与
// selfieContrastSilhouetteMaxVisualDistance（自拍，angleAware=false）策略。
//
// v3.11.0 起 count=3 为三图角色结构（selectThreeImageRoleBatch）：图1 Proof
// （F01+U01/U02+V01+E01）、图2 Action Contrast（F02/F03+E02/E03，相对图1 S/U/V
// 至少两项不同）、图3 Side-Safe（F04/F05+E04/E05；backReferenceSafe=false 注入
// SIDE SAFE 角色文本，true 注入 VERIFIED BACK-SAFE），三组候选洗牌后穷举选
// 「最小成对视觉距离最大（并列时总和最大）」三元组，结果注入角色文本并过站姿断言。
// v3.11.1 图3 定向修复：候选池另限 U01-U06 侧身兼容上肢，注入文本前置
// TORSO ORIENTATION LOCK / FRONTAL SUBSTITUTION BAN（PMS 图3 另加 PHYSICAL TURN LOCK），
// 图1/图2 与穷举逻辑不变。
// count=5 保持 v3.10.0 起的 Five-View 家族覆盖 + 逐组随机选不变，v3.11.0 仅追加
// 站姿断言（standingOnlyBatchOk）。
// 自拍四维不重复断言（selfieBatchIsDistinct）mjs v3.11.0 仅对 count=3 生效。
//
// count=3 随机数消耗：仅穷举前三组各洗牌一次（组 0 -> 组 1 -> 组 2）。
// count=5 随机数消耗顺序与 mjs 严格一致：①families 洗牌 -> ②首 band 池洗牌 ->
// ③首 expression 洗牌 -> ④剩余 band 洗牌 -> ⑤剩余 expression 洗牌 ->
// ⑥逐组随机选 -> ⑦尾部洗牌 -> 站姿断言（不消耗随机数）。
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

	if count == 3 {
		// v3.11.0 三图角色结构；mjs 自拍四维断言仅对 count=3 生效（行 271）。
		batch := selectThreeImageRoleBatch(pool, random, angleAware, rule.BackReferenceSafe)
		if batch == nil {
			return blueprints
		}
		if !angleAware && !selfieBatchIsDistinct(batch) {
			return blueprints
		}
		return batch
	}

	// count == 5：Five-View 家族覆盖 + 逐组随机选（v3.10.0 起算法，v3.11.0 保持不变）。
	// ① families 全覆盖 S01-S05，orderedFamilies = shuffle(families)。
	families := []string{"S01", "S02", "S03", "S04", "S05"}
	shuffleBlueprints(families, random)
	firstFamily := families[0]

	// ② firstBand = shuffle(allBands ∩ {F01,F02,F03})[0]。
	allBands := []string{"F01", "F02", "F03", "F04", "F05"}
	firstBandPool := []string{"F01", "F02", "F03"}
	shuffleBlueprints(firstBandPool, random)
	firstBand := firstBandPool[0]

	// ③ firstExpression = shuffle(allExpressions)[0]。
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

	// ④ bands = shuffle(allBands - firstBand)[:count-1]。
	bands := filterOutString(allBands, firstBand)
	shuffleBlueprints(bands, random)
	bands = bands[:count-1]

	// ⑤ expressions = shuffle(allExpressions - firstExpression)[:count-1]。
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

	// ⑥ 逐组随机选一个。
	selected := make([]XhsImageBlueprint, 0, count)
	for _, candidates := range candidateGroups {
		selected = append(selected, candidates[int(random()*float64(len(candidates)))])
	}
	// ⑦ [selected[0], ...shuffle(selected[1:])]，v3.11.0 追加站姿断言（不消耗随机数）。
	tail := make([]XhsImageBlueprint, len(selected)-1)
	copy(tail, selected[1:])
	shuffleBlueprints(tail, random)
	result := append([]XhsImageBlueprint{selected[0]}, tail...)
	if !standingOnlyBatchOk(result) {
		return blueprints
	}
	return result
}
