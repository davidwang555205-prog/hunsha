package generation

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"bridal/backend/biz/channels"
	"bridal/backend/biz/generation/wala"
	"bridal/backend/config"
	"bridal/backend/domain"
	"bridal/backend/ent/types"
)

// 1x1 透明 PNG 的 base64，供 generatedImageToReferenceFile 解码建连续性参考图。
const testPNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

func successBody() string {
	return `{"data":[{"b64_json":"` + testPNG + `"}]}`
}

// --- fakes 实现 taskRepo / taskStore / taskCredits / taskChannels ---

type fakeRepo struct {
	mu             sync.Mutex
	started        int
	done           []string // SetTaskDone 的 status 列表
	subTasks       map[string]string
	completedCount int
	cancelled      bool
	categoryEngine *CategoryEngine
}

func newFakeRepo() *fakeRepo { return &fakeRepo{subTasks: map[string]string{}} }

func (r *fakeRepo) CreateTask(context.Context, TaskRecord, []string) error  { return nil }
func (r *fakeRepo) GetTask(context.Context, uuid.UUID) (*TaskRecord, error) { return nil, nil }
func (r *fakeRepo) SetTaskStarted(context.Context, uuid.UUID) error {
	r.mu.Lock()
	r.started++
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) SetTaskDone(_ context.Context, _ uuid.UUID, status, _ string) error {
	r.mu.Lock()
	r.done = append(r.done, status)
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) UpdateSubTaskImage(_ context.Context, imageID, status, _, _, _ string, _ int) error {
	r.mu.Lock()
	r.subTasks[imageID] = status
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) IncCompletedCount(context.Context, uuid.UUID) error {
	r.mu.Lock()
	r.completedCount++
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) IsTaskCancelled(context.Context, uuid.UUID) (bool, error) { return r.cancelled, nil }
func (r *fakeRepo) CancelTask(context.Context, uuid.UUID) error              { return nil }
func (r *fakeRepo) CountActiveTasks(context.Context, uuid.UUID) (int, error) { return 0, nil }
func (r *fakeRepo) CountImagesForDate(context.Context, uuid.UUID, string) (int, error) {
	return 0, nil
}
func (r *fakeRepo) ListTasksPaged(context.Context, uuid.UUID, bool, int, int, string, *time.Time, *time.Time, uuid.UUID, uuid.UUID) ([]TaskRecord, int, error) {
	return nil, 0, nil
}
func (r *fakeRepo) UpdateTaskFeedback(context.Context, uuid.UUID, types.TaskFeedback) error {
	return nil
}
func (r *fakeRepo) CleanupExpired(context.Context, time.Time) (int, int, error) { return 0, 0, nil }
func (r *fakeRepo) GetCategoryEngine(context.Context, uuid.UUID) (*CategoryEngine, error) {
	return r.categoryEngine, nil
}

type fakeStore struct{}

func (fakeStore) PutImage(_ context.Context, filename string, _ []byte, _ string) (string, error) {
	return "http://fake/" + filename, nil
}

func (fakeStore) PublicURL(filename string) string {
	return "http://fake/" + filename
}

func (fakeStore) ThumbURL(filename string) string {
	return "http://fake/" + filename + "?imageMogr2/thumbnail/480x480"
}

func (fakeStore) PutThumbnail(_ context.Context, origFilename string, _ []byte) (string, error) {
	return "http://fake/" + origFilename + ".thumb.jpg", nil
}

type fakeCredits struct {
	mu       sync.Mutex
	consumes int
}

func (c *fakeCredits) Consume(context.Context, uuid.UUID, int, uuid.UUID, string) error {
	c.mu.Lock()
	c.consumes++
	c.mu.Unlock()
	return nil
}

type fakeChannels struct {
	configs []channels.ChannelRecord
	mu      sync.Mutex
	stats   map[uuid.UUID]int
}

func (c *fakeChannels) GetConfigByID(_ context.Context, id uuid.UUID) (*channels.ChannelRecord, error) {
	for i := range c.configs {
		if c.configs[i].ID == id {
			return &c.configs[i], nil
		}
	}
	return nil, nil
}
func (c *fakeChannels) GetDefaultConfig(context.Context) (*channels.ChannelRecord, error) {
	return nil, nil
}
func (c *fakeChannels) ListEnabledConfigs(context.Context) ([]channels.ChannelRecord, error) {
	return c.configs, nil
}
func (c *fakeChannels) ListAdmin(context.Context) ([]channels.ChannelResp, error) { return nil, nil }
func (c *fakeChannels) IncStats(_ context.Context, id uuid.UUID, _ bool, _ int) {
	c.mu.Lock()
	c.stats[id]++
	c.mu.Unlock()
}

