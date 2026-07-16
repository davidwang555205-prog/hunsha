package channels

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/modelchannel"
)

// Repo 模型线路仓储，操作 ent model_channels 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "channels.repo"),
	}, nil
}

// ChannelRecord 模型线路记录，对应前端 Channel 类型。
type ChannelRecord struct {
	ID             uuid.UUID
	Name           string
	APIBaseURL     string
	APIKey         string
	Protocol       string
	ModelID        string
	SupportedSizes []string
	DefaultQuality string
	IsEnabled      bool
	IsDefault      bool
	SortOrder      int
	MaxConcurrency int
	// 稳定性统计（累计，原子累加）
	TotalRequests   int
	SuccessRequests int
	FailedRequests  int
	TotalLatencyMs  int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func toRecord(c *db.ModelChannel) ChannelRecord {
	return ChannelRecord{
		ID:              c.ID,
		Name:            c.Name,
		APIBaseURL:      c.APIBaseURL,
		APIKey:          c.APIKey,
		Protocol:        c.Protocol,
		ModelID:         c.ModelID,
		SupportedSizes:  c.SupportedSizes,
		DefaultQuality:  c.DefaultQuality,
		IsEnabled:       c.IsEnabled,
		IsDefault:       c.IsDefault,
		SortOrder:       c.SortOrder,
		MaxConcurrency:  c.MaxConcurrency,
		TotalRequests:   c.TotalRequests,
		SuccessRequests: c.SuccessRequests,
		FailedRequests:  c.FailedRequests,
		TotalLatencyMs:  c.TotalLatencyMs,
		CreatedAt:       c.CreatedAt,
		UpdatedAt:       c.UpdatedAt,
	}
}

// ListAll 管理列表（含 apiKey），按 sort_order。
func (r *Repo) ListAll(ctx context.Context) ([]ChannelRecord, error) {
	cs, err := r.db.ModelChannel.Query().
		Order(db.Asc(modelchannel.FieldSortOrder), db.Asc(modelchannel.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ChannelRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// ListEnabled 公开列表（仅启用的），按 sort_order。
func (r *Repo) ListEnabled(ctx context.Context) ([]ChannelRecord, error) {
	cs, err := r.db.ModelChannel.Query().
		Where(modelchannel.IsEnabledEQ(true)).
		Order(db.Asc(modelchannel.FieldSortOrder), db.Asc(modelchannel.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ChannelRecord, 0, len(cs))
	for _, c := range cs {
		out = append(out, toRecord(c))
	}
	return out, nil
}

// GetByID 取单条。
func (r *Repo) GetByID(ctx context.Context, id uuid.UUID) (*ChannelRecord, error) {
	c, err := r.db.ModelChannel.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// GetDefault 取默认线路（is_default=true 且启用）。无则返回 nil。
func (r *Repo) GetDefault(ctx context.Context) (*ChannelRecord, error) {
	cs, err := r.db.ModelChannel.Query().
		Where(modelchannel.IsDefaultEQ(true), modelchannel.IsEnabledEQ(true)).
		Limit(1).
		All(ctx)
	if err != nil {
		return nil, err
	}
	if len(cs) == 0 {
		return nil, nil
	}
	rec := toRecord(cs[0])
	return &rec, nil
}

// CreateInput 创建线路入参。
type CreateInput struct {
	Name           string
	APIBaseURL     string
	APIKey         string
	Protocol       string
	ModelID        string
	SupportedSizes []string
	DefaultQuality string
	IsEnabled      bool
	IsDefault      bool
	SortOrder      int
	MaxConcurrency int
}

func (r *Repo) Create(ctx context.Context, in CreateInput) (*ChannelRecord, error) {
	if in.SupportedSizes == nil {
		in.SupportedSizes = []string{}
	}
	if in.DefaultQuality == "" {
		in.DefaultQuality = "medium"
	}
	if in.Protocol == "" {
		in.Protocol = "openai"
	}
	c, err := r.db.ModelChannel.Create().
		SetName(in.Name).
		SetAPIBaseURL(in.APIBaseURL).
		SetAPIKey(in.APIKey).
		SetProtocol(in.Protocol).
		SetModelID(in.ModelID).
		SetSupportedSizes(in.SupportedSizes).
		SetDefaultQuality(in.DefaultQuality).
		SetIsEnabled(in.IsEnabled).
		SetIsDefault(in.IsDefault).
		SetSortOrder(in.SortOrder).
		SetMaxConcurrency(in.MaxConcurrency).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// UpdateInput 更新线路入参（指针 nil 表示不改）。
type UpdateInput struct {
	Name           *string
	APIBaseURL     *string
	APIKey         *string
	Protocol       *string
	ModelID        *string
	SupportedSizes *[]string
	DefaultQuality *string
	IsEnabled      *bool
	IsDefault      *bool
	SortOrder      *int
	MaxConcurrency *int
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*ChannelRecord, error) {
	q := r.db.ModelChannel.UpdateOneID(id)
	if in.Name != nil {
		q = q.SetName(*in.Name)
	}
	if in.APIBaseURL != nil {
		q = q.SetAPIBaseURL(*in.APIBaseURL)
	}
	if in.APIKey != nil {
		q = q.SetAPIKey(*in.APIKey)
	}
	if in.Protocol != nil {
		q = q.SetProtocol(*in.Protocol)
	}
	if in.ModelID != nil {
		q = q.SetModelID(*in.ModelID)
	}
	if in.SupportedSizes != nil {
		q = q.SetSupportedSizes(*in.SupportedSizes)
	}
	if in.DefaultQuality != nil {
		q = q.SetDefaultQuality(*in.DefaultQuality)
	}
	if in.IsEnabled != nil {
		q = q.SetIsEnabled(*in.IsEnabled)
	}
	if in.IsDefault != nil {
		q = q.SetIsDefault(*in.IsDefault)
	}
	if in.SortOrder != nil {
		q = q.SetSortOrder(*in.SortOrder)
	}
	if in.MaxConcurrency != nil {
		q = q.SetMaxConcurrency(*in.MaxConcurrency)
	}
	c, err := q.Save(ctx)
	if err != nil {
		return nil, err
	}
	rec := toRecord(c)
	return &rec, nil
}

// Delete 删除线路。
func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.ModelChannel.DeleteOneID(id).Exec(ctx)
}

// ClearDefault 清除所有线路的 is_default（设新默认前调用）。
func (r *Repo) ClearDefault(ctx context.Context) error {
	_, err := r.db.ModelChannel.Update().
		Where(modelchannel.IsDefaultEQ(true)).
		SetIsDefault(false).
		Save(ctx)
	return err
}

// IncStats 原子累加线路稳定性统计（runTask 每张图调用 wala 后调）。
// success=true 计成功次数，false 计失败次数；latencyMs 累加到总耗时。用 ent Add* 原子 SET x=x+n。
func (r *Repo) IncStats(ctx context.Context, id uuid.UUID, success bool, latencyMs int) error {
	q := r.db.ModelChannel.UpdateOneID(id).
		AddTotalRequests(1).
		AddTotalLatencyMs(latencyMs)
	if success {
		q = q.AddSuccessRequests(1)
	} else {
		q = q.AddFailedRequests(1)
	}
	_, err := q.Save(ctx)
	return err
}

// SeedDefault 启动时若无任何线路，插一条默认（值取自 .env/config）。
func (r *Repo) SeedDefault(ctx context.Context, apiBaseURL, apiKey, modelID string) error {
	count, err := r.db.ModelChannel.Query().Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	if modelID == "" {
		modelID = "gpt-image-2"
	}
	_, err = r.db.ModelChannel.Create().
		SetName("WalaAPI 默认").
		SetAPIBaseURL(apiBaseURL).
		SetAPIKey(apiKey).
		SetProtocol("openai").
		SetModelID(modelID).
		SetDefaultQuality("medium").
		SetIsEnabled(true).
		SetIsDefault(true).
		SetSortOrder(0).
		Save(ctx)
	return err
}
