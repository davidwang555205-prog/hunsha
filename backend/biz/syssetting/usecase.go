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
	repo       *Repo
	logger     *slog.Logger
	cfg        *config.Config
	keyCipher  redfoxKeyCipher
	smsCipher  redfoxKeyCipher
	smtpCipher redfoxKeyCipher
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	cfg := do.MustInvoke[*config.Config](i)
	return &Usecase{
		repo:       do.MustInvoke[*Repo](i),
		logger:     do.MustInvoke[*slog.Logger](i).With("module", "syssetting.usecase"),
		cfg:        cfg,
		keyCipher:  newRedfoxKeyCipher(cfg.Bridal.SessionSecret),
		smsCipher:  newSmsKeyCipher(cfg.Bridal.SessionSecret),
		smtpCipher: newSmtpKeyCipher(cfg.Bridal.SessionSecret),
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

// ===== 短信服务配置（腾讯云，admin 前端配置，SecretKey 加密存 system_settings） =====

// SMSConfigReq 更新短信配置请求（SecretKey 空=保留原值，不覆盖）。
type SMSConfigReq struct {
	Enabled         bool   `json:"enabled"`
	SecretID        string `json:"secret_id"`
	SecretKey       string `json:"secret_key"`
	AppID           string `json:"app_id"`
	SignName        string `json:"sign_name"`
	TemplateID      string `json:"template_id"`
	Region          string `json:"region"`
	CodeExpireMin   int    `json:"code_expire_min"`
	SendIntervalSec int    `json:"send_interval_sec"`
	DailyLimit      int    `json:"daily_limit"`
}

// SMSConfigPublic 短信配置脱敏视图（admin GET 返回，SecretKey 脱敏）。
type SMSConfigPublic struct {
	Enabled         bool   `json:"enabled"`
	SecretID        string `json:"secret_id"`
	MaskedSecretKey string `json:"masked_secret_key"`
	Configured      bool   `json:"configured"`
	AppID           string `json:"app_id"`
	SignName        string `json:"sign_name"`
	TemplateID      string `json:"template_id"`
	Region          string `json:"region"`
	CodeExpireMin   int    `json:"code_expire_min"`
	SendIntervalSec int    `json:"send_interval_sec"`
	DailyLimit      int    `json:"daily_limit"`
}

// GetSMSConfig 读短信配置（后端发短信用，含解密 SecretKey）。未配置则回退 config.Bridal.SMS 默认。
func (u *Usecase) GetSMSConfig(ctx context.Context) (config.SMSConfig, error) {
	rec, err := u.repo.Get(ctx, smsSettingKey)
	if err != nil {
		return u.cfg.Bridal.SMS, err
	}
	if rec == nil {
		return u.cfg.Bridal.SMS, nil
	}
	return u.smsConfigFromValue(rec.Value), nil
}

// GetSMSConfigPublic 读短信配置脱敏视图（admin GET）。
func (u *Usecase) GetSMSConfigPublic(ctx context.Context) (SMSConfigPublic, error) {
	rec, err := u.repo.Get(ctx, smsSettingKey)
	if err != nil || rec == nil {
		return u.smsPublicFromConfig(u.cfg.Bridal.SMS), nil
	}
	return u.smsPublicValue(rec.Value), nil
}

// UpdateSMSConfig 更新短信配置（SecretKey 空保留原值），加密后存 system_settings。
func (u *Usecase) UpdateSMSConfig(ctx context.Context, req SMSConfigReq) (*SMSConfigPublic, error) {
	existing, _ := u.repo.Get(ctx, smsSettingKey)

	// SecretKey 空=保留原值（解密原值再重新加密）
	secretKey := strings.TrimSpace(req.SecretKey)
	if secretKey == "" && existing != nil {
		if enc, _ := existing.Value[smsEncryptedSecretKeyField].(string); strings.TrimSpace(enc) != "" {
			if plain, err := u.smsCipher.open(enc); err == nil {
				secretKey = plain
			}
		}
	}

	value := map[string]any{
		"enabled":           req.Enabled,
		"secret_id":         strings.TrimSpace(req.SecretID),
		"app_id":            strings.TrimSpace(req.AppID),
		"sign_name":         strings.TrimSpace(req.SignName),
		"template_id":       strings.TrimSpace(req.TemplateID),
		"region":            strings.TrimSpace(req.Region),
		"code_expire_min":   req.CodeExpireMin,
		"send_interval_sec": req.SendIntervalSec,
		"daily_limit":       req.DailyLimit,
	}
	if secretKey != "" {
		sealed, err := u.smsCipher.seal(secretKey)
		if err != nil {
			return nil, fmt.Errorf("加密短信 SecretKey 失败: %w", err)
		}
		value[smsEncryptedSecretKeyField] = sealed
	} else if existing != nil {
		if enc, ok := existing.Value[smsEncryptedSecretKeyField].(string); ok {
			value[smsEncryptedSecretKeyField] = enc
		}
	}

	rec, err := u.repo.Upsert(ctx, smsSettingKey, value)
	if err != nil {
		return nil, err
	}
	pub := u.smsPublicValue(rec.Value)
	return &pub, nil
}

func (u *Usecase) smsConfigFromValue(v map[string]any) config.SMSConfig {
	cfg := u.cfg.Bridal.SMS
	if v == nil {
		return cfg
	}
	if b, ok := v["enabled"].(bool); ok {
		cfg.Enabled = b
	}
	if s, ok := v["secret_id"].(string); ok {
		cfg.SecretID = s
	}
	if s, ok := v["app_id"].(string); ok {
		cfg.AppID = s
	}
	if s, ok := v["sign_name"].(string); ok {
		cfg.SignName = s
	}
	if s, ok := v["template_id"].(string); ok {
		cfg.TemplateID = s
	}
	if s, ok := v["region"].(string); ok && s != "" {
		cfg.Region = s
	}
	if n, ok := toInt(v["code_expire_min"]); ok && n > 0 {
		cfg.CodeExpireMin = n
	}
	if n, ok := toInt(v["send_interval_sec"]); ok && n > 0 {
		cfg.SendIntervalSec = n
	}
	if n, ok := toInt(v["daily_limit"]); ok && n > 0 {
		cfg.DailyLimit = n
	}
	if enc, _ := v[smsEncryptedSecretKeyField].(string); strings.TrimSpace(enc) != "" {
		if plain, err := u.smsCipher.open(enc); err == nil {
			cfg.SecretKey = plain
		}
	}
	return cfg
}

func (u *Usecase) smsPublicValue(v map[string]any) SMSConfigPublic {
	pub := SMSConfigPublic{}
	if v == nil {
		return pub
	}
	if b, ok := v["enabled"].(bool); ok {
		pub.Enabled = b
	}
	if s, ok := v["secret_id"].(string); ok {
		pub.SecretID = s
	}
	if s, ok := v["app_id"].(string); ok {
		pub.AppID = s
	}
	if s, ok := v["sign_name"].(string); ok {
		pub.SignName = s
	}
	if s, ok := v["template_id"].(string); ok {
		pub.TemplateID = s
	}
	if s, ok := v["region"].(string); ok {
		pub.Region = s
	}
	if n, ok := toInt(v["code_expire_min"]); ok {
		pub.CodeExpireMin = n
	}
	if n, ok := toInt(v["send_interval_sec"]); ok {
		pub.SendIntervalSec = n
	}
	if n, ok := toInt(v["daily_limit"]); ok {
		pub.DailyLimit = n
	}
	plain := ""
	if enc, _ := v[smsEncryptedSecretKeyField].(string); strings.TrimSpace(enc) != "" {
		if p, err := u.smsCipher.open(enc); err == nil {
			plain = p
		}
	}
	pub.Configured = plain != ""
	pub.MaskedSecretKey = maskSmsSecret(plain)
	return pub
}

func (u *Usecase) smsPublicFromConfig(cfg config.SMSConfig) SMSConfigPublic {
	return SMSConfigPublic{
		Enabled:         cfg.Enabled,
		SecretID:        cfg.SecretID,
		MaskedSecretKey: maskSmsSecret(cfg.SecretKey),
		Configured:      cfg.SecretKey != "",
		AppID:           cfg.AppID,
		SignName:        cfg.SignName,
		TemplateID:      cfg.TemplateID,
		Region:          cfg.Region,
		CodeExpireMin:   cfg.CodeExpireMin,
		SendIntervalSec: cfg.SendIntervalSec,
		DailyLimit:      cfg.DailyLimit,
	}
}

// ===== 邮箱服务配置（SMTP，admin 前端配置，密码加密存 system_settings） =====

// SMTPConfigReq 更新 SMTP 配置请求（Password 空=保留原值）。
type SMTPConfigReq struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	From     string `json:"from"`
	TLS      bool   `json:"tls"`
}