func newTestUsecase(repo *fakeRepo, creds *fakeCredits, chans *fakeChannels, caller *fakeCaller) *Usecase {
	chans.stats = map[uuid.UUID]int{}
	return &Usecase{
		repo:      repo,
		store:     fakeStore{},
		credits:   creds,
		channels:  chans,
		logger:    slog.Default(),
		sem:       make(chan struct{}, 5),
		userSems:  sync.Map{},
		refLimit:  8,
		creditsMu: sync.Map{},
		cfg:       &config.Config{},
		newClient: func(wala.Config) walaCaller { return caller },
	}
}

func testChannel(id uuid.UUID) channels.ChannelRecord {
	return channels.ChannelRecord{
		ID: id, Name: "A", IsEnabled: true,
		APIBaseURL: "x", APIKey: "x", ModelID: "m", DefaultQuality: "medium",
		MaxConcurrency: 2, // 并发线路：并发段最多 2 张并发（默认 1=逐张串行）
	}
}

// 3 张图计划：首张含人物（splitIdx=0，串行段仅首张，后续 2 张并发）。
func threePlans() []promptPlan {
	return []promptPlan{
		{prompt: "p1", includesPerson: true, name: "图1"},
		{prompt: "p2", includesPerson: false, name: "图2"},
		{prompt: "p3", includesPerson: false, name: "图3"},
	}
}

func productFiles() []wala.FileInput {
	return []wala.FileInput{{Name: "prod", Type: "image/png", Data: []byte("x"), Size: 1}}
}

// 场景1：3 图全成功。验证首张串行 + 后续并发（耗时显著 < 串行）、积分扣 3、状态 completed。
func TestRunTask_Concurrent(t *testing.T) {
	caller := &fakeCaller{
		name:    "A",
		results: []fakeResult{{status: 200, body: successBody()}},
		delay:   150 * time.Millisecond,
	}
	chID := uuid.New()
	chans := &fakeChannels{configs: []channels.ChannelRecord{testChannel(chID)}}
	repo := newFakeRepo()
	creds := &fakeCredits{}
	u := newTestUsecase(repo, creds, chans, caller)
	user := &domain.User{ID: uuid.New(), Username: "tester"}

	start := time.Now()
	u.runTask(uuid.New(), user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)
	elapsed := time.Since(start)

	if len(repo.done) != 1 || repo.done[0] != "completed" {
		t.Fatalf("应 completed，得 %v", repo.done)
	}
	if repo.completedCount != 3 {
		t.Errorf("IncCompletedCount 应 3，得 %d", repo.completedCount)
	}
	successN := 0
	for _, s := range repo.subTasks {
		if s == "success" {
			successN++
		}
	}
	if successN != 3 {
		t.Errorf("应 3 张 success，得 %d（%v）", successN, repo.subTasks)
	}
	if creds.consumes != 3 {
		t.Errorf("积分应扣 3（每张成功扣 1），得 %d", creds.consumes)
	}
	if caller.callCount() != 3 {
		t.Errorf("wala 应调 3 次，得 %d", caller.callCount())
	}
	// 并发验证：串行 3*150=450ms，首张串行+后续 2 并发 ≈ 2*150=300ms
	if elapsed >= 400*time.Millisecond {
		t.Errorf("并发生成应 < 400ms（串行需 450ms），得 %v，未并发", elapsed)
	}
}

// 场景1b：MaxConcurrency=1（默认串行）。3 图逐张串行，耗时 ≈ 3*150=450ms（无并发段并发）。
// 验证线路并发度=1 时图片一张一张生成，连续性参考图照建（首张串行段建参考，后续串行复用）。
func TestRunTask_Serial(t *testing.T) {
	caller := &fakeCaller{
		name:    "A",
		results: []fakeResult{{status: 200, body: successBody()}},
		delay:   150 * time.Millisecond,
	}
	chID := uuid.New()
	ch := testChannel(chID)
	ch.MaxConcurrency = 1 // 强制逐张串行
	chans := &fakeChannels{configs: []channels.ChannelRecord{ch}}
	repo := newFakeRepo()
	creds := &fakeCredits{}
	u := newTestUsecase(repo, creds, chans, caller)
	user := &domain.User{ID: uuid.New(), Username: "tester"}

	start := time.Now()
	u.runTask(uuid.New(), user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)
	elapsed := time.Since(start)

	if len(repo.done) != 1 || repo.done[0] != "completed" {
		t.Fatalf("应 completed，得 %v", repo.done)
	}
	if repo.completedCount != 3 {
		t.Errorf("IncCompletedCount 应 3，得 %d", repo.completedCount)
	}
	if caller.callCount() != 3 {
		t.Errorf("wala 应调 3 次，得 %d", caller.callCount())
	}
	// 串行验证：3*150=450ms（并发才 <400ms）
	if elapsed < 400*time.Millisecond {
		t.Errorf("串行生成应 >= 400ms（3*150=450ms），得 %v，误并发", elapsed)
	}
}

