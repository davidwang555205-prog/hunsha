// Package wala 实现 WalaAPI（GPT Image-2）生图客户端，1:1 迁移自 server/index.mjs。
// 含 multipart 上传（有参考图走 /images/edits）、JSON 生成（无参考图走 /images/generations）、
// 重试（429/502/503/504 或上游负载饱和，指数退避）、超时（180s）。
package wala

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Client WalaAPI 客户端。
type Client struct {
	httpClient     *http.Client
	apiKey         string
	apiBaseURL     string
	imageModel     string
	timeout        time.Duration
	retryAttempts  int
	defaultQuality string
	protocol       string   // openai | openrouter
	paramsCache    sync.Map // OpenRouter 协议：modelID -> supported_parameters(map[string]any)，首次调用查 /images/models 懒加载
}

// Config 客户端配置。
type Config struct {
	APIKey         string
	APIBaseURL     string // 末尾斜杠会被去掉
	ImageModel     string
	Timeout        time.Duration
	RetryAttempts  int
	DefaultQuality string // low/medium/high/auto
	Protocol       string // openai | openrouter，空默认 openai。openai 走 /images/edits+generations，openrouter 走 /images+input_references
}

// NewClient 创建客户端。
func NewClient(cfg Config) *Client {
	if cfg.APIBaseURL == "" {
		cfg.APIBaseURL = "https://walaapi.net/v1"
	}
	cfg.APIBaseURL = strings.TrimRight(cfg.APIBaseURL, "/")
	if cfg.ImageModel == "" {
		cfg.ImageModel = "gpt-image-2"
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 180 * time.Second
	}
	if cfg.RetryAttempts <= 0 {
		cfg.RetryAttempts = 3
	}
	if cfg.DefaultQuality == "" {
		cfg.DefaultQuality = "medium"
	}
	protocol := strings.ToLower(cfg.Protocol)
	if protocol == "" {
		protocol = "openai"
	}
	return &Client{
		httpClient:     &http.Client{Timeout: cfg.Timeout * 2}, // 留余量，实际用 ctx 控制
		apiKey:         cfg.APIKey,
		apiBaseURL:     cfg.APIBaseURL,
		imageModel:     cfg.ImageModel,
		timeout:        cfg.Timeout,
		retryAttempts:  cfg.RetryAttempts,
		defaultQuality: cfg.DefaultQuality,
		protocol:       protocol,
	}
}

// FileInput 参考图输入，对应 Node FileInput（前端 dataUrl）。
type FileInput struct {
	Name          string
	Type          string // mime
	Size          int64
	Data          []byte // 原始字节（已从 dataUrl 解码）
	SourceURL     string // 仅供审计展示的受控对象 URL，绝不参与上游请求
	ReferenceKind string // scene | product | continuity_scene | continuity_identity
}

// AttemptEvent 描述一次真实发往上游模型的 HTTP 请求。
// 调用方可据此写审计记录；响应体只在内存中传递，调用方不得持久化其中的 Base64 图片数据。
type AttemptEvent struct {
	Attempt     int
	StartedAt   time.Time
	CompletedAt time.Time
	Status      int
	BodyText    string
	Err         error
	Finished    bool
}

// AttemptObserver 在每次真实 HTTP 调用开始、结束时各调用一次。
type AttemptObserver func(AttemptEvent)

// GeneratedImage WalaAPI 返回的单张图，对应 Node extractGeneratedImages 输出。
type GeneratedImage struct {
	B64           string
	URL           string
	RevisedPrompt string
}

// Request 生图请求，对应 Node callWalaApi 入参。
type Request struct {
	Prompt  string
	Files   []FileInput
	Size    string
	Quality string
}

// MaxContinuityReferenceBytes 连续性参考图大小上限 20MB（与 Node 一致）。
const MaxContinuityReferenceBytes = 20 * 1024 * 1024

var supportedQualities = map[string]bool{"low": true, "medium": true, "high": true, "auto": true}

// resolveImageQuality 与 Node resolveImageQuality 一致：非法值用默认。
func (c *Client) resolveImageQuality(quality string) string {
	if supportedQualities[quality] {
		return quality
	}
	return c.defaultQuality
}

// Error 带状态码的错误，对应 Node Object.assign(new Error(...), { statusCode })。
type Error struct {
	StatusCode int
	Message    string
}

func (e *Error) Error() string { return e.Message }

// NewError 创建带状态码的错误。
func NewError(statusCode int, message string) *Error {
	return &Error{StatusCode: statusCode, Message: message}
}

