package generation

import (
	"testing"

	"bridal/backend/config"
)

func TestModelIDWithTaskFallbackUsesOnlyMissingInvocationValue(t *testing.T) {
	if got := modelIDWithTaskFallback("gpt-image-2", "dall-e-3"); got != "gpt-image-2" {
		t.Fatalf("existing invocation model = %q, want gpt-image-2", got)
	}
	if got := modelIDWithTaskFallback("  ", "dall-e-3"); got != "dall-e-3" {
		t.Fatalf("missing invocation model = %q, want task snapshot", got)
	}
}

func TestNormalizedImageModelIDFallsBackToConfiguredDefault(t *testing.T) {
	u := &Usecase{cfg: &config.Config{Bridal: config.Bridal{WalaImageModel: "gpt-image-2"}}}
	if got := u.normalizedImageModelID(" "); got != "gpt-image-2" {
		t.Fatalf("blank channel model = %q, want configured default", got)
	}
	if got := u.normalizedImageModelID("custom-image-model"); got != "custom-image-model" {
		t.Fatalf("configured channel model = %q, want custom-image-model", got)
	}
}
