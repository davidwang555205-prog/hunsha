package channels

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/config"
)

// Usecase 模型线路业务层。
type Usecase struct {
	repo   *Repo
	cfg    *config.Config
	logger *slog.Logger
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	return &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		cfg:    do.MustInvoke[*config.Config](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "channels.usecase"),
	}, nil
}

// ChannelStats 模型线路统计（本轮未接入统计，预留字段）。
type ChannelStats struct {
	TotalRequests   int     `json:"totalRequests"`
	SuccessRequests int     `json:"successRequests"`
	FailedRequests  int     `json:"failedRequests"`
	SuccessRate     float64 `json:"successRate"`
	AvgLatencyMs    int     `json:"avgLatencyMs"`
}

// ChannelResp 对外线路，对应前端 Channel 类型（src/types/api.ts）。
type ChannelResp struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	APIBaseURL       string        `json:"apiBaseUrl"`
	Protocol         string        `json:"protocol"`
	ModelID          string        `json:"modelId"`
	SupportedSizes   []string      `json:"supportedSizes"`
	DefaultQuality   string        `json:"defaultQuality"`
	IsEnabled        bool          `json:"isEnabled"`
	IsDefault        bool          `json:"isDefault"`
	SortOrder        int           `json:"sortOrder"`
	MaxConcurrency   int           `json:"maxConcurrency"`   // 单次任务内并发段最大并发度（1=逐张串行）
	RequestTimeoutMs int           `json:"requestTimeoutMs"` // 单次上游请求超时；0=使用全局兼容值
	APIKey           string        `json:"apiKey,omitempty"`   // 仅 admin 列表返
	ProxyURL         string        `json:"proxyUrl,omitempty"` // 仅 admin 列表返；该线路前向代理，空=直连
	Stats            *ChannelStats `json:"stats,omitempty"`  // 本轮 nil
	CreatedAt        string        `json:"createdAt"`
	UpdatedAt        string        `json:"updatedAt"`
}

func sanitize(c ChannelRecord, includeAPIKey bool) ChannelResp {
	resp := ChannelResp{
		ID:               c.ID.String(),
		Name:             c.Name,
		APIBaseURL:       c.APIBaseURL,
		Protocol:         c.Protocol,
		ModelID:          c.ModelID,
		SupportedSizes:   c.SupportedSizes,
		DefaultQuality:   c.DefaultQuality,
		IsEnabled:        c.IsEnabled,
		IsDefault:        c.IsDefault,
		SortOrder:        c.SortOrder,
		MaxConcurrency:   c.MaxConcurrency,
		RequestTimeoutMs: c.RequestTimeoutMs,
		CreatedAt:        c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        c.UpdatedAt.Format(time.RFC3339),
	}
	if includeAPIKey {
		resp.APIKey = c.APIKey
		resp.ProxyURL = c.ProxyURL
	}
	if resp.SupportedSizes == nil {
		resp.SupportedSizes = []string{}
	}
	if resp.Protocol == "" {
		resp.Protocol = "openai"
	}
	// 稳定性统计：成功率=成功/总请求*100（整数百分比），平均耗时=总耗时/总请求
	stats := &ChannelStats{
		TotalRequests:   c.TotalRequests,
		SuccessRequests: c.SuccessRequests,
		FailedRequests:  c.FailedRequests,
	}
	if c.TotalRequests > 0 {
		stats.SuccessRate = float64(c.SuccessRequests * 100 / c.TotalRequests)
		stats.AvgLatencyMs = c.TotalLatencyMs / c.TotalRequests
	}
	resp.Stats = stats
	return resp
}

// ListAdmin 管理列表（含 apiKey）。
func (u *Usecase) ListAdmin(ctx context.Context) ([]ChannelResp, error) {
	recs, err := u.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ChannelResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r, true))
	}
	return out, nil
}

// ListPublic 公开列表（不含 apiKey）。
func (u *Usecase) ListPublic(ctx context.Context) ([]ChannelResp, error) {
	recs, err := u.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ChannelResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r, false))
	}
	return out, nil
}