// Call 调用图像接口（单次，无重试），按 protocol 分发：
//   - openai（OpenAI Images API 兼容：官方 OpenAI / WalaAPI）：/images/edits(multipart) 或 /images/generations(json)
//   - openrouter：/images(json) + input_references，动态按模型 supported_parameters 构造参数
//
// 返回原始响应体文本与状态码。对应 Node callWalaApi。
func (c *Client) Call(ctx context.Context, req Request) (status int, bodyText string, err error) {
	if c.apiKey == "" {
		return 0, "", NewError(500, "服务端缺少 WALA_API_KEY 环境变量。")
	}

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	resolvedQuality := c.resolveImageQuality(req.Quality)
	size := req.Size
	if size == "" {
		size = "3:4"
	}

	switch c.protocol {
	case "openrouter":
		return c.callOpenRouter(ctx, req, resolvedQuality, size)
	case "seedream":
		// 5.0 Pro（modelID 含 5-0-pro）API 参数与 4.0 不同，走 callSeedream5；其余走 callSeedream。
		if strings.Contains(c.imageModel, "5-0-pro") {
			return c.callSeedream5(ctx, req, size)
		}
		return c.callSeedream(ctx, req, size)
	case "gemini":
		return c.callGemini(ctx, req)
	default:
		return c.callOpenAI(ctx, req, resolvedQuality, size)
	}
}

