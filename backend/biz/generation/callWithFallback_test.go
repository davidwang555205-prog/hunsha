package generation

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"bridal/backend/biz/generation/wala"
	"bridal/backend/domain"
)

// fakeCaller 模拟 wala 调用，按预设结果序列返回，记录调用次数。
// 仅用于测试 callWithFallback 的线路切换逻辑，不触达真实 HTTP。
type fakeCaller struct {
	name     string
	results  []fakeResult
	calls    int32
	delay    time.Duration
	mu       sync.Mutex
	attempts []int
}

type fakeResult struct {
	status int
	body   string
	err    error
}

func (f *fakeCaller) CallWithRetries(ctx context.Context, req wala.Request) (int, string, error) {
	return f.call(ctx, 0)
}

func (f *fakeCaller) CallWithAttempts(ctx context.Context, req wala.Request, attempts int) (int, string, error) {
	return f.call(ctx, attempts)
}

func (f *fakeCaller) call(ctx context.Context, attempts int) (int, string, error) {
	f.mu.Lock()
	f.attempts = append(f.attempts, attempts)
	f.mu.Unlock()
	idx := int(atomic.AddInt32(&f.calls, 1)) - 1
	if idx >= len(f.results) {
		idx = len(f.results) - 1
	}
	if f.delay > 0 {
		time.Sleep(f.delay)
	}
	r := f.results[idx]
	return r.status, r.body, r.err
}

func (f *fakeCaller) BuildOverloadMessage(msg string) string {
	return "OVERLOAD[" + f.name + "]: " + msg
}

func (f *fakeCaller) callCount() int { return int(atomic.LoadInt32(&f.calls)) }

func (f *fakeCaller) attemptBudgets() []int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]int(nil), f.attempts...)
}

// observedFakeCaller 模拟真实 Client 的逐 HTTP 调用回调，用于验证审计不是按候选线路粗略计数。
type observedFakeCaller struct{ *fakeCaller }

func (f *observedFakeCaller) CallWithAttemptsObserved(ctx context.Context, req wala.Request, attempts int, observer wala.AttemptObserver) (int, string, error) {
	started := time.Now()
	observer(wala.AttemptEvent{Attempt: 1, StartedAt: started})
	status, body, err := f.CallWithAttempts(ctx, req, attempts)
	observer(wala.AttemptEvent{Attempt: 1, StartedAt: started, CompletedAt: time.Now(), Status: status, BodyText: body, Err: err, Finished: true})
	return status, body, err
}

type auditFakeRepo struct {
	*fakeRepo
	records map[uuid.UUID]ModelInvocationRecord
}

func newAuditFakeRepo() *auditFakeRepo {
	return &auditFakeRepo{fakeRepo: newFakeRepo(), records: map[uuid.UUID]ModelInvocationRecord{}}
}

func (r *auditFakeRepo) CreateModelInvocation(_ context.Context, rec ModelInvocationRecord) error {
	r.records[rec.ID] = rec
	return nil
}

func (r *auditFakeRepo) FinishModelInvocation(_ context.Context, id uuid.UUID, status string, httpStatus, latencyMs, responseImageCount int, message string, completedAt time.Time) error {
	rec := r.records[id]
	rec.Status, rec.HTTPStatus, rec.LatencyMs, rec.ResponseImageCount, rec.Error, rec.CompletedAt = status, httpStatus, latencyMs, responseImageCount, message, &completedAt
	r.records[id] = rec
	return nil
}

func (r *auditFakeRepo) ListModelInvocations(context.Context, ModelInvocationQuery) ([]ModelInvocationRecord, int, error) {
	return nil, 0, nil
}

// 场景1：首线路成功，直接返回，不切线路。
func TestCallWithFallback_FirstSuccess(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "A", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "A"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if used.name != "A" {
		t.Fatalf("used 应 A，得 %s", used.name)
	}
	if c1.callCount() != 1 {
		t.Fatalf("A 应只调 1 次，得 %d", c1.callCount())
	}
}

