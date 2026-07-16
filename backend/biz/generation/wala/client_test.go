package wala

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// newTestClient 构造指向 mock server 的 client。
func newTestClient(t *testing.T, baseURL, protocol, model string) *Client {
	t.Helper()
	return NewClient(Config{
		APIKey:         "test-key",
		APIBaseURL:     baseURL,
		ImageModel:     model,
		Timeout:        5 * time.Second,
		RetryAttempts:  1,
		DefaultQuality: "medium",
		Protocol:       protocol,
	})
}

// mockImageServer 启一个 mock 图像服务器，按路径返回不同响应。
// modelsResp 为 /images/models 的返回体（nil 则不特殊处理）；record 记录收到的请求。
type mockRecorder struct {
	path   string
	method string
	ct     string
	body   string
	values map[string][]string // multipart value 字段
	files  map[string][]string // multipart file 字段名 -> 文件名列表
}

func newMockImageServer(t *testing.T, modelsResp string) (*httptest.Server, *mockRecorder) {
	t.Helper()
	rec := &mockRecorder{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.path = r.URL.Path
		rec.method = r.Method
		rec.ct = r.Header.Get("Content-Type")
		if strings.HasPrefix(rec.ct, "multipart/form-data") {
			_ = r.ParseMultipartForm(10 << 20)
			rec.values = r.MultipartForm.Value
			rec.files = map[string][]string{}
			for name := range r.MultipartForm.File {
				for _, f := range r.MultipartForm.File[name] {
					rec.files[name] = append(rec.files[name], f.Filename)
				}
			}
		} else {
			b, _ := io.ReadAll(r.Body)
			rec.body = string(b)
		}
		if r.Method == http.MethodGet && r.URL.Path == "/images/models" {
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, modelsResp)
			return
		}
		// 生图响应：data[].b64_json
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		io.WriteString(w, `{"data":[{"b64_json":"aGVsbG8=","media_type":"image/png"}]}`)
	}))
	return srv, rec
}

// 协议 A：有参考图走 multipart /images/edits，字段 image[]，传 size。
func TestCallOpenAI_EditsMultipart(t *testing.T) {
	srv, rec := newMockImageServer(t, "")
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openai", "gpt-image-2")

	status, _, err := c.Call(context.Background(), Request{
		Prompt: "test",
		Files:  []FileInput{{Name: "a.png", Type: "image/png", Data: []byte("png")}},
		Size:   "1152x1536",
	})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if rec.path != "/images/edits" {
		t.Fatalf("应 POST /images/edits，得 %s", rec.path)
	}
	if len(rec.files["image[]"]) != 1 || rec.files["image[]"][0] != "a.png" {
		t.Fatalf("应有 image[] 文件字段，得 %v", rec.files)
	}
	if rec.values["size"][0] != "1152x1536" {
		t.Fatalf("应传 size=1152x1536，得 %v", rec.values["size"])
	}
	if rec.values["quality"][0] != "medium" {
		t.Fatalf("应传 quality=medium，得 %v", rec.values["quality"])
	}
	if rec.values["model"][0] != "gpt-image-2" {
		t.Fatalf("应传 model=gpt-image-2，得 %v", rec.values["model"])
	}
}

// 协议 A：无参考图走 json /images/generations，传 size。
func TestCallOpenAI_GenerationsJSON(t *testing.T) {
	srv, rec := newMockImageServer(t, "")
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openai", "gpt-image-2")

	status, _, err := c.Call(context.Background(), Request{Prompt: "test", Size: "1024x1024"})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if rec.path != "/images/generations" {
		t.Fatalf("应 POST /images/generations，得 %s", rec.path)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(rec.body), &body); err != nil {
		t.Fatalf("响应体应 json，err %v", err)
	}
	if body["size"] != "1024x1024" {
		t.Fatalf("应传 size=1024x1024，得 %v", body["size"])
	}
}

