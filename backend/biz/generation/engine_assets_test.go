package generation

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestResolveImagePromptEngine_UsesSelectedCategoryEngine(t *testing.T) {
	categoryID := uuid.New()
	u := &Usecase{repo: &fakeRepo{categoryEngine: &CategoryEngine{
		Engine:    "birdalv1",
		IsEnabled: true,
	}}}

	got, err := u.resolveImagePromptEngine(context.Background(), categoryID)
	if err != nil {
		t.Fatalf("resolveImagePromptEngine() error = %v", err)
	}
	if got != "birdalv1" {
		t.Fatalf("resolveImagePromptEngine() = %q, want birdalv1", got)
	}
}

func TestResolveImagePromptEngine_DefaultsOnlyWithoutCategory(t *testing.T) {
	u := &Usecase{repo: &fakeRepo{}}

	got, err := u.resolveImagePromptEngine(context.Background(), uuid.Nil)
	if err != nil {
		t.Fatalf("resolveImagePromptEngine() error = %v", err)
	}
	if got != defaultEngineKey {
		t.Fatalf("resolveImagePromptEngine() = %q, want %q", got, defaultEngineKey)
	}
}

func TestResolveImagePromptEngine_RejectsDisabledCategory(t *testing.T) {
	u := &Usecase{repo: &fakeRepo{categoryEngine: &CategoryEngine{
		Engine:    "birdalv1",
		IsEnabled: false,
	}}}

	if _, err := u.resolveImagePromptEngine(context.Background(), uuid.New()); err == nil {
		t.Fatal("disabled category must not fall back to the default engine")
	}
}
