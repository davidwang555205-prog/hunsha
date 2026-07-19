package generation

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"bridal/backend/biz/generation/wala"
	"bridal/backend/domain"
)

// retryTestRecord 构造单张重试测试用的失败任务记录：
// 5 张子图，idx 0/2 成功、1 失败、3 取消、4 pending；参考图 1 场景 + 4 产品图，满足 productFiles>=4。
func retryTestRecord(taskID, userID uuid.UUID) *TaskRecord {
	return &TaskRecord{
		ID:         taskID,
		UserID:     userID,
		Status:     "failed",
		TotalCount: 5,
		SubTaskStatus: []SubTaskStatusItem{
			{Index: 0, Status: "success", Image: &ImageRecord{URL: "/api/v1/generation/images/s1.png", Name: "s1.png"}},
			{Index: 1, Status: "failed"},
			{Index: 2, Status: "success", Image: &ImageRecord{URL: "/api/v1/generation/images/s3.png", Name: "s3.png"}},
			{Index: 3, Status: "cancelled"},
			{Index: 4, Status: "pending"},
		},
		ReferenceImages: []ImageRecord{
			{URL: "/api/v1/generation/images/scene.png", Name: "scene.png", Kind: "scene"},
			{URL: "/api/v1/generation/images/p1.png", Name: "p1.png", Kind: "product"},
			{URL: "/api/v1/generation/images/p2.png", Name: "p2.png", Kind: "product"},
			{URL: "/api/v1/generation/images/p3.png", Name: "p3.png", Kind: "product"},
			{URL: "/api/v1/generation/images/p4.png", Name: "p4.png", Kind: "product"},
		},
		Prompts: []string{"p0", "p1", "p2", "p3", "p4"},
	}
}

func wantStatusCode(t *testing.T, err error, code int) {
	t.Helper()
	var we *wala.Error
	if !errors.As(err, &we) {
		t.Fatalf("want *wala.Error, got %T: %v", err, err)
	}
	if we.StatusCode != code {
		t.Fatalf("status code = %d, want %d (msg: %s)", we.StatusCode, code, we.Message)
	}
}

func TestRetryImage_TaskNotFound(t *testing.T) {
	u := newTestUsecase(newFakeRepo(), &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	err := u.RetryImage(context.Background(), uuid.New(), 2, &domain.User{ID: uuid.New()})
	wantStatusCode(t, err, 404)
}

func TestRetryImage_NotOwner(t *testing.T) {
	repo := newFakeRepo()
	taskID, owner := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, owner)
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	// 非管理员、非本人 -> 403
	err := u.RetryImage(context.Background(), taskID, 2, &domain.User{ID: uuid.New()})
	wantStatusCode(t, err, 403)
}

func TestRetryImage_NotFailedStatus(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	repo.taskRecord.Status = "completed"
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	err := u.RetryImage(context.Background(), taskID, 2, &domain.User{ID: userID})
	wantStatusCode(t, err, 400)
}

func TestRetryImage_ImageNumberNotFound(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	err := u.RetryImage(context.Background(), taskID, 99, &domain.User{ID: userID})
	wantStatusCode(t, err, 400)
}

func TestRetryImage_SubTaskNotFailed(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	// imageNumber=1 -> idx=0 -> success，不可重试
	err := u.RetryImage(context.Background(), taskID, 1, &domain.User{ID: userID})
	wantStatusCode(t, err, 400)
}

func TestRetryImage_NoSuccessImage(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	for i := range repo.taskRecord.SubTaskStatus {
		repo.taskRecord.SubTaskStatus[i].Status = "failed"
		repo.taskRecord.SubTaskStatus[i].Image = nil
	}
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	err := u.RetryImage(context.Background(), taskID, 2, &domain.User{ID: userID})
	wantStatusCode(t, err, 400)
}

func TestRetryImage_InsufficientCredits(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	// 非无限用户 + 0 积分（ID 与 owner 一致以过 403 校验）
	err := u.RetryImage(context.Background(), taskID, 2, &domain.User{ID: userID, Credits: 0})
	wantStatusCode(t, err, 402)
}

func TestReevaluateTaskStatus_AllSuccess(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	for i := range repo.taskRecord.SubTaskStatus {
		repo.taskRecord.SubTaskStatus[i].Status = "success"
		repo.taskRecord.SubTaskStatus[i].Image = &ImageRecord{URL: "/api/v1/generation/images/x.png", Name: "x.png"}
	}
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	u.reevaluateTaskStatus(context.Background(), taskID)
	if len(repo.done) != 1 || repo.done[0] != "completed" {
		t.Fatalf("全成功应置 completed，得 %v", repo.done)
	}
	if repo.completedCount != 5 {
		t.Fatalf("completedCount 应 5，得 %d", repo.completedCount)
	}
}

func TestReevaluateTaskStatus_PartialFailure(t *testing.T) {
	repo := newFakeRepo()
	taskID, userID := uuid.New(), uuid.New()
	repo.taskRecord = retryTestRecord(taskID, userID)
	// retryTestRecord: success/failed/success/cancelled/pending -> finished=4, success=2
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{name: "A"})
	u.reevaluateTaskStatus(context.Background(), taskID)
	if len(repo.done) != 0 {
		t.Fatalf("部分失败不应置 completed，得 %v", repo.done)
	}
	if repo.completedCount != 4 {
		t.Fatalf("completedCount 应 4（finished），得 %d", repo.completedCount)
	}
}
