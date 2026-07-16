package syssetting

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/samber/do"
)

// Usecase 系统设置业务层。
type Usecase struct {
	repo   *Repo
	logger *slog.Logger
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	return &Usecase{
		repo:   do.MustInvoke[*Repo](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "syssetting.usecase"),
	}, nil
}

// SettingResp 对外设置。
type SettingResp struct {
	Key       string         `json:"key"`
	Value     map[string]any `json:"value"`
	UpdatedAt string         `json:"updatedAt"`
}

func sanitize(s SettingRecord) SettingResp {
	resp := SettingResp{
		Key:       s.Key,
		Value:     s.Value,
		UpdatedAt: s.UpdatedAt.Format(time.RFC3339),
	}
	if resp.Value == nil {
		resp.Value = map[string]any{}
	}
	return resp
}

// GetAll 管理列表。
func (u *Usecase) GetAll(ctx context.Context) ([]SettingResp, error) {
	recs, err := u.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]SettingResp, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}

// GetRetentionDays 数据保留天数。读 retention_days 设置，缺省/异常回退 defaultDays。
// 供 bridalauth.Summary 注入调用，避免直接暴露 repo。
func (u *Usecase) GetRetentionDays(ctx context.Context, defaultDays int) int {
	rec, err := u.repo.Get(ctx, "retention_days")
	if err != nil || rec == nil {
		return defaultDays
	}
	// JSON 数字反序列化为 float64
	days, ok := rec.Value["days"].(float64)
	if !ok || days <= 0 {
		return defaultDays
	}
	return int(days)
}

// UpdateReq 更新设置请求。
type UpdateReq struct {
	Value map[string]any `json:"value"`
}

// Update 更新单个设置。
func (u *Usecase) Update(ctx context.Context, key string, req UpdateReq) (*SettingResp, error) {
	if key == "" {
		return nil, fmt.Errorf("设置键不能为空")
	}
	rec, err := u.repo.Upsert(ctx, key, req.Value)
	if err != nil {
		return nil, err
	}
	resp := sanitize(*rec)
	return &resp, nil
}

// SetRetentionDays 便捷方法：设置数据保留天数。
func (u *Usecase) SetRetentionDays(ctx context.Context, days int) error {
	if days <= 0 {
		return fmt.Errorf("保留天数必须大于 0")
	}
	_, err := u.repo.Upsert(ctx, "retention_days", map[string]any{"days": days})
	return err
}
