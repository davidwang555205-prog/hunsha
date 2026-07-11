// Package wala 实现 WalaAPI（GPT Image-2）生图客户端，1:1 迁移自 server/index.mjs。
// 含 multipart 上传（有参考图走 /images/edits）、JSON 生成（无参考图走 /images/generations）、
// 重试（429/502/503/504 或上游负载饱和，指数退避）、超时（180s）。
package wala

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
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
}

// Config 客户端配置。
type Config struct {
	APIKey         string
	APIBaseURL     string // 末尾斜杠会被去掉
	ImageModel     string
	Timeout        time.Duration
	RetryAttempts  int
	DefaultQuality string // low/medium/high/auto
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
	return &Client{
		httpClient:     &http.Client{Timeout: cfg.Timeout * 2}, // 留余量，实际用 ctx 控制
		apiKey:         cfg.APIKey,
		apiBaseURL:     cfg.APIBaseURL,
		imageModel:     cfg.ImageModel,
		timeout:        cfg.Timeout,
		retryAttempts:  cfg.RetryAttempts,
		defaultQuality: cfg.DefaultQuality,
	}
}

// FileInput 参考图输入，对应 Node FileInput（前端 dataUrl）。
type FileInput struct {
	Name   string
	Type   string // mime
	Size   int64
	Data   []byte // 原始字节（已从 dataUrl 解码）
}

// GeneratedImage WalaAPI 返回的单张图，对应 Node extractGeneratedImages 输出。
type GeneratedImage struct {
	B64            string
	URL            string
	RevisedPrompt  string
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

// Call 调用 WalaAPI（单次，无重试），返回原始响应体文本与状态码。
// 对应 Node callWalaApi。
func (c *Client) Call(ctx context.Context, req Request) (status int, bodyText string, err error) {
	if c.apiKey == "" {
		return 0, "", NewError(500, "服务端缺少 WALA_API_KEY 环境变量。")
	}

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	resolvedQuality := c.resolveImageQuality(req.Quality)
	size := req.Size
	if size == "" {
		size = "1152x1536"
	}

	var httpReq *http.Request
	if len(req.Files) > 0 {
		// 有参考图：multipart/form-data，字段名 image 多值
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		for _, f := range req.Files {
			part, err := writer.CreateFormFile("image", f.Name)
			if err != nil {
				return 0, "", err
			}
			if _, err := part.Write(f.Data); err != nil {
				return 0, "", err
			}
		}
		_ = writer.WriteField("prompt", req.Prompt)
		_ = writer.WriteField("model", c.imageModel)
		_ = writer.WriteField("size", size)
		_ = writer.WriteField("quality", resolvedQuality)
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
			"size":    size,
			"quality": resolvedQuality,
		}
		b, _ := json.Marshal(payload)
		httpReq, err = http.NewRequestWithContext(ctx, http.MethodPost, c.apiBaseURL+"/images/generations", bytes.NewReader(b))
		if err != nil {
			return 0, "", err
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
		httpReq.Header.Set("Content-Type", "application/json")
	}

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

// IsRetryable 与 Node isRetryableWalaResponse 一致：429/502/503/504 或 body 含特定中文串。
func IsRetryable(status int, bodyText string) bool {
	switch status {
	case 429, 502, 503, 504:
		return true
	}
	return strings.Contains(bodyText, "当前分组上游负载已饱和") ||
		strings.Contains(bodyText, "当前分组负载已饱和")
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
	var lastErr error
	for attempt := 1; attempt <= c.retryAttempts; attempt++ {
		status, bodyText, err = c.Call(ctx, req)
		// 无 error：HTTP 响应已拿到
		if err == nil {
			if status < 400 || attempt >= c.retryAttempts {
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
				if !IsRetryable(walaErr.StatusCode, walaErr.Message) || attempt >= c.retryAttempts {
					return 0, "", err
				}
			} else if attempt >= c.retryAttempts {
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