// SMTPConfigPublic SMTP 配置脱敏视图（admin GET 返回，密码脱敏）。
type SMTPConfigPublic struct {
	Host           string `json:"host"`
	Port           string `json:"port"`
	Username       string `json:"username"`
	MaskedPassword string `json:"masked_password"`
	Configured     bool   `json:"configured"`
	From           string `json:"from"`
	TLS            bool   `json:"tls"`
}

// GetSMTPConfig 读 SMTP 配置（后端发邮件用，含解密密码）。未配置回退 config.SMTP。
func (u *Usecase) GetSMTPConfig(ctx context.Context) (config.SMTP, error) {
	rec, err := u.repo.Get(ctx, smtpSettingKey)
	if err != nil {
		return u.cfg.SMTP, err
	}
	if rec == nil {
		return u.cfg.SMTP, nil
	}
	return u.smtpConfigFromValue(rec.Value), nil
}

// GetSMTPConfigPublic 读 SMTP 配置脱敏视图（admin GET）。
func (u *Usecase) GetSMTPConfigPublic(ctx context.Context) (SMTPConfigPublic, error) {
	rec, err := u.repo.Get(ctx, smtpSettingKey)
	if err != nil || rec == nil {
		return u.smtpPublicFromConfig(u.cfg.SMTP), nil
	}
	return u.smtpPublicValue(rec.Value), nil
}