// callOpenAI 协议 A（OpenAI Images API 兼容：官方 OpenAI / WalaAPI）：
// 有参考图 multipart POST /images/edits（字段 image[] 多值）；无参考图 json POST /images/generations。传 size。
func (c *Client) callOpenAI(ctx context.Context, req Request, quality, size string) (status int, bodyText string, err error) {
	// openai 协议传分辨率 size：比例(3:4)->分辨率(1152x1536)，已是分辨率原样返回；未知降级 1152x1536
	resolution := aspectToResolution(size)
	if resolution == "" {
		resolution = "1152x1536"
	}
	var httpReq *http.Request
	if len(req.Files) > 0 {
		// 有参考图：multipart/form-data，字段名 image[] 多值（官方 OpenAI 标准；WalaAPI 兼容）
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		for _, f := range req.Files {
			part, err := writer.CreateFormFile("image[]", f.Name)
			if err != nil {
				return 0, "", err
			}
			if _, err := part.Write(f.Data); err != nil {
				return 0, "", err
			}
		}
		_ = writer.WriteField("prompt", req.Prompt)
		_ = writer.WriteField("model", c.imageModel)
		_ = writer.WriteField("size", resolution)
		_ = writer.WriteField("quality", quality)
		if err := writer.Close(); err != nil {
			return 0, "", err
		}
		httpReq, err = http.NewRequestWithContext(ctx, http.MethodPost, c.apiBaseURL+"/images/edits", body)
		if err != nil {
			return 0, "", err
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
		httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	} else {
		// 无参考图：JSON
		payload := map[string]string{
			"model":   c.imageModel,
			"prompt":  req.Prompt,
			"size":    resolution,
			"quality": quality,
		}
		b, _ := json.Marshal(payload)
		httpReq, err = http.NewRequestWithContext(ctx, http.MethodPost, c.apiBaseURL+"/images/generations", bytes.NewReader(b))
		if err != nil {
			return 0, "", err
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
		httpReq.Header.Set("Content-Type", "application/json")
	}
	return c.doRequest(ctx, httpReq)
}

// callOpenRouter 协议 B（OpenRouter）：POST /images（json），参考图走 input_references（image_url，base64 data url）。
// 动态查 /images/models 的 supported_parameters 决定传哪些参数：gpt-image-2 不传 size（模型自决），gemini 传 aspect_ratio 等。
func (c *Client) callOpenRouter(ctx context.Context, req Request, quality, size string) (status int, bodyText string, err error) {
	params, _ := c.supportedParams(c.imageModel) // 查询失败降级 nil：按默认传 quality+input_references，不传 size

	body := map[string]any{
		"model":  c.imageModel,
		"prompt": req.Prompt,
	}
	if len(req.Files) > 0 {
		maxRefs := paramMax(params, "input_references", 16)
		refs := make([]map[string]any, 0, len(req.Files))
		for _, f := range req.Files {
			if len(refs) >= maxRefs {
				break
			}
			refs = append(refs, map[string]any{
				"type":      "image_url",
				"image_url": map[string]any{"url": fileToDataURL(f)},
			})
		}
		body["input_references"] = refs
	}
	if params == nil || hasParam(params, "quality") {
		body["quality"] = quality
	}
	// 尺寸按模型 supported_parameters 映射：aspect_ratio(比例) > resolution(分辨率) > size(分辨率，gpt-image-2 实测接受透传 OpenAI)
	// params==nil（查询失败降级）时不传尺寸，避免对未知模型传 size 触发 400
	switch {
	case hasParam(params, "aspect_ratio"):
		if ar := toAspectRatio(size); ar != "" {
			body["aspect_ratio"] = ar
		}
	case hasParam(params, "resolution"):
		if r := aspectToResolution(size); r != "" {
			body["resolution"] = r
		}
	case params != nil:
		if r := aspectToResolution(size); r != "" {
			body["size"] = r
		}
	}

	b, _ := json.Marshal(body)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiBaseURL+"/images", bytes.NewReader(b))
	if err != nil {
		return 0, "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	return c.doRequest(ctx, httpReq)
}

// callSeedream 协议 C（字节方舟 Seedream）：POST /images/generations（json），OpenAI 兼容。
// 参考图走 image: [data-url]（base64），size 传比例（3:4），response_format=b64_json，watermark=false。
// 响应 {data:[{b64_json}]} 复用 ExtractGeneratedImages。无独立 negative 字段，拼进 prompt（adapter 层）。
func (c *Client) callSeedream(ctx context.Context, req Request, size string) (status int, bodyText string, err error) {
	body := map[string]any{
		"model":           c.imageModel,
		"prompt":          req.Prompt,
		"size":            mapSeedreamSize(size),
		"response_format": "b64_json",
		"watermark":       false,
	}
	if len(req.Files) > 0 {
		imgs := make([]string, 0, len(req.Files))
		for _, f := range req.Files {
			imgs = append(imgs, fileToDataURL(f))
		}
		body["image"] = imgs
	}
	b, _ := json.Marshal(body)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiBaseURL+"/images/generations", bytes.NewReader(b))
	if err != nil {
		return 0, "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	return c.doRequest(ctx, httpReq)
}

// callSeedream5 协议 C'（字节方舟豆包 Seedream 5.0 Pro）：与 4.0 同走 POST /images/generations（json），
// 但 API 参数差异：response_format=url（4.0 b64_json）、size 档位（4.0 比例）、stream=false、watermark=true。
//
// ⚠️ 待真机确认（真机 400 后针对性调整）：
//   - image 是否接受 base64 data-url（当前复用 4.0 的 fileToDataURL）；若 5.0 只接受 http URL，
//     需把参考图上传对象存储换 presigned URL 再传入。
//   - response_format=url 返回的 URL 是否临时（若临时，需下载存 MinIO，或改 response_format=b64_json）。
//   - size 档位映射（当前透传 req.Size，空降级 "2K"）；若 5.0 不接受比例字符串需按模型映射档位。
func (c *Client) callSeedream5(ctx context.Context, req Request, size string) (status int, bodyText string, err error) {
	sz := size
	if sz == "" {
		sz = "2K"
	}
	body := map[string]any{
		"model":           c.imageModel,
		"prompt":          req.Prompt,
		"size":            sz,
		"response_format": "url",
		"stream":          false,
		"watermark":       true,
	}
	if len(req.Files) > 0 {
		imgs := make([]string, 0, len(req.Files))
		for _, f := range req.Files {
			imgs = append(imgs, fileToDataURL(f))
		}
		body["image"] = imgs
	}
	b, _ := json.Marshal(body)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiBaseURL+"/images/generations", bytes.NewReader(b))
	if err != nil {
		return 0, "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	return c.doRequest(ctx, httpReq)
}

// callGemini 协议 D（Google Gemini / Nano Banana 官方）：POST /v1beta/models/{model}:generateContent。
// 鉴权 header x-goog-api-key（非 Bearer）。参考图走 contents.parts[].inline_data，文本指令在参考图之后。
// aspect ratio 写进 prompt 文本（无独立字段）。响应 candidates[].content.parts[].inline_data.data，
// 与 ExtractGeneratedImages 不兼容，callGemini 内部标准化为 {data:[{b64_json}]} 供上层统一解析。
func (c *Client) callGemini(ctx context.Context, req Request) (status int, bodyText string, err error) {
	prompt := req.Prompt
	if ar := toAspectRatio(req.Size); ar != "" {
		if prompt != "" {
			prompt += "\n"
		}
		prompt += "Aspect ratio: " + ar + "."
	}
	parts := []map[string]any{}
	for _, f := range req.Files {
		mime := f.Type
		if mime == "" {
			mime = "image/png"
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]any{"mime_type": mime, "data": base64.StdEncoding.EncodeToString(f.Data)},
		})
	}
	parts = append(parts, map[string]any{"text": prompt})
	body := map[string]any{"contents": []map[string]any{{"parts": parts}}}
	b, _ := json.Marshal(body)
	endpoint := c.apiBaseURL + "/v1beta/models/" + c.imageModel + ":generateContent"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(b))
	if err != nil {
		return 0, "", err
	}
	httpReq.Header.Set("x-goog-api-key", c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	status, rawBody, err := c.doRequest(ctx, httpReq)
	if err != nil {
		return status, rawBody, err
	}
	if status >= 400 {
		return status, rawBody, nil // 错误响应原样返回，上层 ExtractErrorMessage 解析
	}
	// 成功：标准化为 OpenAI 兼容 {data:[{b64_json}]}，上层 ExtractGeneratedImages 统一解析
	images := extractGeminiImages(ParseJSONBody(rawBody))
	if len(images) == 0 {
		return status, rawBody, nil // 无图，原样返回让上层报"未返回图片"
	}
	data := make([]map[string]any, 0, len(images))
	for _, img := range images {
		data = append(data, map[string]any{"b64_json": img.B64})
	}
	wrapped, _ := json.Marshal(map[string]any{"data": data})
	return status, string(wrapped), nil
}

