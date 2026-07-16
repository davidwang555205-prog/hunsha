package prompt

import "encoding/json"

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