// UpdateSMTPConfig 更新 SMTP 配置（Password 空保留原值），加密后存 system_settings。
func (u *Usecase) UpdateSMTPConfig(ctx context.Context, req SMTPConfigReq) (*SMTPConfigPublic, error) {
	existing, _ := u.repo.Get(ctx, smtpSettingKey)

	password := strings.TrimSpace(req.Password)
	if password == "" && existing != nil {
		if enc, _ := existing.Value[smtpEncryptedPasswordField].(string); strings.TrimSpace(enc) != "" {
			if plain, err := u.smtpCipher.open(enc); err == nil {
				password = plain
			}
		}
	}

	value := map[string]any{
		"host":     strings.TrimSpace(req.Host),
		"port":     strings.TrimSpace(req.Port),
		"username": strings.TrimSpace(req.Username),
		"from":     strings.TrimSpace(req.From),
		"tls":      req.TLS,
	}
	if password != "" {
		sealed, err := u.smtpCipher.seal(password)
		if err != nil {
			return nil, fmt.Errorf("加密 SMTP 密码失败: %w", err)
		}
		value[smtpEncryptedPasswordField] = sealed
	} else if existing != nil {
		if enc, ok := existing.Value[smtpEncryptedPasswordField].(string); ok {
			value[smtpEncryptedPasswordField] = enc
		}
	}

	rec, err := u.repo.Upsert(ctx, smtpSettingKey, value)
	if err != nil {
		return nil, err
	}
	pub := u.smtpPublicValue(rec.Value)
	return &pub, nil
}

func (u *Usecase) smtpConfigFromValue(v map[string]any) config.SMTP {
	cfg := u.cfg.SMTP
	if v == nil {
		return cfg
	}
	if s, ok := v["host"].(string); ok {
		cfg.Host = s
	}
	if s, ok := v["port"].(string); ok {
		cfg.Port = s
	}
	if s, ok := v["username"].(string); ok {
		cfg.Username = s
	}
	if s, ok := v["from"].(string); ok {
		cfg.From = s
	}
	if b, ok := v["tls"].(bool); ok {
		cfg.TLS = b
	}
	if enc, _ := v[smtpEncryptedPasswordField].(string); strings.TrimSpace(enc) != "" {
		if plain, err := u.smtpCipher.open(enc); err == nil {
			cfg.Password = plain
		}
	}
	return cfg
}