// mapSeedreamSize size 映射到 Seedream 支持的尺寸：比例(3:4)/分辨率档(1K/2K/4K)/显式像素 均原样透传；
// 空降级 "3:4"。Seedream 原生支持比例字符串，不像 openai 需转分辨率。
func mapSeedreamSize(size string) string {
	if size == "" {
		return "3:4"
	}
	return size
}

// extractGeminiImages 解析 Gemini generateContent 响应：candidates[].content.parts[].inline_data.data。
// 只取 inline_data part（响应可能含 text part 混合），与 ExtractGeneratedImages 结构不兼容。
func extractGeminiImages(payload map[string]any) []GeneratedImage {
	out := []GeneratedImage{}
	candidates, ok := payload["candidates"].([]any)
	if !ok {
		return out
	}
	for _, cand := range candidates {
		candMap, ok := cand.(map[string]any)
		if !ok {
			continue
		}
		content, ok := candMap["content"].(map[string]any)
		if !ok {
			continue
		}
		parts, ok := content["parts"].([]any)
		if !ok {
			continue
		}
		for _, p := range parts {
			partMap, ok := p.(map[string]any)
			if !ok {
				continue
			}
			inline, ok := partMap["inline_data"].(map[string]any)
			if !ok {
				continue
			}
			data, _ := inline["data"].(string)
			if data == "" {
				continue
			}
			out = append(out, GeneratedImage{B64: data})
		}
	}
	return out
}

// doRequest 发送已构造的请求，读响应，ctx 超时转 504。
func (c *Client) doRequest(ctx context.Context, httpReq *http.Request) (status int, bodyText string, err error) {
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		// 超时（ctx deadline）转 504
		if ctx.Err() == context.DeadlineExceeded {
			return 0, "", NewError(504, fmt.Sprintf("生图接口超过 %d 秒未返回，已中断。", int(c.timeout.Seconds())))
		}
		return 0, "", err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(data), nil
}