// 协议 B（OpenRouter）：POST /images，参考图走 input_references（data url），gpt-image-2 不传 size。
func TestCallOpenRouter_GPTImage2(t *testing.T) {
	models := `{"data":[{"id":"openai/gpt-image-2","supported_parameters":{"quality":{"type":"enum","values":["low","medium","high"]},"input_references":{"type":"range","min":0,"max":16}}}]}`
	srv, rec := newMockImageServer(t, models)
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openrouter", "openai/gpt-image-2")

	status, _, err := c.Call(context.Background(), Request{
		Prompt: "test",
		Files:  []FileInput{{Name: "a.png", Type: "image/png", Data: []byte("png")}},
		Size:   "1152x1536",
	})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	if rec.path != "/images" {
		t.Fatalf("应 POST /images，得 %s", rec.path)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(rec.body), &body); err != nil {
		t.Fatalf("响应体应 json，err %v", err)
	}
	// input_references 应为 data url
	refs, ok := body["input_references"].([]any)
	if !ok || len(refs) != 1 {
		t.Fatalf("应有 1 个 input_references，得 %v", body["input_references"])
	}
	ref := refs[0].(map[string]any)
	imgURL := ref["image_url"].(map[string]any)["url"].(string)
	if !strings.HasPrefix(imgURL, "data:image/png;base64,") {
		t.Fatalf("input_references 应为 data url，得 %s", imgURL)
	}
	// gpt-image-2 supported_parameters 不含 aspect_ratio/resolution，但实测接受 size（透传 OpenAI）：传分辨率
	if body["size"] != "1152x1536" {
		t.Fatalf("gpt-image-2 应传 size=1152x1536，得 %v", body["size"])
	}
	for _, k := range []string{"resolution", "aspect_ratio"} {
		if v, ok := body[k]; ok {
			t.Fatalf("gpt-image-2 不应传 %s，得 %v", k, v)
		}
	}
	if body["quality"] != "medium" {
		t.Fatalf("应传 quality=medium，得 %v", body["quality"])
	}
}

// 协议 B：gemini 模型支持 aspect_ratio，1152x1536 -> 3:4。
func TestCallOpenRouter_GeminiAspectRatio(t *testing.T) {
	models := `{"data":[{"id":"google/gemini-2.5-flash-image","supported_parameters":{"aspect_ratio":{"type":"enum","values":["1:1","3:4","4:3"]},"input_references":{"type":"range","min":0,"max":3}}}]}`
	srv, rec := newMockImageServer(t, models)
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openrouter", "google/gemini-2.5-flash-image")

	_, _, err := c.Call(context.Background(), Request{
		Prompt: "test",
		Files:  []FileInput{{Name: "a.png", Type: "image/png", Data: []byte("png")}},
		Size:   "1152x1536",
	})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(rec.body), &body); err != nil {
		t.Fatalf("响应体应 json，err %v", err)
	}
	if body["aspect_ratio"] != "3:4" {
		t.Fatalf("gemini 应传 aspect_ratio=3:4，得 %v", body["aspect_ratio"])
	}
	if _, ok := body["resolution"]; ok {
		t.Fatalf("gemini 不支持 resolution，不应传")
	}
	if _, ok := body["size"]; ok {
		t.Fatalf("OpenRouter 协议不应传 size，得 %v", body["size"])
	}
	// gemini 不支持 quality，不应传
	if _, ok := body["quality"]; ok {
		t.Fatalf("gemini 不支持 quality，不应传")
	}
}

// 协议 B：supportedParams 查询失败降级，仍传 quality+input_references，不传 size。
func TestCallOpenRouter_ParamsQueryFailDegraded(t *testing.T) {
	srv, rec := newMockImageServer(t, "not-json-garbage") // /images/models 返回非 json，解析失败
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openrouter", "openai/gpt-image-2")

	_, _, err := c.Call(context.Background(), Request{
		Prompt: "test",
		Files:  []FileInput{{Name: "a.png", Type: "image/png", Data: []byte("png")}},
		Size:   "1152x1536",
	})
	if err != nil {
		t.Fatalf("降级不应报错，得 %v", err)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(rec.body), &body); err != nil {
		t.Fatalf("响应体应 json，err %v", err)
	}
	if body["quality"] != "medium" {
		t.Fatalf("降级应传 quality，得 %v", body["quality"])
	}
	if _, ok := body["input_references"]; !ok {
		t.Fatalf("降级应传 input_references")
	}
	if _, ok := body["size"]; ok {
		t.Fatalf("降级不应传 size")
	}
}

// sizeToAspectRatio 单元测试。
func TestSizeToAspectRatio(t *testing.T) {
	cases := map[string]string{
		"1152x1536": "3:4",
		"1024x1024": "1:1",
		"1536x1024": "3:2",
		"1024x1536": "2:3",
		"badsize":   "",
		"":          "",
	}
	for in, want := range cases {
		if got := sizeToAspectRatio(in); got != want {
			t.Errorf("sizeToAspectRatio(%q) = %q, want %q", in, got, want)
		}
	}
}

