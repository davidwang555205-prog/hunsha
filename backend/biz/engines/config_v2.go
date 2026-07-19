package engines

import "fmt"

const engineV2ConfigKey = "engineV2"

// Capabilities 是工作台和生图链路都需要读取的通用引擎能力。
// 旧引擎没有该配置，保持婚纱的“生成文案”行为。
type Capabilities struct {
	CopyEnabled bool `json:"copyEnabled"`
}

// ResolveCapabilities 读取引擎能力。只有 V2 引擎允许关闭文案；旧配置始终兼容为开启。
func ResolveCapabilities(config map[string]any) Capabilities {
	v2, ok := config[engineV2ConfigKey].(map[string]any)
	if !ok {
		return Capabilities{CopyEnabled: true}
	}
	caps, ok := v2["capabilities"].(map[string]any)
	if !ok {
		return Capabilities{CopyEnabled: true}
	}
	copyEnabled, ok := caps["copyEnabled"].(bool)
	if !ok {
		return Capabilities{CopyEnabled: true}
	}
	return Capabilities{CopyEnabled: copyEnabled}
}

// ResolveRuntimeConfig 将 V2 文件包适配到现有确定性运行时。
// V2 的 visualPlan/imagePrompt 均为完整模块，避免新类目通过缺少 seeding 意外回退到婚纱素材。
// 返回的 config 仍使用旧键名，仅作为 seeding/prompt 运行时的兼容输入。
func ResolveRuntimeConfig(config map[string]any) (map[string]any, bool, error) {
	v2, ok := config[engineV2ConfigKey].(map[string]any)
	if !ok {
		return config, false, nil
	}
	if version, _ := v2["apiVersion"].(string); version != "content-engine/v2" {
		return nil, true, fmt.Errorf("引擎 V2 apiVersion 必须为 content-engine/v2")
	}
	artifacts, ok := v2["artifacts"].(map[string]any)
	if !ok {
		return nil, true, fmt.Errorf("引擎 V2 缺少 artifacts")
	}
	visualPlan, ok := artifacts["visualPlan"].(map[string]any)
	if !ok || len(visualPlan) == 0 {
		return nil, true, fmt.Errorf("引擎 V2 缺少 visualPlan")
	}
	imagePrompt, ok := artifacts["imagePrompt"].(map[string]any)
	if !ok || len(imagePrompt) == 0 {
		return nil, true, fmt.Errorf("引擎 V2 缺少 imagePrompt")
	}
	return map[string]any{
		"seeding":     visualPlan,
		"imagePrompt": imagePrompt,
	}, true, nil
}

// ValidateConfig 校验新旧引擎配置。V2 的模块完整性在创建/更新时即阻止错误发布。
func ValidateConfig(config map[string]any) error {
	_, isV2, err := ResolveRuntimeConfig(config)
	if err != nil {
		return err
	}
	if !isV2 {
		return nil
	}
	return nil
}
