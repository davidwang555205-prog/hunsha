package generation

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"bridal/backend/biz/channels"
	"bridal/backend/biz/generation/prompt"
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
	mu              sync.Mutex
	started         int
	done            []string // SetTaskDone 的 status 列表
	subTasks        map[string]string
	processingOrder []string
	completedCount  int
	cancelled       bool
	categoryEngine  *CategoryEngine
	taskRecord      *TaskRecord // GetTask 返回（单张重试测试用）
	activeTasks     int         // CountActiveTasks 返回值
	createdTask     bool        // CreateTask 是否被调用
}

func newFakeRepo() *fakeRepo { return &fakeRepo{subTasks: map[string]string{}} }

func (r *fakeRepo) CreateTask(context.Context, TaskRecord, []string) error {
	r.mu.Lock()
	r.createdTask = true
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) GetTask(context.Context, uuid.UUID) (*TaskRecord, error) { return r.taskRecord, nil }
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
	if status == "processing" {
		r.processingOrder = append(r.processingOrder, imageID)
	}
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) IncCompletedCount(context.Context, uuid.UUID) error {
	r.mu.Lock()
	r.completedCount++
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) SetCompletedCount(_ context.Context, _ uuid.UUID, count int) error {
	r.mu.Lock()
	r.completedCount = count
	r.mu.Unlock()
	return nil
}
func (r *fakeRepo) IsTaskCancelled(context.Context, uuid.UUID) (bool, error) { return r.cancelled, nil }
func (r *fakeRepo) CancelTask(context.Context, uuid.UUID) error              { return nil }
func (r *fakeRepo) CountActiveTasks(context.Context, uuid.UUID) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.activeTasks, nil
}
func (r *fakeRepo) CountImagesForDate(context.Context, uuid.UUID, string) (int, error) {
	return 0, nil
}
func (r *fakeRepo) ListTasksPaged(context.Context, uuid.UUID, bool, int, int, string, *time.Time, *time.Time, uuid.UUID, uuid.UUID, uuid.UUID, bool) ([]TaskRecord, int, error) {
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

func (fakeStore) GetImage(_ context.Context, _ string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(nil)), nil
}

type fakeCredits struct {
	mu       sync.Mutex
	consumes int
	balance  int // GetBalance 返回值；默认 0，需积分通过的测试显式设置
}

func (c *fakeCredits) GetBalance(context.Context, uuid.UUID) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.balance, nil
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

func TestBuildCandidates_UsesPerChannelRequestTimeout(t *testing.T) {
	cases := []struct {
		name           string
		channelTimeout int
		wantTimeout    time.Duration
	}{
		{name: "线路超时优先", channelTimeout: 420_000, wantTimeout: 420 * time.Second},
		{name: "零值兼容全局超时", channelTimeout: 0, wantTimeout: 240 * time.Second},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			caller := &fakeCaller{name: "A"}
			ch := testChannel(uuid.New())
			ch.RequestTimeoutMs = tc.channelTimeout
			u := newTestUsecase(newFakeRepo(), &fakeCredits{}, &fakeChannels{configs: []channels.ChannelRecord{ch}}, caller)
			u.cfg = &config.Config{Bridal: config.Bridal{WalaImageTimeoutMs: 240_000}}

			var got wala.Config
			u.newClient = func(cfg wala.Config) walaCaller {
				got = cfg
				return caller
			}
			if candidates := u.buildCandidates(context.Background(), uuid.Nil); len(candidates) != 1 {
				t.Fatalf("候选线路数应为 1，得 %d", len(candidates))
			}
			if got.Timeout != tc.wantTimeout {
				t.Fatalf("Timeout=%s，want %s", got.Timeout, tc.wantTimeout)
			}
		})
	}
}

// 线路 proxy_url 必须同时透传到 wala.Config（上游请求走代理）和 channelClient.proxyURL（连续性回源下载用）；
// 未配线路的 proxyURL 为空（直连）。
func TestBuildCandidates_PassesProxyURL(t *testing.T) {
	proxied := testChannel(uuid.New())
	proxied.ProxyURL = "http://127.0.0.1:7890"
	proxied.SortOrder = 0
	direct := testChannel(uuid.New())
	direct.SortOrder = 1

	caller := &fakeCaller{name: "A"}
	u := newTestUsecase(newFakeRepo(), &fakeCredits{}, &fakeChannels{configs: []channels.ChannelRecord{proxied, direct}}, caller)
	got := map[string]wala.Config{}
	u.newClient = func(cfg wala.Config) walaCaller {
		got[cfg.APIKey] = cfg
		return caller
	}
	proxied.APIKey, direct.APIKey = "k-proxied", "k-direct"
	u.channels = &fakeChannels{configs: []channels.ChannelRecord{proxied, direct}}

	candidates := u.buildCandidates(context.Background(), uuid.Nil)
	if len(candidates) != 2 {
		t.Fatalf("候选线路数应为 2，得 %d", len(candidates))
	}
	if got["k-proxied"].ProxyURL != "http://127.0.0.1:7890" {
		t.Fatalf("proxied 线路 wala.Config.ProxyURL 透传错误，得 %q", got["k-proxied"].ProxyURL)
	}
	if got["k-direct"].ProxyURL != "" {
		t.Fatalf("direct 线路 wala.Config.ProxyURL 应为空，得 %q", got["k-direct"].ProxyURL)
	}
	if candidates[0].proxyURL != "http://127.0.0.1:7890" || candidates[1].proxyURL != "" {
		t.Fatalf("channelClient.proxyURL 透传错误，得 %q / %q", candidates[0].proxyURL, candidates[1].proxyURL)
	}
}

