package redfox

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestQueryWorkSendsDocumentedRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/story/api/xhsUser/queryWorkDetail" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("REDFOX_API_KEY"); got != "secret" {
			t.Fatalf("api key = %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), `"workLink":"https://www.xiaohongshu.com/explore/abc"`) {
			t.Fatalf("unexpected request body %s", body)
		}
		_, _ = w.Write([]byte(`{"code":2000,"msg":"成功","data":{"workId":"abc","workReadedCount":12,"accountUserid":"author"}}`))
	}))
	defer server.Close()

	client := NewClient(Config{APIKey: "secret", APIBaseURL: server.URL, Timeout: time.Second})
	work, err := client.QueryWork(context.Background(), "https://www.xiaohongshu.com/explore/abc")
	if err != nil {
		t.Fatal(err)
	}
	if work.WorkID != "abc" || work.WorkReadedCount != 12 || work.AccountUserID != "author" {
		t.Fatalf("unexpected work: %#v", work)
	}
}

func TestQuerySimilarAccountsMapsProviderError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/story/api/xhsUser/querySimilarAccounts" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"code":4004,"msg":"操作过于频繁"}`))
	}))
	defer server.Close()

	client := NewClient(Config{APIKey: "secret", APIBaseURL: server.URL, Timeout: time.Second})
	_, err := client.QuerySimilarAccounts(context.Background(), "author")
	if err == nil {
		t.Fatal("expected error")
	}
	providerErr, ok := err.(*Error)
	if !ok || providerErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("unexpected error %#v", err)
	}
}

func TestQueryWorkHidesProviderCreditExhaustion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"code":3201,"msg":"积分不足"}`))
	}))
	defer server.Close()

	client := NewClient(Config{APIKey: "secret", APIBaseURL: server.URL, Timeout: time.Second})
	_, err := client.QueryWork(context.Background(), "https://www.xiaohongshu.com/explore/abc")
	if err == nil {
		t.Fatal("expected error")
	}
	providerErr, ok := err.(*Error)
	if !ok || providerErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("unexpected error %#v", err)
	}
	if providerErr.Message != "数据获取繁忙，请稍后再试。" {
		t.Fatalf("message = %q", providerErr.Message)
	}
}