// CreateReq 创建线路请求，对应前端 CreateChannelRequest。
type CreateReq struct {
	Name             string   `json:"name"`
	APIBaseURL       string   `json:"apiBaseUrl"`
	APIKey           string   `json:"apiKey"`
	Protocol         string   `json:"protocol,omitempty"`
	ModelID          string   `json:"modelId"`
	SupportedSizes   []string `json:"supportedSizes,omitempty"`
	DefaultQuality   string   `json:"defaultQuality,omitempty"`
	IsEnabled        *bool    `json:"isEnabled,omitempty"`
	IsDefault        *bool    `json:"isDefault,omitempty"`
	SortOrder        *int     `json:"sortOrder,omitempty"`
	MaxConcurrency   *int     `json:"maxConcurrency,omitempty"`
	RequestTimeoutMs *int     `json:"requestTimeoutMs,omitempty"`
	ProxyURL         *string  `json:"proxyUrl,omitempty"` // 前向代理地址；空/省略=直连
}

// Create 创建线路。
func (u *Usecase) Create(ctx context.Context, req CreateReq) (*ChannelResp, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("线路名称不能为空")
	}
	if req.APIBaseURL == "" || req.APIKey == "" {
		return nil, fmt.Errorf("API 基址和密钥不能为空")
	}
	if req.Protocol == "" {
		req.Protocol = "openai"
	}
	if req.ModelID == "" {
		req.ModelID = "gpt-image-2"
	}
	if req.DefaultQuality == "" {
		req.DefaultQuality = "medium"
	}
	enabled := true
	if req.IsEnabled != nil {
		enabled = *req.IsEnabled
	}
	isDefault := false
	if req.IsDefault != nil {
		isDefault = *req.IsDefault
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	maxConcurrency := clampConcurrency(req.MaxConcurrency)
	requestTimeoutMs, err := validateRequestTimeoutMs(req.RequestTimeoutMs)
	if err != nil {
		return nil, err
	}
	proxyURL, err := validateProxyURL(req.ProxyURL)
	if err != nil {
		return nil, err
	}
	if isDefault {
		if err := u.repo.ClearDefault(ctx); err != nil {
			return nil, err
		}
	}
	rec, err := u.repo.Create(ctx, CreateInput{
		Name:             req.Name,
		APIBaseURL:       req.APIBaseURL,
		APIKey:           req.APIKey,
		Protocol:         req.Protocol,
		ModelID:          req.ModelID,
		SupportedSizes:   req.SupportedSizes,
		DefaultQuality:   req.DefaultQuality,
		IsEnabled:        enabled,
		IsDefault:        isDefault,
		SortOrder:        sortOrder,
		MaxConcurrency:   maxConcurrency,
		RequestTimeoutMs: requestTimeoutMs,
		ProxyURL:         proxyURL,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec, true)
	return &resp, nil
}

// UpdateReq 更新线路请求，对应前端 UpdateChannelRequest。
type UpdateReq struct {
	Name             *string   `json:"name,omitempty"`
	APIBaseURL       *string   `json:"apiBaseUrl,omitempty"`
	APIKey           *string   `json:"apiKey,omitempty"`
	Protocol         *string   `json:"protocol,omitempty"`
	ModelID          *string   `json:"modelId,omitempty"`
	SupportedSizes   *[]string `json:"supportedSizes,omitempty"`
	DefaultQuality   *string   `json:"defaultQuality,omitempty"`
	IsEnabled        *bool     `json:"isEnabled,omitempty"`
	IsDefault        *bool     `json:"isDefault,omitempty"`
	SortOrder        *int      `json:"sortOrder,omitempty"`
	MaxConcurrency   *int      `json:"maxConcurrency,omitempty"`
	RequestTimeoutMs *int      `json:"requestTimeoutMs,omitempty"`
	ProxyURL         *string   `json:"proxyUrl,omitempty"`
}

// Update 更新线路。
func (u *Usecase) Update(ctx context.Context, id uuid.UUID, req UpdateReq) (*ChannelResp, error) {
	if req.IsDefault != nil && *req.IsDefault {
		if err := u.repo.ClearDefault(ctx); err != nil {
			return nil, err
		}
	}
	var maxConcurrency *int
	if req.MaxConcurrency != nil {
		v := clampConcurrency(req.MaxConcurrency)
		maxConcurrency = &v
	}
	var requestTimeoutMs *int
	if req.RequestTimeoutMs != nil {
		v, err := validateRequestTimeoutMs(req.RequestTimeoutMs)
		if err != nil {
			return nil, err
		}
		requestTimeoutMs = &v
	}
	var proxyURL *string
	if req.ProxyURL != nil {
		v, err := validateProxyURL(req.ProxyURL)
		if err != nil {
			return nil, err
		}
		proxyURL = &v
	}
	rec, err := u.repo.Update(ctx, id, UpdateInput{
		Name:             req.Name,
		APIBaseURL:       req.APIBaseURL,
		APIKey:           req.APIKey,
		Protocol:         req.Protocol,
		ModelID:          req.ModelID,
		SupportedSizes:   req.SupportedSizes,
		DefaultQuality:   req.DefaultQuality,
		IsEnabled:        req.IsEnabled,
		IsDefault:        req.IsDefault,
		SortOrder:        req.SortOrder,
		MaxConcurrency:   maxConcurrency,
		RequestTimeoutMs: requestTimeoutMs,
		ProxyURL:         proxyURL,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec, true)
	return &resp, nil
}

// Delete 删除线路。
func (u *Usecase) Delete(ctx context.Context, id uuid.UUID) error {
	return u.repo.Delete(ctx, id)
}

// GetDefaultConfig 返回默认线路记录（给 generation 模块按 channel 生图用）。无默认则 nil。
func (u *Usecase) GetDefaultConfig(ctx context.Context) (*ChannelRecord, error) {
	return u.repo.GetDefault(ctx)
}

// GetConfigByID 按 id 取线路记录（给 generation 按 channel 生图用）。无则 nil。
func (u *Usecase) GetConfigByID(ctx context.Context, id uuid.UUID) (*ChannelRecord, error) {
	return u.repo.GetByID(ctx, id)
}

// ListEnabledConfigs 取所有启用线路记录（按 sort_order 排序），给 generation 构建优先级 fallback 候选链用。
func (u *Usecase) ListEnabledConfigs(ctx context.Context) ([]ChannelRecord, error) {
	return u.repo.ListEnabled(ctx)
}

// IncStats 累加线路稳定性统计（generation.runTask 每张图调用 wala 后调）。失败仅记日志不阻塞生图。
func (u *Usecase) IncStats(ctx context.Context, channelID uuid.UUID, success bool, latencyMs int) {
	if err := u.repo.IncStats(ctx, channelID, success, latencyMs); err != nil {
		u.logger.WarnContext(ctx, "inc channel stats failed", "channel", channelID, "error", err)
	}
}

// SeedDefault 启动时插默认线路（值取自 .env）。失败不阻塞启动。
func (u *Usecase) SeedDefault(ctx context.Context) error {
	if err := u.repo.SeedDefault(ctx, u.cfg.Bridal.WalaAPIBaseURL, u.cfg.Bridal.WalaAPIKey, u.cfg.Bridal.WalaImageModel); err != nil {
		u.logger.ErrorContext(ctx, "seed default channel failed", "error", err)
		return nil
	}
	return nil
}

// clampConcurrency 线路并发度归一化到 [1, 10]：nil/<1 默认 1（逐张串行），>10 置 10。
// 控制单次生图任务内并发段的最大并发度，防误填大数压垮中转 API。
func clampConcurrency(v *int) int {
	n := 1
	if v != nil && *v > 1 {
		n = *v
	}
	if n > 10 {
		n = 10
	}
	return n
}

// validateRequestTimeoutMs 校验单次上游请求超时。0 表示兼容继承全局值；其余限制在 30-600 秒，
// 避免管理员误填过短导致稳定失败，或无限等待耗尽任务槽位。
func validateRequestTimeoutMs(v *int) (int, error) {
	if v == nil || *v == 0 {
		return 0, nil
	}
	if *v < 30_000 || *v > 600_000 {
		return 0, fmt.Errorf("单次请求超时需为 0，或 30000-600000 毫秒")
	}
	return *v, nil
}

// validateProxyURL 校验线路前向代理地址。nil/空 = 直连；非空必须是 http(s):// 或
// socks5(h):// 的合法 URL（Go http.Transport.Proxy 支持的形态），防误填导致整线路上游失败。
func validateProxyURL(v *string) (string, error) {
	if v == nil {
		return "", nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return "", nil
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return "", fmt.Errorf("代理地址格式无效，示例 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080")
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https", "socks5", "socks5h":
	default:
		return "", fmt.Errorf("代理协议仅支持 http/https/socks5/socks5h")
	}
	return s, nil
}