// 场景2：首线路 503（可重试，负载饱和），切到第二线路成功。
func TestCallWithFallback_FallbackOnRetryable503(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "A", results: []fakeResult{{status: 503, body: "当前分组负载已饱和"}}}
	c2 := &fakeCaller{name: "B", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "A"}, {client: c2, name: "B"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil {
		t.Fatalf("应切到 B 成功，不应出错，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if used.name != "B" {
		t.Fatalf("应降级到 B，得 %s", used.name)
	}
	if c1.callCount() != 1 || c2.callCount() != 1 {
		t.Fatalf("A/B 各应调 1 次，得 A=%d B=%d", c1.callCount(), c2.callCount())
	}
}

// 多线路时重试预算必须全链路共享：首线路可重试失败后立刻切备用，
// 不能让每条线路各自耗尽 3 次重试而把单张任务拖到数分钟。
func TestCallWithFallback_SharesRetryBudgetAcrossCandidates(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "primary", results: []fakeResult{{status: 503, body: "当前分组负载已饱和"}}}
	c2 := &fakeCaller{name: "backup", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "primary"}, {client: c2, name: "backup"}}

	_, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil || used.name != "backup" {
		t.Fatalf("应切到 backup 成功，used=%s err=%v", used.name, err)
	}
	if got := c1.attemptBudgets(); len(got) != 1 || got[0] != 1 {
		t.Fatalf("首线路应只获得 1 次尝试后快速降级，得 %v", got)
	}
	if got := c2.attemptBudgets(); len(got) != 1 || got[0] != 2 {
		t.Fatalf("备用线路应获得剩余 2 次预算，得 %v", got)
	}
}

func TestCallWithFallback_LogsChannelAttemptDetails(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "primary", results: []fakeResult{{status: 503, body: "upstream busy"}}}
	c2 := &fakeCaller{name: "backup", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	var output bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&output, nil))

	_, _, _, err := u.callWithFallbackLogged(context.Background(), logger, []channelClient{{client: c1, name: "primary"}, {client: c2, name: "backup"}}, wala.Request{}, nil, nil)
	if err != nil {
		t.Fatalf("备用线路成功时不应出错，得 %v", err)
	}
	logs := output.String()
	for _, want := range []string{
		`"msg":"image upstream attempt failed"`,
		`"msg":"image upstream attempt succeeded"`,
		`"channel":"primary"`,
		`"attempt_budget":1`,
		`"fallbackable":true`,
	} {
		if !strings.Contains(logs, want) {
			t.Fatalf("日志缺少 %s，实际：%s", want, logs)
		}
	}
}

func TestCallWithFallback_PersistsOneAuditRecordPerActualAttempt(t *testing.T) {
	repo := newAuditFakeRepo()
	u := &Usecase{repo: repo}
	caller := &observedFakeCaller{&fakeCaller{name: "primary", results: []fakeResult{{status: 503, body: "当前分组负载已饱和"}}}}
	user := &domain.User{ID: uuid.New(), Username: "audit-user", Email: "audit@example.com"}
	files := []wala.FileInput{{Name: "dress.png", Type: "image/png", Size: 3, Data: []byte("png"), SourceURL: "/api/v1/generation/images/ref.png", ReferenceKind: "product"}}

	_, _, _, err := u.callWithFallbackLogged(context.Background(), nil, []channelClient{{client: caller, name: "primary", modelID: "gpt-image-2", apiBaseURL: "https://example.test/v1", protocol: "openai"}}, wala.Request{Prompt: "make a dress", Files: files, Size: "3:4", Quality: "high"}, nil, &invocationMeta{taskID: uuid.New(), generationImageID: "image-1", imageNumber: 1, user: user})
	if err == nil {
		t.Fatal("唯一候选 503 应返回失败")
	}
	if len(repo.records) != 1 {
		t.Fatalf("每个真实 HTTP 尝试应落一条审计记录，得 %d", len(repo.records))
	}
	for _, rec := range repo.records {
		if rec.Status != "failed" || rec.HTTPStatus != 503 || rec.AttemptNumber != 1 {
			t.Fatalf("审计完成状态不正确：%+v", rec)
		}
		if rec.Prompt != "make a dress" || len(rec.ReferenceImages) != 1 || rec.ReferenceImages[0].URL == "" {
			t.Fatalf("请求快照不完整：%+v", rec)
		}
		if rec.ReferenceImages[0].SHA256 == "" || rec.CompletedAt == nil {
			t.Fatalf("应保存参考图指纹和完成时间：%+v", rec)
		}
	}
}

// 场景3：单条线路 404 通常意味着上游端点或模型暂不可用，应立即切换线路而非原地重试。
func TestCallWithFallback_FallbackOn404(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "OpenRouter", results: []fakeResult{{status: 404, body: "Not Found"}}}
	c2 := &fakeCaller{name: "WalaAPI", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "OpenRouter"}, {client: c2, name: "WalaAPI"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil {
		t.Fatalf("404 后应切到 WalaAPI 成功，得 %v", err)
	}
	if status != 200 || used.name != "WalaAPI" {
		t.Fatalf("应使用 WalaAPI 返回 200，得 status=%d used=%s", status, used.name)
	}
	if c1.callCount() != 1 || c2.callCount() != 1 {
		t.Fatalf("OpenRouter/WalaAPI 各应调用一次，得 %d/%d", c1.callCount(), c2.callCount())
	}
}

