package categories

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"
)

// Usecase 内容类目业务层。
type Usecase struct {
	repo   *Repo
	logger *slog.Logger
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	return &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "categories.usecase"),
	}, nil
}

// CategoryResp 对外类目，对应前端 Category 类型（src/types/api.ts）。
type CategoryResp struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Icon        string         `json:"icon"`
	Engine      string         `json:"engine"`
	Description string         `json:"description"`
	SortOrder   int            `json:"sortOrder"`
	IsEnabled   bool           `json:"isEnabled"`
	Config      map[string]any `json:"config"`
	CreatedAt   string         `json:"createdAt"`
	UpdatedAt   string         `json:"updatedAt"`
}

func sanitize(c CategoryRecord) CategoryResp {
	resp := CategoryResp{
		ID:          c.ID.String(),
		Name:        c.Name,
		Icon:        c.Icon,
		Engine:      c.Engine,
		Description: c.Description,
		SortOrder:   c.SortOrder,
		IsEnabled:   c.IsEnabled,
		Config:      c.Config,
		CreatedAt:   c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   c.UpdatedAt.Format(time.RFC3339),
	}
	if resp.Config == nil {
		resp.Config = map[string]any{}
	}
	return resp
}

// ListAdmin 管理列表（含禁用）。
func (u *Usecase) ListAdmin(ctx context.Context) ([]CategoryResp, error) {
	recs, err := u.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// ListPublic 公开列表（仅启用）。
func (u *Usecase) ListPublic(ctx context.Context) ([]CategoryResp, error) {
	recs, err := u.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// CreateReq 创建类目请求，对应前端 CreateCategoryRequest。
type CreateReq struct {
	Name        string         `json:"name"`
	Icon        string         `json:"icon,omitempty"`
	Engine      string         `json:"engine"`
	Description string         `json:"description,omitempty"`
	SortOrder   *int           `json:"sortOrder,omitempty"`
	IsEnabled   *bool          `json:"isEnabled,omitempty"`
	Config      map[string]any `json:"config,omitempty"`
}

// Create 创建类目。
func (u *Usecase) Create(ctx context.Context, req CreateReq) (*CategoryResp, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("类目名称不能为空")
	}
	if req.Engine == "" {
		req.Engine = "bridal"
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
		Name:        req.Name,
		Icon:        req.Icon,
		Engine:      req.Engine,
		Description: req.Description,
		SortOrder:   sortOrder,
		IsEnabled:   enabled,
		Config:      req.Config,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// UpdateReq 更新类目请求，对应前端 UpdateCategoryRequest。
type UpdateReq struct {
	Name        *string         `json:"name,omitempty"`
	Icon        *string         `json:"icon,omitempty"`
	Engine      *string         `json:"engine,omitempty"`
	Description *string         `json:"description,omitempty"`
	SortOrder   *int            `json:"sortOrder,omitempty"`
	IsEnabled   *bool           `json:"isEnabled,omitempty"`
	Config      *map[string]any `json:"config,omitempty"`
}

// Update 更新类目。
func (u *Usecase) Update(ctx context.Context, id uuid.UUID, req UpdateReq) (*CategoryResp, error) {
	rec, err := u.repo.Update(ctx, id, UpdateInput{
		Name:        req.Name,
		Icon:        req.Icon,
		Engine:      req.Engine,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		IsEnabled:   req.IsEnabled,
		Config:      req.Config,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// Delete 删除类目。
func (u *Usecase) Delete(ctx context.Context, id uuid.UUID) error {
	return u.repo.Delete(ctx, id)
}

// SeedDefault 启动时插"婚纱"类目。失败不阻塞启动。
func (u *Usecase) SeedDefault(ctx context.Context) error {
	if err := u.repo.SeedDefault(ctx); err != nil {
		u.logger.ErrorContext(ctx, "seed default category failed", "error", err)
		return nil
	}
	return nil
}