// continuityDownloadClient：线路配代理返回非 nil client，未配返回 nil（退化为 http.Get 直连）。
func TestContinuityDownloadClient(t *testing.T) {
	if continuityDownloadClient("") != nil {
		t.Fatal("空 proxyURL 应返回 nil")
	}
	if continuityDownloadClient("http://127.0.0.1:7890") == nil {
		t.Fatal("配了 proxyURL 应返回代理 client")
	}
}

// generatedImageToReferenceFile 传 dl 时上游 URL 回源下载必须经 dl（而非全局 http.Get）。
func TestGeneratedImageToReferenceFile_UsesCustomDownloader(t *testing.T) {
	pngBytes, _ := base64.StdEncoding.DecodeString(testPNG)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(pngBytes)
	}))
	defer srv.Close()

	var dlHits int32
	dl := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dlHits, 1)
		return http.DefaultTransport.RoundTrip(r)
	})}

	u := &Usecase{}
	ref, err := u.generatedImageToReferenceFile(wala.GeneratedImage{URL: srv.URL + "/img.png"}, "rec-1", "场景", dl)
	if err != nil {
		t.Fatalf("应成功，得 %v", err)
	}
	if len(ref.Data) == 0 {
		t.Fatal("参考图数据不应为空")
	}
	if atomic.LoadInt32(&dlHits) == 0 {
		t.Fatal("传了 dl 但下载未走 dl")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

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

	taskID := uuid.New()
	start := time.Now()
	u.runTask(taskID, user, threePlans(), nil, productFiles(), "1152x1536", "medium", chID)
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
	wantOrder := []string{taskID.String() + "-1", taskID.String() + "-2", taskID.String() + "-3"}
	if len(repo.processingOrder) != len(wantOrder) {
		t.Fatalf("应有 %d 次 processing 状态更新，得 %v", len(wantOrder), repo.processingOrder)
	}
	for i := range wantOrder {
		if repo.processingOrder[i] != wantOrder[i] {
			t.Errorf("并发为 1 时应按图号取得通道槽位，得 %v，想要 %v", repo.processingOrder, wantOrder)
			break
		}
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

// --- Generate 用户异步任务数上限测试 ---

func testDataURLImage() FileInput {
	return FileInput{
		Name:    "prod.png",
		Type:    "image/png",
		Size:    100,
		DataURL: "data:image/png;base64," + testPNG,
	}
}

func testGenerateReq() GenerateReq {
	return GenerateReq{
		Title: "测试标题",
		Body:  "测试正文内容。",
		Tags:  []string{"标签1", "标签2"},
		PromptParamsList: []prompt.Params{
			{
				ProductCategory: "婚纱 / 礼服",
				ImageType:       "产品上身图",
				ModelChoice:     "亚洲新娘感模特 25–35",
				Season:          "春",
				ScenePreference: "自动匹配",
				LightPreference: "自动匹配",
			},
		},
		ProductReferenceImages: []FileInput{
			testDataURLImage(), testDataURLImage(), testDataURLImage(), testDataURLImage(),
		},
	}
}

func TestGenerate_ActiveTaskLimitBlocksUser(t *testing.T) {
	repo := newFakeRepo()
	repo.activeTasks = 5
	u := newTestUsecase(repo, &fakeCredits{balance: 100}, &fakeChannels{}, &fakeCaller{})
	u.engines = nil // 跳过内容引擎加载，确保只测限流
	user := &domain.User{
		ID:              uuid.New(),
		Role:            "subaccount",
		Credits:         10,
		DailyImageLimit: 20,
		MaxActiveTasks:  5,
	}

	_, err := u.Generate(context.Background(), user, testGenerateReq())
	if err == nil {
		t.Fatal("应返回限流错误，实际为 nil")
	}
	walaErr, ok := err.(*wala.Error)
	if !ok {
		t.Fatalf("错误类型应为 *wala.Error，得 %T", err)
	}
	if walaErr.StatusCode != 429 {
		t.Fatalf("状态码应为 429，得 %d", walaErr.StatusCode)
	}
	if !strings.Contains(walaErr.Message, "进行中任务已达上限") {
		t.Fatalf("错误信息应包含'进行中任务已达上限'，得 %q", walaErr.Message)
	}
}

func TestGenerate_ActiveTaskLimitUsesMaxActiveTasks(t *testing.T) {
	repo := newFakeRepo()
	repo.activeTasks = 3
	u := newTestUsecase(repo, &fakeCredits{balance: 100}, &fakeChannels{}, &fakeCaller{})
	u.engines = nil
	user := &domain.User{
		ID:              uuid.New(),
		Role:            "subaccount",
		Credits:         10,
		DailyImageLimit: 20,
		MaxActiveTasks:  2,
	}

	_, err := u.Generate(context.Background(), user, testGenerateReq())
	if err == nil {
		t.Fatal("应返回限流错误，实际为 nil")
	}
	walaErr, ok := err.(*wala.Error)
	if !ok || walaErr.StatusCode != 429 {
		t.Fatalf("期望 429 *wala.Error，得 %T %v", err, err)
	}
	if !strings.Contains(walaErr.Message, "上限（2 个）") {
		t.Fatalf("应使用用户自定义上限 2，错误信息=%q", walaErr.Message)
	}
}

func TestGenerate_ActiveTaskLimitAllowsBelowLimit(t *testing.T) {
	repo := newFakeRepo()
	repo.activeTasks = 4
	u := newTestUsecase(repo, &fakeCredits{balance: 100}, &fakeChannels{}, &fakeCaller{})
	u.engines = nil
	user := &domain.User{
		ID:              uuid.New(),
		Role:            "subaccount",
		Credits:         10,
		DailyImageLimit: 20,
		MaxActiveTasks:  5,
	}

	_, err := u.Generate(context.Background(), user, testGenerateReq())
	if err == nil {
		t.Fatal("应继续执行到引擎加载阶段并返回错误，实际为 nil")
	}
	walaErr, ok := err.(*wala.Error)
	if ok && walaErr.StatusCode == 429 {
		t.Fatalf("不应被限流，实际被限流: %q", walaErr.Message)
	}
}

func TestGenerate_ActiveTaskLimitSkippedForAdmin(t *testing.T) {
	repo := newFakeRepo()
	repo.activeTasks = 100
	u := newTestUsecase(repo, &fakeCredits{}, &fakeChannels{}, &fakeCaller{})
	u.engines = nil
	user := &domain.User{
		ID:             uuid.New(),
		Role:           "admin",
		Credits:        0,
		MaxActiveTasks: 5,
	}

	_, err := u.Generate(context.Background(), user, testGenerateReq())
	if err == nil {
		t.Fatal("应继续执行到引擎加载阶段并返回错误，实际为 nil")
	}
	walaErr, ok := err.(*wala.Error)
	if ok && walaErr.StatusCode == 429 {
		t.Fatalf("admin 不应被限流，实际被限流: %q", walaErr.Message)
	}
}

// TestGenerate_CreditsUsesLiveBalanceNotStaleSession 复现生产事故：
// 用户登录时写入 session 的快照 Credits=0（短信/OAuth 路径漏填或充值后未刷新），
// 但数据库实时余额充足。积分校验必须走 GetBalance 实时查库，不能信快照，否则所有普通账号误报 402。
func TestGenerate_CreditsUsesLiveBalanceNotStaleSession(t *testing.T) {
	repo := newFakeRepo()
	// 快照 Credits=0，但实时余额充足。
	u := newTestUsecase(repo, &fakeCredits{balance: 99}, &fakeChannels{}, &fakeCaller{})
	u.engines = nil
	user := &domain.User{
		ID:              uuid.New(),
		Role:            "subaccount",
		Credits:         0, // 故意为 0，模拟过期/漏填的 session 快照
		DailyImageLimit: 20,
		MaxActiveTasks:  5,
	}

	_, err := u.Generate(context.Background(), user, testGenerateReq())
	if err == nil {
		t.Fatal("应在引擎加载阶段返回错误，实际为 nil")
	}
	if we, ok := err.(*wala.Error); ok && we.StatusCode == 402 {
		t.Fatalf("实时余额充足时不应报积分不足，得 402: %q", we.Message)
	}
}

// TestGenerate_CreditsLiveBalanceZeroStillBlocks 反向确保校验仍生效：
// 快照 Credits 很高但实时余额为 0 时必须拦截 402（不能因为快照有分就放行）。
func TestGenerate_CreditsLiveBalanceZeroStillBlocks(t *testing.T) {
	repo := newFakeRepo()
	u := newTestUsecase(repo, &fakeCredits{balance: 0}, &fakeChannels{}, &fakeCaller{})
	u.engines = nil
	user := &domain.User{
		ID:              uuid.New(),
		Role:            "subaccount",
		Credits:         999, // 快照很高，但库内已为 0
		DailyImageLimit: 20,
		MaxActiveTasks:  5,
	}

	_, err := u.Generate(context.Background(), user, testGenerateReq())
	wantStatusCode(t, err, 402)
}
