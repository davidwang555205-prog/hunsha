package generation

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"bridal/backend/domain"
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

func TestSanitizeIncludesProgressFields(t *testing.T) {
	rec := TaskRecord{
		ID:             uuid.New(),
		UserID:         uuid.New(),
		Status:         "processing",
		TotalCount:       5,
		CompletedCount:   2,
		EstimatedSeconds: 270,
		SubTaskStatus: []SubTaskStatusItem{
			{Index: 0, Status: "success"},
			{Index: 1, Status: "failed"},
			{Index: 2, Status: "processing"},
		},
	}
	got := sanitize(rec)
	if got.Status != "processing" {
		t.Fatalf("Status = %q, want processing", got.Status)
	}
	if got.TotalCount != 5 {
		t.Fatalf("TotalCount = %d, want 5", got.TotalCount)
	}
	if got.CompletedCount != 2 {
		t.Fatalf("CompletedCount = %d, want 2", got.CompletedCount)
	}
	if got.EstimatedSeconds != 270 {
		t.Fatalf("EstimatedSeconds = %d, want 270", got.EstimatedSeconds)
	}
	if len(got.SubTaskStatus) != 3 {
		t.Fatalf("SubTaskStatus len = %d, want 3", len(got.SubTaskStatus))
	}
}

// historyFakeRepo 用于验证 ListHistory  finishedOnly 行为。
type historyFakeRepo struct {
	fakeRepo
	gotFinishedOnly bool
	records         []TaskRecord
}

func (r *historyFakeRepo) ListTasksPaged(_ context.Context, _ uuid.UUID, _ bool, _, _ int, _ string, _, _ *time.Time, _, _, _ uuid.UUID, finishedOnly bool) ([]TaskRecord, int, error) {
	r.gotFinishedOnly = finishedOnly
	return r.records, len(r.records), nil
}

func TestListHistoryIncludesActiveTasksForUser(t *testing.T) {
	userID := uuid.New()
	user := &domain.User{ID: userID, Role: "subaccount"}
	repo := &historyFakeRepo{
		records: []TaskRecord{
			{ID: uuid.New(), UserID: userID, Status: "processing", TotalCount: 3, CompletedCount: 1},
		},
	}
	uc := &Usecase{repo: repo}
	recs, _, err := uc.ListHistory(context.Background(), user, 1, 20, "", nil, nil, uuid.Nil, uuid.Nil, uuid.Nil)
	if err != nil {
		t.Fatalf("ListHistory error: %v", err)
	}
	if repo.gotFinishedOnly {
		t.Fatalf("用户端 ListHistory finishedOnly=true，应包含进行中任务")
	}
	if len(recs) != 1 {
		t.Fatalf("records len = %d, want 1", len(recs))
	}
	if recs[0].Status != "processing" || recs[0].TotalCount != 3 || recs[0].CompletedCount != 1 {
		t.Fatalf("进行中任务字段缺失: %+v", recs[0])
	}
}

func TestListHistoryIncludesActiveTasksForAdmin(t *testing.T) {
	userID := uuid.New()
	admin := &domain.User{ID: userID, Role: "enterprise"}
	repo := &historyFakeRepo{}
	uc := &Usecase{repo: repo}
	_, _, err := uc.ListHistory(context.Background(), admin, 1, 20, "", nil, nil, uuid.Nil, uuid.Nil, uuid.Nil)
	if err != nil {
		t.Fatalf("ListHistory error: %v", err)
	}
	if repo.gotFinishedOnly {
		t.Fatalf("admin ListHistory 应包含进行中任务（finishedOnly=false）")
	}
}

func TestHistoryStatusToDBPassthroughActiveStates(t *testing.T) {
	cases := []struct{ in, want string }{
		{"success", "completed"},
		{"failed", "failed"},
		{"queued", "queued"},
		{"processing", "processing"},
		{"", ""},
	}
	for _, c := range cases {
		got := historyStatusToDB(c.in)
		if got != c.want {
			t.Fatalf("historyStatusToDB(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
