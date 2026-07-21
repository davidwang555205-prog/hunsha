package customerservice

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"
)

// Usecase 客服信息业务层。
type Usecase struct {
	repo   *Repo
	logger *slog.Logger
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	return &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "customerservice.usecase"),
	}, nil
}

// CustomerServiceResp 对外客服信息，对应前端 CustomerService 类型（src/types/api.ts）。
type CustomerServiceResp struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Phone     string `json:"phone"`
	WechatID  string `json:"wechatId"`
	QrcodeURL string `json:"qrcodeUrl"`
	SortOrder int    `json:"sortOrder"`
	IsEnabled bool   `json:"isEnabled"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func sanitize(c CustomerServiceRecord) CustomerServiceResp {
	return CustomerServiceResp{
		ID:        c.ID.String(),
		Nickname:  c.Nickname,
		Phone:     c.Phone,
		WechatID:  c.WechatID,
		QrcodeURL: c.QrcodeURL,
		SortOrder: c.SortOrder,
		IsEnabled: c.IsEnabled,
		CreatedAt: c.CreatedAt.Format(time.RFC3339),
		UpdatedAt: c.UpdatedAt.Format(time.RFC3339),
	}
}

// ListAdmin 管理列表（含禁用）。
func (u *Usecase) ListAdmin(ctx context.Context) ([]CustomerServiceResp, error) {
	recs, err := u.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CustomerServiceResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// ListPublic 公开列表（仅生效），按 sort_order。顶栏客服入口用。
func (u *Usecase) ListPublic(ctx context.Context) ([]CustomerServiceResp, error) {
	recs, err := u.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CustomerServiceResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// CreateReq 创建客服请求，对应前端 CustomerServiceCreateRequest。
type CreateReq struct {
	Nickname  string `json:"nickname"`
	Phone     string `json:"phone,omitempty"`
	WechatID  string `json:"wechatId,omitempty"`
	QrcodeURL string `json:"qrcodeUrl,omitempty"`
	SortOrder *int   `json:"sortOrder,omitempty"`
	IsEnabled *bool  `json:"isEnabled,omitempty"`
}

// Create 创建客服。
func (u *Usecase) Create(ctx context.Context, req CreateReq) (*CustomerServiceResp, error) {
	if req.Nickname == "" {
		return nil, fmt.Errorf("客服昵称不能为空")
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
		Nickname:  req.Nickname,
		Phone:     req.Phone,
		WechatID:  req.WechatID,
		QrcodeURL: req.QrcodeURL,
		SortOrder: sortOrder,
		IsEnabled: enabled,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// UpdateReq 更新客服请求，对应前端 CustomerServiceUpdateRequest。
type UpdateReq struct {
	Nickname  *string `json:"nickname,omitempty"`
	Phone     *string `json:"phone,omitempty"`
	WechatID  *string `json:"wechatId,omitempty"`
	QrcodeURL *string `json:"qrcodeUrl,omitempty"`
	SortOrder *int    `json:"sortOrder,omitempty"`
	IsEnabled *bool   `json:"isEnabled,omitempty"`
}

// Update 更新客服。
func (u *Usecase) Update(ctx context.Context, id uuid.UUID, req UpdateReq) (*CustomerServiceResp, error) {
	rec, err := u.repo.Update(ctx, id, UpdateInput{
		Nickname:  req.Nickname,
		Phone:     req.Phone,
		WechatID:  req.WechatID,
		QrcodeURL: req.QrcodeURL,
		SortOrder: req.SortOrder,
		IsEnabled: req.IsEnabled,
	})
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// Delete 删除客服。
func (u *Usecase) Delete(ctx context.Context, id uuid.UUID) error {
	return u.repo.Delete(ctx, id)
}