// fileToDataURL 单元测试。
func TestFileToDataURL(t *testing.T) {
	got := fileToDataURL(FileInput{Name: "a.png", Type: "image/png", Data: []byte("hi")})
	if !strings.HasPrefix(got, "data:image/png;base64,") {
		t.Fatalf("应为 data:image/png;base64, 前缀，得 %s", got)
	}
	// 空 mime 兜底 png
	got2 := fileToDataURL(FileInput{Name: "a", Data: []byte("hi")})
	if !strings.HasPrefix(got2, "data:image/png;base64,") {
		t.Fatalf("空 mime 应兜底 png，得 %s", got2)
	}
}

// 响应解析：两协议 data[].b64_json 兼容（ExtractGeneratedImages）。
func TestExtractGeneratedImages_OpenRouterShape(t *testing.T) {
	payload := map[string]any{
		"data": []any{
			map[string]any{"b64_json": "aGk=", "media_type": "image/png"},
		},
	}
	imgs := ExtractGeneratedImages(payload)
	if len(imgs) != 1 || imgs[0].B64 != "aGk=" {
		t.Fatalf("应解析 1 张 b64=aGk=，得 %v", imgs)
	}
}

// aspectToResolution 单元测试：比例->分辨率，分辨率原样，未知空串。
func TestAspectRatioToResolution(t *testing.T) {
	cases := map[string]string{
		"3:4":       "1152x1536",
		"1:1":       "1024x1024",
		"4:3":       "1536x1152",
		"16:9":      "1536x864",
		"1152x1536": "1152x1536", // 已是分辨率原样返回
		"bad":       "",
		"":          "",
	}
	for in, want := range cases {
		if got := aspectToResolution(in); got != want {
			t.Errorf("aspectToResolution(%q) = %q, want %q", in, got, want)
		}
	}
}

// toAspectRatio 单元测试：比例原样返回，分辨率->最简整数比。
func TestToAspectRatio(t *testing.T) {
	cases := map[string]string{
		"3:4":       "3:4",
		"16:9":      "16:9",
		"1152x1536": "3:4",
		"1024x1024": "1:1",
		"bad":       "",
	}
	for in, want := range cases {
		if got := toAspectRatio(in); got != want {
			t.Errorf("toAspectRatio(%q) = %q, want %q", in, got, want)
		}
	}
}

// 协议 A：传比例 3:4，callOpenAI 应转成分辨率 1152x1536 传 OpenAI size 字段。
func TestCallOpenAI_AspectRatioToResolution(t *testing.T) {
	srv, rec := newMockImageServer(t, "")
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openai", "gpt-image-2")

	status, _, err := c.Call(context.Background(), Request{Prompt: "test", Size: "3:4"})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	if status != 200 {
		t.Fatalf("status 应 200，得 %d", status)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(rec.body), &body); err != nil {
		t.Fatalf("响应体应 json，err %v", err)
	}
	if body["size"] != "1152x1536" {
		t.Fatalf("比例 3:4 应转成 size=1152x1536，得 %v", body["size"])
	}
}

// 协议 B：gemini 传比例 16:9，应原样传 aspect_ratio=16:9（toAspectRatio）。
func TestCallOpenRouter_GeminiAspectRatioFromRatio(t *testing.T) {
	models := `{"data":[{"id":"google/gemini-2.5-flash-image","supported_parameters":{"aspect_ratio":{"type":"enum","values":["1:1","3:4","4:3","16:9"]},"input_references":{"type":"range","min":0,"max":3}}}]}`
	srv, rec := newMockImageServer(t, models)
	defer srv.Close()
	c := newTestClient(t, srv.URL, "openrouter", "google/gemini-2.5-flash-image")

	_, _, err := c.Call(context.Background(), Request{
		Prompt: "test",
		Files:  []FileInput{{Name: "a.png", Type: "image/png", Data: []byte("png")}},
		Size:   "16:9",
	})
	if err != nil {
		t.Fatalf("不应出错，得 %v", err)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(rec.body), &body); err != nil {
		t.Fatalf("响应体应 json，err %v", err)
	}
	if body["aspect_ratio"] != "16:9" {
		t.Fatalf("比例 16:9 应原样传 aspect_ratio=16:9，得 %v", body["aspect_ratio"])
	}
}