// supportedParams 查 OpenRouter /images/models，缓存 modelID -> supported_parameters。失败返回 nil（调用方降级）。
// 查询用独立 10s 超时，不占生图 ctx；接口公开免 key。
func (c *Client) supportedParams(modelID string) (map[string]any, error) {
	if v, ok := c.paramsCache.Load(modelID); ok {
		return v.(map[string]any), nil
	}
	qCtx, qCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer qCancel()
	req, err := http.NewRequestWithContext(qCtx, http.MethodGet, c.apiBaseURL+"/images/models", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var payload struct {
		Data []struct {
			ID                  string         `json:"id"`
			SupportedParameters map[string]any `json:"supported_parameters"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	for _, m := range payload.Data {
		c.paramsCache.Store(m.ID, m.SupportedParameters)
	}
	if v, ok := c.paramsCache.Load(modelID); ok {
		return v.(map[string]any), nil
	}
	return nil, fmt.Errorf("model %s not found in /images/models", modelID)
}

// fileToDataURL 把参考图字节转 base64 data URL（OpenRouter input_references 用）。
func fileToDataURL(f FileInput) string {
	mime := f.Type
	if mime == "" {
		mime = "image/png"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(f.Data)
}

// hasParam 模型是否支持某参数（params 非 nil 且含 key）。
func hasParam(params map[string]any, name string) bool {
	if params == nil {
		return false
	}
	_, ok := params[name]
	return ok
}

// paramMax 取 range 参数的 max（input_references/n 等），查询失败或无则返回 def。
func paramMax(params map[string]any, name string, def int) int {
	if params == nil {
		return def
	}
	p, ok := params[name].(map[string]any)
	if !ok {
		return def
	}
	if mx, ok := p["max"].(float64); ok {
		return int(mx)
	}
	return def
}

// aspectToResolution 宽高比 -> gpt-image-2 兼容分辨率（两边 16 的倍数，长宽比≤3:1，像素∈[655360,8294400]）。
// 已是 "WxH" 分辨率原样返回；未知比例返回空串（调用方降级）。
func aspectToResolution(size string) string {
	if strings.Contains(size, "x") {
		return size
	}
	switch size {
	case "1:1":
		return "1024x1024"
	case "3:4":
		return "1152x1536"
	case "4:3":
		return "1536x1152"
	case "16:9":
		return "1536x864"
	}
	return ""
}

// toAspectRatio 取宽高比："3:4" 原样返回；"1152x1536" -> "3:4"（最简整数比）；非法返回空串。
func toAspectRatio(size string) string {
	if strings.Contains(size, ":") {
		return size
	}
	return sizeToAspectRatio(size)
}

// sizeToAspectRatio "1152x1536" -> "3:4"（最简整数比）；非标准格式返回空串。
func sizeToAspectRatio(size string) string {
	parts := strings.SplitN(size, "x", 2)
	if len(parts) != 2 {
		return ""
	}
	w, err1 := strconv.Atoi(parts[0])
	h, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || w <= 0 || h <= 0 {
		return ""
	}
	g := gcd(w, h)
	return fmt.Sprintf("%d:%d", w/g, h/g)
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}

// IsRetryable 与 Node isRetryableWalaResponse 一致：429/502/503/504 或 body 含特定中文串。
func IsRetryable(status int, bodyText string) bool {
	switch status {
	case 429, 502, 503, 504:
		return true
	}
	return strings.Contains(bodyText, "当前分组上游负载已饱和") ||
		strings.Contains(bodyText, "当前分组负载已饱和")
}

// IsFallbackable 判断是否应切换到下一条模型线路。
// 404（接口不存在）切线路；可重试错误（429/5xx/负载饱和）也切。其余（含 400 user error，
// 如 "Invalid image file or mode for image"）不切--官方明确 user-correctable 错误不应自动
// 重试/降级，需改 prompt 或输入图；且 fallback 到同为 OpenAI 的线路必同样失败，降级只白烧 token。
func IsFallbackable(status int, bodyText string) bool {
	return status == http.StatusNotFound || IsRetryable(status, bodyText)
}

// retryDelay 与 Node retryDelayMs 一致：min(30s, 4s*2^(attempt-1))。
func retryDelay(attempt int) time.Duration {
	ms := 4000 * (1 << (attempt - 1)) // 4s * 2^(attempt-1)
	if ms > 30000 {
		ms = 30000
	}
	return time.Duration(ms) * time.Millisecond
}

// BuildOverloadMessage 与 Node buildWalaOverloadMessage 一致。
func (c *Client) BuildOverloadMessage(message string) string {
	prefix := fmt.Sprintf("WalaAPI 上游负载已饱和，已自动重试 %d 次仍未成功。请稍后再试，或在 WalaAPI 后台切换可用分组/模型后重试。", c.retryAttempts)
	if message != "" {
		return prefix + " 原始错误：" + message
	}
	return prefix
}

// CallWithRetries 调用 WalaAPI 带重试，返回最终状态码与响应体。
// 成功（2xx）或不可重试时立即返回；可重试失败按指数退避重试。
// 对应 Node callWalaApiWithRetries。返回 bodyText 供调用方解析。
func (c *Client) CallWithRetries(ctx context.Context, req Request) (status int, bodyText string, err error) {
	return c.CallWithAttempts(ctx, req, c.retryAttempts)
}

// CallWithAttempts 使用指定尝试次数调用生图接口。多线路 fallback 会把总重试预算
// 分给各候选线路，避免每条线路各自耗尽重试后才切换，导致一次失败长时间占住任务。
func (c *Client) CallWithAttempts(ctx context.Context, req Request, attempts int) (status int, bodyText string, err error) {
	return c.CallWithAttemptsObserved(ctx, req, attempts, nil)
}

// CallWithAttemptsObserved 与 CallWithAttempts 相同，但会为每一次实际 HTTP 请求回调 observer。
// 重试等待本身不会产生事件，避免把排队/退避误记为上游模型调用。
func (c *Client) CallWithAttemptsObserved(ctx context.Context, req Request, attempts int, observer AttemptObserver) (status int, bodyText string, err error) {
	if attempts <= 0 {
		attempts = c.retryAttempts
	}
	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		startedAt := time.Now()
		if observer != nil {
			observer(AttemptEvent{Attempt: attempt, StartedAt: startedAt})
		}
		status, bodyText, err = c.Call(ctx, req)
		if observer != nil {
			observer(AttemptEvent{
				Attempt:     attempt,
				StartedAt:   startedAt,
				CompletedAt: time.Now(),
				Status:      status,
				BodyText:    bodyText,
				Err:         err,
				Finished:    true,
			})
		}
		// 无 error：HTTP 响应已拿到
		if err == nil {
			if status < 400 || attempt >= attempts {
				return status, bodyText, nil
			}
			// 非 2xx：判断是否可重试
			if !IsRetryable(status, bodyText) {
				return status, bodyText, nil
			}
		} else {
			// 网络层错误（含超时 504）
			walaErr, ok := err.(*Error)
			if ok {
				if !IsRetryable(walaErr.StatusCode, walaErr.Message) || attempt >= attempts {
					return 0, "", err
				}
			} else if attempt >= attempts {
				return 0, "", err
			}
			lastErr = err
		}

		// 等待后重试
		select {
		case <-time.After(retryDelay(attempt)):
		case <-ctx.Done():
			return 0, "", ctx.Err()
		}
	}
	if lastErr != nil {
		return 0, "", lastErr
	}
	// 重试用尽仍未成功
	return 0, "", NewError(503, c.BuildOverloadMessage(""))
}

// ExtractGeneratedImages 与 Node extractGeneratedImages 一致：
// 兼容 data 数组/对象、顶层 b64_json/url 三种形态。
func ExtractGeneratedImages(payload map[string]any) []GeneratedImage {
	var candidates []map[string]any
	if dataArr, ok := payload["data"].([]any); ok {
		for _, d := range dataArr {
			if m, ok := d.(map[string]any); ok {
				candidates = append(candidates, m)
			}
		}
	} else if dataMap, ok := payload["data"].(map[string]any); ok {
		candidates = append(candidates, dataMap)
	} else if b64, ok := payload["b64_json"].(string); ok && b64 != "" {
		candidates = append(candidates, payload)
	} else if url, ok := payload["url"].(string); ok && url != "" {
		candidates = append(candidates, payload)
	}

	out := make([]GeneratedImage, 0, len(candidates))
	for _, item := range candidates {
		b64, _ := item["b64_json"].(string)
		if b64 == "" {
			b64, _ = item["image_base64"].(string)
		}
		if b64 == "" {
			b64, _ = item["base64"].(string)
		}
		url, _ := item["url"].(string)
		revised, _ := item["revised_prompt"].(string)
		if b64 == "" && url == "" {
			continue
		}
		out = append(out, GeneratedImage{B64: b64, URL: url, RevisedPrompt: revised})
	}
	return out
}

// ParseJSONBody 解析响应体为 map，失败返回含 raw 的 map（与 Node responsePayload = { raw } 一致）。
func ParseJSONBody(bodyText string) map[string]any {
	var payload map[string]any
	if err := json.Unmarshal([]byte(bodyText), &payload); err != nil {
		return map[string]any{"raw": bodyText}
	}
	return payload
}

// ExtractErrorMessage 从错误响应体提取 message，与 Node 优先级一致：
// error.message -> message -> responseText -> 默认。
func ExtractErrorMessage(payload map[string]any, bodyText string) string {
	if errMsg, ok := payload["error"].(map[string]any); ok {
		if m, ok := errMsg["message"].(string); ok && m != "" {
			return m
		}
	}
	if m, ok := payload["message"].(string); ok && m != "" {
		return m
	}
	if bodyText != "" {
		return bodyText
	}
	return "生图接口调用失败。"
}
