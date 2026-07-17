package syssetting

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"bridal/backend/config"
	"github.com/samber/do"
)

const RedfoxAPISettingKey = "redfox_api"

// Usecase 系统设置业务层。
type Usecase struct {
	repo      *Repo
	logger    *slog.Logger
	keyCipher redfoxKeyCipher
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	cfg := do.MustInvoke[*config.Config](i)
	return &Usecase{
		repo:      do.MustInvoke[*Repo](i),
		logger:    do.MustInvoke[*slog.Logger](i).With("module", "syssetting.usecase"),
		keyCipher: newRedfoxKeyCipher(cfg.Bridal.SessionSecret),
	}, nil
}

// SettingResp 对外设置。
type SettingResp struct {
	Key       string         `json:"key"`
	Value     map[string]any `json:"value"`
	UpdatedAt string         `json:"updatedAt"`
}

func (u *Usecase) sanitize(s SettingRecord) SettingResp {
	resp := SettingResp{
		Key:       s.Key,
		Value:     s.Value,
		UpdatedAt: s.UpdatedAt.Format(time.RFC3339),
	}
	if resp.Value == nil {
		resp.Value = map[string]any{}
	}
	if s.Key == RedfoxAPISettingKey {
		// Never let GET /api/admin/settings return a provider credential.
		resp.Value = u.redfoxPublicValue(s.Value)
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
		out = append(out, u.sanitize(r))
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
	key = strings.TrimSpace(key)
	if key == "" {
		return nil, fmt.Errorf("设置键不能为空")
	}
	value := req.Value
	if key == RedfoxAPISettingKey {
		apiKey, _ := req.Value["apiKey"].(string)
		apiKey = strings.TrimSpace(apiKey)
		if apiKey == "" {
			return nil, fmt.Errorf("请填写 Redfox API Key")
		}
		sealed, err := u.keyCipher.seal(apiKey)
		if err != nil {
			return nil, fmt.Errorf("加密 Redfox API Key 失败: %w", err)
		}
		value = map[string]any{redfoxEncryptedAPIKeyField: sealed}
	}
	rec, err := u.repo.Upsert(ctx, key, value)
	if err != nil {
		return nil, err
	}
	resp := u.sanitize(*rec)
	return &resp, nil
}

// GetRedfoxAPIKey is intentionally backend-only. The matching admin API
// returns only configuration state and a mask, never this plaintext key.
func (u *Usecase) GetRedfoxAPIKey(ctx context.Context) (string, error) {
	rec, err := u.repo.Get(ctx, RedfoxAPISettingKey)
	if err != nil || rec == nil {
		return "", err
	}
	if encrypted, _ := rec.Value[redfoxEncryptedAPIKeyField].(string); strings.TrimSpace(encrypted) != "" {
		return u.keyCipher.open(encrypted)
	}
	// Compatibility with a short-lived early implementation. On the next
	// administrator save it is replaced by the encrypted representation.
	apiKey, _ := rec.Value["apiKey"].(string)
	return strings.TrimSpace(apiKey), nil
}

func (u *Usecase) redfoxPublicValue(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{"configured": false}
	}
	apiKey := ""
	if encrypted, _ := value[redfoxEncryptedAPIKeyField].(string); strings.TrimSpace(encrypted) != "" {
		apiKey, _ = u.keyCipher.open(encrypted)
	} else {
		apiKey, _ = value["apiKey"].(string)
	}
	if strings.TrimSpace(apiKey) == "" {
		return map[string]any{"configured": true, "maskedKey": "已配置，需重新设置"}
	}
	return map[string]any{"configured": true, "maskedKey": maskRedfoxAPIKey(apiKey)}
}

// SetRetentionDays 便捷方法：设置数据保留天数。
func (u *Usecase) SetRetentionDays(ctx context.Context, days int) error {
	if days <= 0 {
		return fmt.Errorf("保留天数必须大于 0")
	}
	_, err := u.repo.Upsert(ctx, "retention_days", map[string]any{"days": days})
	return err
}
