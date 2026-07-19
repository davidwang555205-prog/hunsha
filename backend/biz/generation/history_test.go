package generation

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSanitizeIncludesCategoryIDWhenTaskIsCategorized(t *testing.T) {
	categoryID := uuid.New()
	got := sanitize(TaskRecord{ID: uuid.New(), UserID: uuid.New(), CategoryID: categoryID})
	if got.CategoryID == nil || *got.CategoryID != categoryID.String() {
		t.Fatalf("CategoryID = %v, want %q", got.CategoryID, categoryID)
	}
}

func TestSanitizeOmitsCategoryIDForLegacyTask(t *testing.T) {
	got := sanitize(TaskRecord{ID: uuid.New(), UserID: uuid.New()})
	if got.CategoryID != nil {
		t.Fatalf("CategoryID = %q, want nil for legacy task", *got.CategoryID)
	}
}

func TestSanitizeIncludesChannelAndTaskDuration(t *testing.T) {
	startedAt := time.Date(2026, 7, 19, 1, 0, 0, 0, time.UTC)
	completedAt := startedAt.Add(73*time.Second + 250*time.Millisecond)
	got := sanitize(TaskRecord{
		ID:          uuid.New(),
		UserID:      uuid.New(),
		Model:       "gpt-image-2",
		ChannelName: "WalaAPI 默认",
		StartedAt:   &startedAt,
		CompletedAt: &completedAt,
	})
	if got.ChannelName != "WalaAPI 默认" {
		t.Fatalf("ChannelName = %q", got.ChannelName)
	}
	if got.DurationMs != 73_250 {
		t.Fatalf("DurationMs = %d, want 73250", got.DurationMs)
	}
}
