package prompt

import (
	"testing"
	"unicode"
)

// 本文件守护“最终喂给大模型的 prompt 必须全英文”这一硬性要求。
// 任何把中文（含全角字符）写进素材 value 或拼装逻辑的回归，都会被这两个测试抓住。
//
// 约定：中文只允许出现在 map key / 参数值（imageType/场景名/款式名/季节/光线等），
// 它们只用于查表与匹配，绝不拼进最终 prompt。拼进去的只能是英文 value。

// hasOutputCJK 检测是否含 CJK 字符（汉字/日文/韩文/全角），用于审计最终 prompt 是否全英文。
func hasOutputCJK(s string) bool {
	for _, r := range s {
		if unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana, unicode.Hangul) {
			return true
		}
		if r >= 0xFF00 && r <= 0xFFEF { // 半角全角形式（全角字母数字/标点）
			return true
		}
		if r == 0x3000 { // 全角空格
			return true
		}
	}
	return false
}

// TestAssetsValuesAllEnglish 遍历所有“会进 prompt”的素材 value，确认无 CJK。
// MaterialImageTypes/WornImageTypes/*ScenesByImageType 的元素是中文参数值（imageType/场景名），
// 只用于查表/匹配，不直接进 prompt，故不检查。
func TestAssetsValuesAllEnglish(t *testing.T) {
	a := &DefaultAssets
	check := func(label, v string) {
		if hasOutputCJK(v) {
			t.Errorf("%s 含 CJK: %q", label, v)
		}
	}
	for k, v := range a.CategoryLines {
		check("CategoryLines["+k+"]", v)
	}
	for k, v := range a.BridalStyleLines {
		check("BridalStyleLines["+k+"]", v)
	}
	for k, v := range a.DressStyleLines {
		check("DressStyleLines["+k+"]", v)
	}
	for k, v := range a.ImageTypeLines {
		check("ImageTypeLines["+k+"]", v)
	}
	for k, v := range a.SceneLines {
		check("SceneLines["+k+"]", v)
	}
	for k, v := range a.ModelLines {
		check("ModelLines["+k+"]", v)
	}
	for k, v := range a.SeasonLines {
		check("SeasonLines["+k+"]", v)
	}
	for k, v := range a.LightLines {
		check("LightLines["+k+"]", v)
	}
	for k, p := range a.BridalImageKeywordProfiles {
		check("Profile["+k+"].PromptLine", p.PromptLine)
		check("Profile["+k+"].NegativeLine", p.NegativeLine)
	}
	for _, d := range a.BridalReferenceDetails {
		check("BridalReferenceDetails", d)
	}
	for _, d := range a.DressReferenceDetails {
		check("DressReferenceDetails", d)
	}
	for _, d := range a.NegativeRules {
		check("NegativeRules", d)
	}
	for _, d := range phoneSeriesShotPlans {
		check("phoneSeriesShotPlans", d)
	}
	check("phoneSpecification", phoneSpecification)
	check("brandDirection", brandDirection)
	check("compositionLine", compositionLine)
	check("cameraFeelLine", cameraFeelLine)
	check("buildSceneLockLine", buildSceneLockLine())
}