func (u *Usecase) smtpPublicValue(v map[string]any) SMTPConfigPublic {
	pub := SMTPConfigPublic{}
	if v == nil {
		return pub
	}
	if s, ok := v["host"].(string); ok {
		pub.Host = s
	}
	if s, ok := v["port"].(string); ok {
		pub.Port = s
	}
	if s, ok := v["username"].(string); ok {
		pub.Username = s
	}
	if s, ok := v["from"].(string); ok {
		pub.From = s
	}
	if b, ok := v["tls"].(bool); ok {
		pub.TLS = b
	}
	plain := ""
	if enc, _ := v[smtpEncryptedPasswordField].(string); strings.TrimSpace(enc) != "" {
		if p, err := u.smtpCipher.open(enc); err == nil {
			plain = p
		}
	}
	pub.Configured = plain != ""
	pub.MaskedPassword = maskSmtpPassword(plain)
	return pub
}

func (u *Usecase) smtpPublicFromConfig(cfg config.SMTP) SMTPConfigPublic {
	return SMTPConfigPublic{
		Host:           cfg.Host,
		Port:           cfg.Port,
		Username:       cfg.Username,
		MaskedPassword: maskSmtpPassword(cfg.Password),
		Configured:     cfg.Password != "",
		From:           cfg.From,
		TLS:            cfg.TLS,
	}
}

// ===== 验证码通道可用性（SMS 降级邮件用） =====

// VerificationAvailability 验证码通道运行时可用性（静态判定，仅看配置完整性）。
// - SMS 可用：Enabled=true 且 SecretID/SecretKey/AppID/SignName/TemplateID/Region 全部非空。
// - Email 可用：Host/Port/From 非空，且 Username/Password 同时空（无认证 SMTP）或同时非空（认证 SMTP）。
//
// 注意：本结构只回答"通道是否配置完整可用"，不做网络探测 / SMTP 登录 / 失败计数。
// 配置存储故障应原样上抛，不静默降级（避免把后端故障误判为"通道不可用"）。
type VerificationAvailability struct {
	SMS   bool
	Email bool
}

// GetVerificationAvailability 返回当前运行时验证码通道可用性。
// 单次请求只读一次快照；调用方拿到后自行决策（pkg/verify.Selector 使用）。
func (u *Usecase) GetVerificationAvailability(ctx context.Context) (VerificationAvailability, error) {
	smsCfg, smsErr := u.GetSMSConfig(ctx)
	if smsErr != nil {
		return VerificationAvailability{}, fmt.Errorf("读短信配置失败: %w", smsErr)
	}
	smtpCfg, smtpErr := u.GetSMTPConfig(ctx)
	if smtpErr != nil {
		return VerificationAvailability{}, fmt.Errorf("读 SMTP 配置失败: %w", smtpErr)
	}
	return VerificationAvailability{
		SMS:   isSMSConfigComplete(smsCfg),
		Email: isSMTPConfigComplete(smtpCfg),
	}, nil
}

// isSMSConfigComplete 判定 SMS 配置是否完整可用（不依赖 Enabled 之外的状态）。
// 必填：Enabled && SecretID && SecretKey && AppID && SignName && TemplateID && Region 全部非空（TrimSpace 后）。
func isSMSConfigComplete(cfg config.SMSConfig) bool {
	return cfg.Enabled &&
		strings.TrimSpace(cfg.SecretID) != "" &&
		strings.TrimSpace(cfg.SecretKey) != "" &&
		strings.TrimSpace(cfg.AppID) != "" &&
		strings.TrimSpace(cfg.SignName) != "" &&
		strings.TrimSpace(cfg.TemplateID) != "" &&
		strings.TrimSpace(cfg.Region) != ""
}

// isSMTPConfigComplete 判定 SMTP 配置是否完整可用。
// 必填：Host / Port / From 全部非空；Username / Password 必须同时空（无认证 SMTP）或同时非空（认证 SMTP）。
// 单边填视为配置不合法，返回 false。
// 不探测网络、不登录 SMTP。
func isSMTPConfigComplete(cfg config.SMTP) bool {
	if strings.TrimSpace(cfg.Host) == "" ||
		strings.TrimSpace(cfg.Port) == "" ||
		strings.TrimSpace(cfg.From) == "" {
		return false
	}
	user := strings.TrimSpace(cfg.Username)
	pass := strings.TrimSpace(cfg.Password)
	if (user == "") != (pass == "") {
		return false
	}
	return true
}
