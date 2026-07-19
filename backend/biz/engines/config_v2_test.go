package engines

import "testing"

func TestResolveCapabilities(t *testing.T) {
	if !ResolveCapabilities(nil).CopyEnabled {
		t.Fatal("legacy engine must keep copy enabled")
	}
	config := map[string]any{"engineV2": map[string]any{"capabilities": map[string]any{"copyEnabled": false}}}
	if ResolveCapabilities(config).CopyEnabled {
		t.Fatal("V2 copyEnabled=false must be respected")
	}
}

func TestResolveRuntimeConfigV2(t *testing.T) {
	config := map[string]any{"engineV2": map[string]any{
		"apiVersion": "content-engine/v2",
		"artifacts": map[string]any{
			"visualPlan":  map[string]any{"bridalTopics": []any{"测试主题"}},
			"imagePrompt": map[string]any{"imageTypeLines": map[string]any{"产品图": "Product image."}},
		},
	}}
	runtime, isV2, err := ResolveRuntimeConfig(config)
	if err != nil || !isV2 {
		t.Fatalf("resolve V2: isV2=%v err=%v", isV2, err)
	}
	if runtime["seeding"] == nil || runtime["imagePrompt"] == nil {
		t.Fatalf("runtime config lost artifacts: %#v", runtime)
	}
}

func TestResolveRuntimeConfigRejectsIncompleteV2(t *testing.T) {
	_, _, err := ResolveRuntimeConfig(map[string]any{"engineV2": map[string]any{
		"apiVersion": "content-engine/v2",
		"artifacts":  map[string]any{"visualPlan": map[string]any{}},
	}})
	if err == nil {
		t.Fatal("incomplete V2 config must be rejected")
	}
}
