package engines

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/biz/engines/seeding"
	"bridal/backend/biz/generation/prompt"
)

// Usecase 内容引擎业务层。
type Usecase struct {
	repo   *Repo
	logger *slog.Logger
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	return &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "engines.usecase"),
	}, nil
}

// EngineResp 对外内容引擎，对应前端 ContentEngine 类型。
type EngineResp struct {
	ID          string         `json:"id"`
	Key         string         `json:"key"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Config      map[string]any `json:"config"`
	IsEnabled   bool           `json:"isEnabled"`
	SortOrder   int            `json:"sortOrder"`
	CreatedAt   string         `json:"createdAt"`
	UpdatedAt   string         `json:"updatedAt"`
}

func sanitize(e EngineRecord) EngineResp {
	resp := EngineResp{
		ID:          e.ID.String(),
		Key:         e.Key,
		Name:        e.Name,
		Description: e.Description,
		Config:      e.Config,
		IsEnabled:   e.IsEnabled,
		SortOrder:   e.SortOrder,
		CreatedAt:   e.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   e.UpdatedAt.Format(time.RFC3339),
	}
	if resp.Config == nil {
		resp.Config = map[string]any{}
	}
	return resp
}

// ListAdmin 管理列表（含禁用）。
func (u *Usecase) ListAdmin(ctx context.Context) ([]EngineResp, error) {
	recs, err := u.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]EngineResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// ListPublic 公开列表（仅启用，含 config 供前端运行时拉取覆盖代码默认素材）。
func (u *Usecase) ListPublic(ctx context.Context) ([]EngineResp, error) {
	recs, err := u.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]EngineResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// CreateReq 创建引擎请求，对应前端 CreateEngineRequest。
type CreateReq struct {
	Key         string         `json:"key"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Config      map[string]any `json:"config,omitempty"`
	IsEnabled   *bool          `json:"isEnabled,omitempty"`
	SortOrder   *int           `json:"sortOrder,omitempty"`
}

