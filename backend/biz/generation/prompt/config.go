package prompt

import (
	"encoding/json"
	"fmt"
)

// ParseAssetsFromConfig 从内容引擎 config 的 imagePrompt 字段解析素材配置。
// config 为空 / 无 imagePrompt key / 解析失败均返回 nil，调用方应使用 DefaultAssets 降级。
// 供 generation（生图加载）与 engines（前端选项 / 编辑回填）共用，解析逻辑单点收口于此。
func ParseAssetsFromConfig(config map[string]any) *Assets {
	if len(config) == 0 {
		return nil
	}
	raw, ok := config["imagePrompt"]
	if !ok || raw == nil {
		return nil
	}
	b, err := json.Marshal(raw)
	if err != nil {
		return nil
	}
	var a Assets
	if err := json.Unmarshal(b, &a); err != nil {
		return nil
	}
	return &a
}

// ParseAssetsFromConfigStrict 按 engineKey 严格解析 imagePrompt 素材（P-1B）。
// bridal 引擎保持 ParseAssetsFromConfig 的兼容降级（nil -> 调用方用 DefaultAssets），
// 维持"无 categoryId 旧婚纱请求仍可生成"（§11.4 P-1 Gate）。
// shoe/garment 引擎在 imagePrompt 缺失或解析失败时返回错误，绝不静默降级到婚纱默认（§11.1/§11.4）。
func ParseAssetsFromConfigStrict(config map[string]any, engineKey string) (*Assets, error) {
	if engineKey != "shoe" && engineKey != "garment" {
		return ParseAssetsFromConfig(config), nil
	}
	if len(config) == 0 {
		return nil, fmt.Errorf("引擎 %q 缺少 imagePrompt 配置，不能降级到婚纱默认", engineKey)
	}
	raw, ok := config["imagePrompt"]
	if !ok || raw == nil {
		return nil, fmt.Errorf("引擎 %q 缺少 imagePrompt 配置，不能降级到婚纱默认", engineKey)
	}
	b, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("引擎 %q imagePrompt 序列化失败: %w", engineKey, err)
	}
	var a Assets
	if err := json.Unmarshal(b, &a); err != nil {
		return nil, fmt.Errorf("引擎 %q imagePrompt 解析失败: %w", engineKey, err)
	}
	return &a, nil
}
