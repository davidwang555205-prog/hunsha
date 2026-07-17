package seeding

import (
	_ "embed"
	"encoding/json"
	"sync"
)

//go:embed assets.json
var assetsJSON []byte

var (
	assetsOnce    sync.Once
	loadedAssets  *Assets
	assetsLoadErr error
)

// loadAssets 加载内嵌 assets.json（默认素材）。配置化阶段用 MergeAssets 覆盖。
func loadAssets() (*Assets, error) {
	assetsOnce.Do(func() {
		var a Assets
		if err := json.Unmarshal(assetsJSON, &a); err != nil {
			assetsLoadErr = err
			return
		}
		loadedAssets = &a
	})
	return loadedAssets, assetsLoadErr
}

// DefaultAssets 返回内嵌默认素材（线程安全，懒加载）。
func DefaultAssets() *Assets {
	a, err := loadAssets()
	if err != nil {
		panic("seeding: unmarshal assets.json: " + err.Error())
	}
	return a
}

// MergeAssets 用 config["seeding"] 深度覆盖 defaultAssets（递归 map 合并，slice/标量整体覆盖）。
// 全素材覆盖：config.seeding 的字段覆盖默认，未配字段保留默认。用于运行时从
// content_engines.config 加载覆盖素材（复刻前端 setTopicOverrides 机制并扩展到全素材）。
// 永不阻塞：config nil/无 seeding/解析失败均回退默认。
func MergeAssets(defaultAssets *Assets, config map[string]any) *Assets {
	if defaultAssets == nil {
		defaultAssets = DefaultAssets()
	}
	if config == nil {
		return defaultAssets
	}
	seeding, ok := config["seeding"]
	if !ok {
		return defaultAssets
	}
	seedingMap, ok := seeding.(map[string]any)
	if !ok {
		return defaultAssets
	}
	defaultBytes, err := json.Marshal(defaultAssets)
	if err != nil {
		return defaultAssets
	}
	var defaultAny map[string]any
	if err := json.Unmarshal(defaultBytes, &defaultAny); err != nil {
		return defaultAssets
	}
	deepMerge(defaultAny, seedingMap)
	// 兼容已保存的旧白名单：旧字段没有新主题数组时，迁移为新的主题来源。
	if _, hasNew := seedingMap["bridalTopics"]; !hasNew {
		if legacy, ok := seedingMap["visibleBridalTopics"]; ok {
			defaultAny["bridalTopics"] = legacy
		}
	}
	if _, hasNew := seedingMap["dressTopics"]; !hasNew {
		if legacy, ok := seedingMap["visibleDressTopics"]; ok {
			defaultAny["dressTopics"] = legacy
		}
	}
	mergedBytes, err := json.Marshal(defaultAny)
	if err != nil {
		return defaultAssets
	}
	var result Assets
	if err := json.Unmarshal(mergedBytes, &result); err != nil {
		return defaultAssets
	}
	return &result
}

// deepMerge 递归合并 src 到 dst：map 递归合并，slice/标量整体覆盖，nil 跳过。
func deepMerge(dst, src map[string]any) {
	for k, v := range src {
		if v == nil {
			continue
		}
		if vMap, ok := v.(map[string]any); ok {
			if dMap, ok := dst[k].(map[string]any); ok {
				deepMerge(dMap, vMap)
				continue
			}
		}
		dst[k] = v
	}
}
