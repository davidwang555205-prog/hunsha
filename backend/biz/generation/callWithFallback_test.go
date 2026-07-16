package generation

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"bridal/backend/biz/generation/wala"
)

// fakeCaller 模拟 wala 调用，按预设结果序列返回，记录调用次数。
// 仅用于测试 callWithFallback 的线路切换逻辑，不触达真实 HTTP。
type fakeCaller struct {
	name    string
	results []fakeResult
	calls   int32
	delay   time.Duration
}

type fakeResult struct {
	status int
	body   string
	err    error
}

func (f *fakeCaller) CallWithRetries(ctx context.Context, req wala.Request) (int, string, error) {
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

// 场景4b：线路返回明确的参考图兼容错误，源图已在提交前校验过，应切备用线路而非让整项任务失败。
func TestCallWithFallback_FallbackOnImageCompatibility400(t *testing.T) {
	u := &Usecase{}
	c1 := &fakeCaller{name: "OpenRouter", results: []fakeResult{{status: 400, body: "Invalid image file or mode for image 1"}}}
	c2 := &fakeCaller{name: "WalaAPI", results: []fakeResult{{status: 200, body: `{"data":[{"b64_json":"x"}]}`}}}
	cands := []channelClient{{client: c1, name: "OpenRouter"}, {client: c2, name: "WalaAPI"}}

	status, _, used, err := u.callWithFallback(context.Background(), cands, wala.Request{})
	if err != nil || status != 200 || used.name != "WalaAPI" {
		t.Fatalf("图片兼容错误后应切到 WalaAPI，status=%d used=%s err=%v", status, used.name, err)
	}
	if c1.callCount() != 1 || c2.callCount() != 1 {
		t.Fatalf("OpenRouter/WalaAPI 各应调用一次，得 %d/%d", c1.callCount(), c2.callCount())
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
