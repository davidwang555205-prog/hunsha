package wala

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// newRecordingProxy 启一个简易正向代理：命中计数 + 把请求转发给目标（绝对 URI 直接 Do）。
func newRecordingProxy(t *testing.T, hits *int32) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(hits, 1)
		outReq, err := http.NewRequest(r.Method, r.URL.String(), r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		outReq.Header = r.Header.Clone()
		resp, err := http.DefaultClient.Do(outReq)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		for k, vs := range resp.Header {
			for _, v := range vs {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	}))
}

// 配了 ProxyURL 的 client，上游请求必须经由代理；未配置的直连，代理零命中。
func TestProxyRouting(t *testing.T) {
	target, rec := newMockImageServer(t, "")
	defer target.Close()

	var hits int32
	proxy := newRecordingProxy(t, &hits)
	defer proxy.Close()

	// 走代理
	c := NewClient(Config{
		APIKey:         "test-key",
		APIBaseURL:     target.URL,
		ImageModel:     "gpt-image-2",
		Timeout:        5 * time.Second,
		RetryAttempts:  1,
		DefaultQuality: "medium",
		Protocol:       "openai",
		ProxyURL:       proxy.URL,
	})
	status, _, err := c.Call(context.Background(), Request{Prompt: "test", Size: "1024x1024"})
	if err != nil || status != 200 {
		t.Fatalf("走代理调用应成功，status=%d err=%v", status, err)
	}
	if atomic.LoadInt32(&hits) == 0 {
		t.Fatal("配了 ProxyURL 但代理零命中，流量未走代理")
	}
	if rec.path != "/images/generations" {
		t.Fatalf("目标应收到 /images/generations，得 %s", rec.path)
	}

	// 直连：代理命中数不再增长
	before := atomic.LoadInt32(&hits)
	direct := newTestClient(t, target.URL, "openai", "gpt-image-2")
	status, _, err = direct.Call(context.Background(), Request{Prompt: "test", Size: "1024x1024"})
	if err != nil || status != 200 {
		t.Fatalf("直连调用应成功，status=%d err=%v", status, err)
	}
	if atomic.LoadInt32(&hits) != before {
		t.Fatal("未配 ProxyURL 的 client 不应触碰代理")
	}
}

// 无效 ProxyURL 静默降级直连（线路校验层已挡格式错误，这里兜底防整线路不可用）。
func TestInvalidProxyURLFallsBackDirect(t *testing.T) {
	target, _ := newMockImageServer(t, "")
	defer target.Close()

	c := NewClient(Config{
		APIKey:         "test-key",
		APIBaseURL:     target.URL,
		ImageModel:     "gpt-image-2",
		Timeout:        5 * time.Second,
		RetryAttempts:  1,
		DefaultQuality: "medium",
		Protocol:       "openai",
		ProxyURL:       "://bad-proxy",
	})
	status, _, err := c.Call(context.Background(), Request{Prompt: "test", Size: "1024x1024"})
	if err != nil || status != 200 {
		t.Fatalf("无效代理应降级直连成功，status=%d err=%v", status, err)
	}
}