// 场景4：首线路 400（不可重试，参数错误），不切线路，直接返回。
func TestCallWithFallback_NoFallbackOn400(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "A", results: []fakeResult{{status: 400, body: "bad request"}}}
	c2 := &fakeCaller{name: "B", results: []fakeResult{{status: 200}}}
	cands := []channelClient{{client: c1, name: "A"}, {client: c2, name: "B"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if status != 400 {
		t.Fatalf("不可重试 400 应直接返回，status 得 %d", status)
	}
	if err != nil {
		t.Fatalf("400 是 HTTP 响应，err 应 nil，得 %v", err)
	}
	if used.name != "A" {
		t.Fatalf("不可重试不应切线路，used 得 %s", used.name)
	}
	if c2.callCount() != 0 {
		t.Fatalf("B 不应被调用，得 %d", c2.callCount())
	}
}

// 场景4b：参考图兼容错误 "Invalid image file or mode" 是 user-correctable 错误，官方明确不应
// 自动重试/降级；且 fallback 到同为 OpenAI 的线路必同样失败，应立即失败不切线路（源图问题，非线路问题）。
func TestCallWithFallback_NoFallbackOnImageCompatibility400(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "OpenRouter", results: []fakeResult{{status: 400, body: "Invalid image file or mode for image 1"}}}
	c2 := &fakeCaller{name: "WalaAPI", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "OpenRouter"}, {client: c2, name: "WalaAPI"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if status != 400 {
		t.Fatalf("图片兼容错误应直接返回 400，status 得 %d", status)
	}
	if err != nil {
		t.Fatalf("400 是 HTTP 响应，err 应 nil，得 %v", err)
	}
	if used.name != "OpenRouter" {
		t.Fatalf("不应切线路，used 得 %s", used.name)
	}
	if c2.callCount() != 0 {
		t.Fatalf("WalaAPI 不应被调用，得 %d", c2.callCount())
	}
}

// 场景4：首线路网络错误（504 超时，可重试），切到第二线路成功。
func TestCallWithFallback_NetErrFallback(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "A", results: []fakeResult{{err: wala.NewError(504, "生图接口超过 180 秒未返回，已中断。")}}}
	c2 := &fakeCaller{name: "B", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "A"}, {client: c2, name: "B"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil {
		t.Fatalf("应切到 B 成功，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if used.name != "B" {
		t.Fatalf("应降级到 B，得 %s", used.name)
	}
}

// 场景5：全部线路可重试失败，抛 503 overload，每个线路都被尝试。
func TestCallWithFallback_AllFailOverload(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "A", results: []fakeResult{{status: 503, body: "当前分组负载已饱和"}}}
	c2 := &fakeCaller{name: "B", results: []fakeResult{{status: 502}}}
	cands := []channelClient{{client: c1, name: "A"}, {client: c2, name: "B"}}

	_, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err == nil {
		t.Fatal("全部失败应返回错误")
	}
	we, ok := err.(*wala.Error)
	if !ok {
		t.Fatalf("应返回 *wala.Error，得 %T", err)
	}
	if we.StatusCode != 503 {
		t.Fatalf("应 503，得 %d", we.StatusCode)
	}
	if used.name != "B" {
		t.Fatalf("lastUsed 应为最后线路 B，得 %s", used.name)
	}
	if !strings.Contains(we.Message, "候选线路均不可用") || !strings.Contains(we.Message, "总尝试预算 3 次") {
		t.Fatalf("错误应说明整条候选链与总预算，得 %q", we.Message)
	}
	if c1.callCount() != 1 || c2.callCount() != 1 {
		t.Fatalf("A/B 各应调 1 次，得 A=%d B=%d", c1.callCount(), c2.callCount())
	}
}

// 场景6：3 线路，前两个可重试失败，切到第三个成功（验证按优先级顺序逐个降级）。
func TestCallWithFallback_FallbackThroughMultiple(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "A", results: []fakeResult{{status: 429}}}
	c2 := &fakeCaller{name: "B", results: []fakeResult{{status: 503, body: "当前分组负载已饱和"}}}
	c3 := &fakeCaller{name: "C", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "A"}, {client: c2, name: "B"}, {client: c3, name: "C"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil {
		t.Fatalf("应切到 C 成功，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if used.name != "C" {
		t.Fatalf("应降级到 C，得 %s", used.name)
	}
	if c1.callCount() != 1 || c2.callCount() != 1 || c3.callCount() != 1 {
		t.Fatalf("A/B/C 各应调 1 次，得 A=%d B=%d C=%d", c1.callCount(), c2.callCount(), c3.callCount())
	}
}