// Create 创建引擎。
func (u *Usecase) Create(ctx context.Context, req CreateReq) (*EngineResp, error) {
	if req.Key == "" {
		return nil, fmt.Errorf("引擎标识不能为空")
	}
	if req.Name == "" {
		return nil, fmt.Errorf("引擎名称不能为空")
	}
	if err := validateEngineConfig(req.Config); err != nil {
		return nil, err
	}
	enabled := true
	if req.IsEnabled != nil {
		enabled = *req.IsEnabled
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	rec, err := u.repo.Create(ctx, CreateInput{
		Key:         req.Key,
		Name:        req.Name,
		Description: req.Description,
		Config:      req.Config,
		IsEnabled:   enabled,
		SortOrder:   sortOrder,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// UpdateReq 更新引擎请求，对应前端 UpdateEngineRequest。
type UpdateReq struct {
	Key         *string         `json:"key,omitempty"`
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Config      *map[string]any `json:"config,omitempty"`
	IsEnabled   *bool           `json:"isEnabled,omitempty"`
	SortOrder   *int            `json:"sortOrder,omitempty"`
}

// Update 更新引擎。
func (u *Usecase) Update(ctx context.Context, id uuid.UUID, req UpdateReq) (*EngineResp, error) {
	if req.Config != nil {
		if err := validateEngineConfig(*req.Config); err != nil {
			return nil, err
		}
	}
	rec, err := u.repo.Update(ctx, id, UpdateInput{
		Key:         req.Key,
		Name:        req.Name,
		Description: req.Description,
		Config:      req.Config,
		IsEnabled:   req.IsEnabled,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// Delete 删除引擎。
func (u *Usecase) Delete(ctx context.Context, id uuid.UUID) error {
	return u.repo.Delete(ctx, id)
}

// SeedDefault 启动时插默认婚纱引擎。失败不阻塞启动。
func (u *Usecase) SeedDefault(ctx context.Context) error {
	if err := u.repo.SeedDefault(ctx); err != nil {
		u.logger.ErrorContext(ctx, "seed default engine failed", "error", err)
		return nil
	}
	return nil
}

// GetByKey 按 key 取引擎（含禁用，供内部拉取配置；调用方按需检查 IsEnabled）。
func (u *Usecase) GetByKey(ctx context.Context, key string) (*EngineResp, error) {
	rec, err := u.repo.GetByKey(ctx, key)
	if err != nil {
		return nil, err
	}
	if rec == nil {
		return nil, nil
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// CopyEnabled 返回引擎是否要求生成标题、正文和标签。存量引擎始终兼容为 true。
func (u *Usecase) CopyEnabled(ctx context.Context, key string) (bool, error) {
	rec, err := u.repo.GetByKey(ctx, key)
	if err != nil {
		return false, err
	}
	if rec == nil || !rec.IsEnabled {
		return false, fmt.Errorf("内容引擎 %q 不可用", key)
	}
	return ResolveCapabilities(rec.Config).CopyEnabled, nil
}

// Generate 按 key 生成内容（任务②阶段4）。读 engine.config 用 MergeAssets 覆盖默认素材，
// date 用 +08:00 now（与前端 new Date() 在 +08:00 一致）。引擎不存在/禁用则用代码默认素材。
func (u *Usecase) Generate(ctx context.Context, key string, input seeding.FashionSeedingInput) (*seeding.FashionSeedingContent, error) {
	rec, err := u.repo.GetByKey(ctx, key)
	if err != nil {
		u.logger.ErrorContext(ctx, "get engine for generate failed", "key", key, "error", err)
	}
	var config map[string]any
	if rec != nil && rec.IsEnabled {
		config = rec.Config
	}
	runtimeConfig, _, err := ResolveRuntimeConfig(config)
	if err != nil {
		return nil, err
	}
	assets := seeding.MergeAssets(nil, runtimeConfig)
	if input.Topic != "" && !containsTopic(seeding.GetConfiguredTopicOptions(input.ProductCategory, assets), input.Topic) {
		return nil, fmt.Errorf("主题 %q 不在当前内容引擎主题列表中", input.Topic)
	}
	if input.Date.IsZero() {
		input.Date = time.Now().In(seeding.ChinaFixedZone())
	}
	copyEnabled := ResolveCapabilities(config).CopyEnabled
	var content seeding.FashionSeedingContent
	if copyEnabled {
		content = seeding.GenerateFashionSeedingContent(input, assets)
	} else {
		content = seeding.GenerateFashionSeedingImagesOnly(input, assets)
	}
	return &content, nil
}

func validateEngineConfig(config map[string]any) error {
	runtimeConfig, _, err := ResolveRuntimeConfig(config)
	if err != nil {
		return err
	}
	if err := ValidateConfig(config); err != nil {
		return err
	}
	return seeding.ValidateTopicVisibilityConfig(runtimeConfig)
}

func containsTopic(topics []string, topic string) bool {
	for _, candidate := range topics {
		if candidate == topic {
			return true
		}
	}
	return false
}

// DefaultAssets 返回代码默认素材（供编辑弹窗显示当前生效值，与 engine.config.seeding 合并）。
func (u *Usecase) DefaultAssets() (map[string]any, error) {
	bytes, err := json.Marshal(seeding.DefaultAssets())
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(bytes, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// PromptOptions 返回当前生效的 imagePrompt 素材（MergeAssets 合并 config.imagePrompt 与代码默认），
// 供前端 UI 拉取选项（款式/场景/模特/季节/光线/关键词档案/兼容映射的 key 集合）。
// 引擎不存在/禁用/无配置均降级为代码默认素材，永不报错。
func (u *Usecase) PromptOptions(ctx context.Context, key string) (*prompt.Assets, error) {
	rec, err := u.repo.GetByKey(ctx, key)
	if err != nil {
		return nil, err
	}
	var config map[string]any
	if rec != nil && rec.IsEnabled {
		config = rec.Config
	}
	runtimeConfig, _, err := ResolveRuntimeConfig(config)
	if err != nil {
		return nil, err
	}
	return prompt.MergeAssets(prompt.ParseAssetsFromConfig(runtimeConfig)), nil
}

// TopicOptions 返回当前引擎 JSON 配置的工作台主题列表。
func (u *Usecase) TopicOptions(ctx context.Context, key, productCategory string) ([]string, error) {
	rec, err := u.repo.GetByKey(ctx, key)
	if err != nil {
		return nil, err
	}
	var config map[string]any
	if rec != nil && rec.IsEnabled {
		config = rec.Config
	}
	runtimeConfig, _, err := ResolveRuntimeConfig(config)
	if err != nil {
		return nil, err
	}
	return seeding.GetConfiguredTopicOptions(productCategory, seeding.MergeAssets(nil, runtimeConfig)), nil
}
