// Package redfox implements the RedfoxHub Xiaohongshu data APIs used by
// generation-history tracking. It intentionally calls the documented REST APIs
// directly instead of executing Redfox Skill scripts or their HTML renderer.
package redfox

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const successCode = 2000

type Config struct {
	APIKey     string
	APIBaseURL string
	Timeout    time.Duration
}

type Client struct {
	httpClient *http.Client
	apiKey     string
	apiBaseURL string
	timeout    time.Duration
}

func NewClient(cfg Config) *Client {
	if cfg.APIBaseURL == "" {
		cfg.APIBaseURL = "https://redfox.hk"
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 15 * time.Second
	}
	return &Client{
		httpClient: &http.Client{Timeout: cfg.Timeout + 2*time.Second},
		apiKey:     cfg.APIKey,
		apiBaseURL: strings.TrimRight(cfg.APIBaseURL, "/"),
		timeout:    cfg.Timeout,
	}
}

type Error struct {
	StatusCode int
	Code       int
	Message    string
}

func (e *Error) Error() string { return e.Message }

func newError(statusCode, code int, message string) *Error {
	return &Error{StatusCode: statusCode, Code: code, Message: message}
}

type Work struct {
	WorkID             string `json:"workId"`
	WorkPublishTime    string `json:"workPublishTime"`
	WorkTitle          string `json:"workTitle"`
	WorkDesc           string `json:"workDesc"`
	CoverURL           string `json:"coverUrl"`
	AccountNickname    string `json:"accountNickname"`
	AccountUserID      string `json:"accountUserid"`
	WorkCommentsCount  int    `json:"workCommentsCount"`
	WorkLikedCount     int    `json:"workLikedCount"`
	WorkCollectedCount int    `json:"workCollectedCount"`
	WorkReadedCount    int    `json:"workReadedCount"`
	WorkSharedCount    int    `json:"workSharedCount"`
	WorkUpdateTime     string `json:"workUpdateTime"`
	WorkURL            string `json:"workUrl"`
	WorkType           string `json:"workType"`
}

type Account struct {
	AccountName       string `json:"accountName"`
	AccountAvatar     string `json:"accountAvatar"`
	AccountID         string `json:"accountId"`
	UserID            string `json:"userId"`
	AccountFans       int    `json:"accountFans"`
	AccountDesc       string `json:"accountDesc"`
	AccountTotalWorks int    `json:"accountTotalWorks"`
	AccountLikes      int    `json:"accountLikes"`
	AccountCollects   int    `json:"accountCollectes"`
	AccountUpdateTime string `json:"accountUpdateTime"`
	AccountFollows    int    `json:"accountFollows"`
}

type SimilarAccount struct {
	AccountID              string `json:"accountId"`
	RedID                  string `json:"redId"`
	Nickname               string `json:"nickname"`
	Avatar                 string `json:"avatar"`
	URL                    string `json:"url"`
	Fans                   int    `json:"fans"`
	Level                  string `json:"level"`
	Collected              int    `json:"collected"`
	Liked                  int    `json:"liked"`
	TotalWork              int    `json:"totalWork"`
	NoteCountSeven         int    `json:"noteCountSeven"`
	InteractiveCountSeven  int    `json:"interactiveCountSeven"`
	InteractiveCountThirty int    `json:"interactiveCountThirty"`
}

type SimilarResult struct {
	SameLevelAccounts []SimilarAccount `json:"sameLevelAccounts"`
	HighLevelAccounts []SimilarAccount `json:"highLevelAccounts"`
}

func (c *Client) QueryWork(ctx context.Context, workLink string) (Work, error) {
	var out Work
	err := c.post(ctx, "/story/api/xhsUser/queryWorkDetail", map[string]string{"workLink": workLink}, &out)
	return out, err
}

// QueryAccount sends the documented display ID and user ID parameters. Work
// detail currently exposes accountUserid, so the same identifier is supplied to
// both fields for compatibility with Redfox's documented-but-inconsistent API.
func (c *Client) QueryAccount(ctx context.Context, accountUserID string) (Account, error) {
	var out Account
	err := c.post(ctx, "/story/api/xhsUser/queryAccountDetail", map[string]string{
		"accountId": accountUserID,
		"userId":    accountUserID,
	}, &out)
	return out, err
}

func (c *Client) QuerySimilarAccounts(ctx context.Context, accountUserID string) (SimilarResult, error) {
	var out SimilarResult
	err := c.post(ctx, "/story/api/xhsUser/querySimilarAccounts", map[string]string{
		"redId":  accountUserID,
		"source": "婚纱内容生成平台",
	}, &out)
	return out, err
}

type response struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func (c *Client) post(ctx context.Context, path string, payload any, target any) error {
	if c.apiKey == "" {
		return newError(http.StatusServiceUnavailable, 0, "数据获取繁忙，请稍后再试。")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode Redfox request: %w", err)
	}
	requestCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, c.apiBaseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create Redfox request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("REDFOX_API_KEY", c.apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return newError(http.StatusBadGateway, 0, "小红书数据服务暂时不可用，请稍后重试。")
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return fmt.Errorf("read Redfox response: %w", err)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return newError(http.StatusBadGateway, resp.StatusCode, "小红书数据服务请求失败，请稍后重试。")
	}
	var envelope response
	if err := json.Unmarshal(data, &envelope); err != nil {
		return newError(http.StatusBadGateway, 0, "小红书数据服务返回异常。")
	}
	if envelope.Code != successCode {
		return newError(redfoxStatus(envelope.Code), envelope.Code, redfoxMessage(envelope.Code, envelope.Msg))
	}
	if len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		return newError(http.StatusNotFound, envelope.Code, "未查询到该小红书数据。")
	}
	if err := json.Unmarshal(envelope.Data, target); err != nil {
		return newError(http.StatusBadGateway, envelope.Code, "小红书数据服务返回格式异常。")
	}
	return nil
}

func redfoxStatus(code int) int {
	switch code {
	case 4004:
		return http.StatusTooManyRequests
	case 3201, 3202:
		return http.StatusServiceUnavailable
	case 3103, 3105, 401, 403:
		return http.StatusBadGateway
	default:
		return http.StatusBadGateway
	}
}

func redfoxMessage(code int, fallback string) string {
	switch code {
	case 4004:
		return "小红书数据服务请求过于频繁，请稍后再试。"
	case 3201, 3202:
		// 额度属于服务端配置，不能向普通用户暴露余额或密钥状态。
		return "数据获取繁忙，请稍后再试。"
	case 3103, 3105, 401, 403:
		return "小红书数据服务配置异常，请联系管理员。"
	case 1001, 1002, 1003:
		return "小红书笔记链接无效。"
	}
	if strings.TrimSpace(fallback) != "" {
		return "小红书数据服务暂时无法查询：" + strings.TrimSpace(fallback)
	}
	return "小红书数据服务暂时无法查询。"
}