// 场景1c：用户级跨任务串行。同一用户 2 个任务并发跑，max=1，6 张图应跨任务逐张串行（≈6*150=900ms）。
// 验证 per-user 信号量跨任务共享：max=1 时不同任务的图片也排队串行，不会 2 任务并行各出图。
func TestRunTask_UserLevelSerial(t *testing.T) {
	caller := &fakeCaller{
		name:    "A",
		results: []fakeResult{{status: 200, body: successBody()}},
		delay:   150 * time.Millisecond,
	}
	chID := uuid.New()
	ch := testChannel(chID)
	ch.MaxConcurrency = 1 // 用户级串行
	chans := &fakeChannels{configs: []channels.ChannelRecord{ch}}
	repo := newFakeRepo()
	creds := &fakeCredits{}
	u := newTestUsecase(repo, creds, chans, caller)
	user := &domain.User{ID: uuid.New(), Username: "tester"}

	start := time.Now()
	// 2 任务并发跑，共享同一 user 的 per-user sem（容量 1）-> 6 图跨任务逐张串行
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		u.runTask(uuid.New(), user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)
	}()
	go func() {
		defer wg.Done()
		u.runTask(uuid.New(), user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)
	}()
	wg.Wait()
	elapsed := time.Since(start)

	if len(repo.done) != 2 {
		t.Fatalf("应 2 个任务 completed，得 %d", len(repo.done))
	}
	if caller.callCount() != 6 {
		t.Errorf("wala 应调 6 次（2 任务 * 3 图），得 %d", caller.callCount())
	}
	// 跨任务串行：6*150=900ms（若 2 任务并行各串行 = 450ms）
	if elapsed < 800*time.Millisecond {
		t.Errorf("跨任务串行应 ≈900ms（6*150），得 %v，未跨任务串行", elapsed)
	}
}

// 场景2：首张失败，整组 failed，后续 2 张清理为 failed，不扣积分。
func TestRunTask_FirstFail(t *testing.T) {
	caller := &fakeCaller{name: "A", results: []fakeResult{
		{status: 500, body: "internal error"}, // 首张失败（500 不可重试）
		{status: 200, body: successBody()},
		{status: 200, body: successBody()},
	}}
	chID := uuid.New()
	chans := &fakeChannels{configs: []channels.ChannelRecord{testChannel(chID)}}
	repo := newFakeRepo()
	creds := &fakeCredits{}
	u := newTestUsecase(repo, creds, chans, caller)
	user := &domain.User{ID: uuid.New(), Username: "tester"}

	u.runTask(uuid.New(), user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)

	if len(repo.done) != 1 || repo.done[0] != "failed" {
		t.Fatalf("首张失败应 failed，得 %v", repo.done)
	}
	if caller.callCount() != 1 {
		t.Errorf("首张失败应只调 1 次 wala（后续不执行），得 %d", caller.callCount())
	}
	if creds.consumes != 0 {
		t.Errorf("首张失败不应扣积分，得 %d", creds.consumes)
	}
	failedN := 0
	for _, s := range repo.subTasks {
		if s == "failed" {
			failedN++
		}
	}
	if failedN != 3 {
		t.Errorf("应 3 张 failed（1 首张 + 2 清理），得 %d（%v）", failedN, repo.subTasks)
	}
}

// 场景3：首张成功（建参考），并发段 2 张失败。任务 failed，已成功首张保留。
func TestRunTask_ParallelFail(t *testing.T) {
	caller := &fakeCaller{name: "A", results: []fakeResult{
		{status: 200, body: successBody()}, // 首张成功
		{status: 500, body: "err"},         // 并发段失败
		{status: 500, body: "err"},         // 并发段失败
	}}
	chID := uuid.New()
	chans := &fakeChannels{configs: []channels.ChannelRecord{testChannel(chID)}}
	repo := newFakeRepo()
	creds := &fakeCredits{}
	u := newTestUsecase(repo, creds, chans, caller)
	user := &domain.User{ID: uuid.New(), Username: "tester"}

	u.runTask(uuid.New(), user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)

	if len(repo.done) != 1 || repo.done[0] != "failed" {
		t.Fatalf("并发段失败应 failed，得 %v", repo.done)
	}
	successN, failedN := 0, 0
	for _, s := range repo.subTasks {
		if s == "success" {
			successN++
		}
		if s == "failed" {
			failedN++
		}
	}
	if successN != 1 || failedN != 2 {
		t.Errorf("应 1 success（首张保留）+ 2 failed，得 success=%d failed=%d（%v）", successN, failedN, repo.subTasks)
	}
	if creds.consumes != 1 {
		t.Errorf("只首张成功应扣 1 积分，得 %d", creds.consumes)
	}
	if caller.callCount() != 3 {
		t.Errorf("wala 应调 3 次（首张+并发 2），得 %d", caller.callCount())
	}
}