// TestOutputAllEnglish 遍历代表性边界用例的实际 GeneratePrompt 输出，确认全英文。
// 重点覆盖会漏中文的雷区：customProductName 含中文、extraRequirement 含中文/中英混合、
// SceneLocked、图组系列、手机自拍系列分镜、自动匹配轮转、婚纱+裙装两品类。
func TestOutputAllEnglish(t *testing.T) {
	cases := []struct {
		name string
		p    Params
		ctx  SeriesContext
	}{
		{"bridal_worn", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "极简缎面婚纱", ImageType: "产品上身图", ModelChoice: "亚洲新娘感模特 25–35", Season: "春", ScenePreference: "自动匹配", LightPreference: "自动匹配"}, SeriesContext{}},
		{"bridal_mirror_lead", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "自定义", CustomProductName: "Satin A-line Gown", ImageType: "对镜穿搭图", ModelChoice: "高级婚纱店真实试纱客户", Season: "夏", ScenePreference: "试纱间", LightPreference: "午后柔光", BridalKeywordProfileID: "phoneMirrorSelfieFitting"}, SeriesContext{Index: 0, Total: 3, LeadPersonIndex: 0, LeadPhoneIndex: 0}},
		{"bridal_mirror_f2", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "自定义", CustomProductName: "Satin A-line Gown", ImageType: "对镜穿搭图", ModelChoice: "高级婚纱店真实试纱客户", Season: "夏", ScenePreference: "试纱间", LightPreference: "午后柔光", BridalKeywordProfileID: "phoneMirrorSelfieFitting"}, SeriesContext{Index: 1, Total: 3, LeadPersonIndex: 0, LeadPhoneIndex: 0}},
		{"bridal_lifestyle_series", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "法式蕾丝婚纱", ImageType: "生活场景图", ModelChoice: "亚洲新娘感模特 25–35", Season: "冬", ScenePreference: "海边旅拍", LightPreference: "婚礼现场自然光"}, SeriesContext{Index: 2, Total: 5, LeadPersonIndex: 0, LeadPhoneIndex: -1}},
		{"bridal_atmosphere", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "鱼尾婚纱", ImageType: "非产品氛围图", ModelChoice: "亚洲新娘感模特 25–35", Season: "秋", ScenePreference: "自动匹配", LightPreference: "室内窗边光"}, SeriesContext{}},
		{"bridal_material", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "公主裙婚纱", ImageType: "拍摄花絮 / 材质图", ModelChoice: "不指定人物，仅产品静物", Season: "春", ScenePreference: "自动匹配", LightPreference: "清晨自然光"}, SeriesContext{}},
		{"bridal_stilllife", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "轻婚纱", ImageType: "产品静物图", ModelChoice: "不指定人物，仅产品静物", Season: "夏", ScenePreference: "自动匹配", LightPreference: "酒店暖光"}, SeriesContext{}},
		{"custom_cjk_name", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "极简缎面婚纱", CustomProductName: "我的中文婚纱名", ImageType: "产品上身图", ModelChoice: "亚洲新娘感模特 25–35", Season: "春", ScenePreference: "自动匹配", LightPreference: "自动匹配"}, SeriesContext{}},
		{"extra_cjk_dropped", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "极简缎面婚纱", ImageType: "产品上身图", ModelChoice: "亚洲新娘感模特 25–35", Season: "春", ScenePreference: "自动匹配", LightPreference: "自动匹配", ExtraRequirement: "希望突出裙摆的层次感"}, SeriesContext{}},
		{"extra_english_kept", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "极简缎面婚纱", ImageType: "产品上身图", ModelChoice: "亚洲新娘感模特 25–35", Season: "春", ScenePreference: "自动匹配", LightPreference: "自动匹配", ExtraRequirement: "soft morning light, gentle drape"}, SeriesContext{}},
		{"extra_mixed_dropped", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "极简缎面婚纱", ImageType: "产品上身图", ModelChoice: "亚洲新娘感模特 25–35", Season: "春", ScenePreference: "自动匹配", LightPreference: "自动匹配", ExtraRequirement: "soft light 加点红色细节"}, SeriesContext{}},
		{"scene_locked", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "极简缎面婚纱", ImageType: "产品上身图", ModelChoice: "亚洲新娘感模特 25–35", Season: "春", ScenePreference: "自动匹配", LightPreference: "自动匹配", SceneLocked: true}, SeriesContext{}},
		{"auto_scene_rotate_n3", Params{ProductCategory: "婚纱 / 礼服", BridalStyle: "公主裙婚纱", ImageType: "产品上身图", ModelChoice: "晚宴礼服气质模特", Season: "春", ScenePreference: "自动匹配", LightPreference: "室内窗边光", GenerationNonce: 3}, SeriesContext{}},
		{"dress_stilllife", Params{ProductCategory: "裙装 / 女装", DressStyle: "连衣裙", ImageType: "产品静物图", ModelChoice: "不指定人物，仅产品静物", Season: "秋", ScenePreference: "自动匹配", LightPreference: "傍晚金色光"}, SeriesContext{}},
		{"dress_worn", Params{ProductCategory: "裙装 / 女装", DressStyle: "通勤裙", ImageType: "产品上身图", ModelChoice: "通勤裙装城市女性", Season: "冬", ScenePreference: "自动匹配", LightPreference: "自动匹配"}, SeriesContext{}},
		{"dress_mirror_custom_en", Params{ProductCategory: "裙装 / 女装", DressStyle: "自定义", CustomProductName: "Knit Midi Dress", ImageType: "对镜穿搭图", ModelChoice: "轻熟风裙装模特 28–40", Season: "夏", ScenePreference: "电梯镜拍", LightPreference: "午后柔光"}, SeriesContext{}},
		{"dress_lifestyle_series", Params{ProductCategory: "裙装 / 女装", DressStyle: "度假长裙", ImageType: "生活场景图", ModelChoice: "度假裙装自然模特", Season: "夏", ScenePreference: "度假海边", LightPreference: "傍晚金色光"}, SeriesContext{Index: 1, Total: 4, LeadPersonIndex: 0, LeadPhoneIndex: -1}},
	}

	for _, c := range cases {
		got := GeneratePrompt(c.p, c.ctx, nil)
		if hasOutputCJK(got) {
			t.Errorf("用例 %s 输出含 CJK（应全英文）:\n%s", c.name, got)
		}
	}
}
