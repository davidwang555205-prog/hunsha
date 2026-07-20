package domain

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"bridal/backend/consts"
	"bridal/backend/db"
	"bridal/backend/errcode"
	"bridal/backend/pkg/cvt"
)

type UserUsecase interface {
	Get(ctx context.Context, uid uuid.UUID) (*User, error)
	Update(ctx context.Context, uid uuid.UUID, avatarURL string, req UpdateUserReq) (*User, error)
	GetUserWithTeams(ctx context.Context, userID uuid.UUID) (*TeamUserInfo, error)
	PasswordLogin(ctx context.Context, req *TeamLoginReq) (*User, error)
	ChangePassword(ctx context.Context, userID uuid.UUID, req *ChangePasswordReq, isReset bool) error
	GetUserByEmail(ctx context.Context, emails []string) ([]*User, error)
	SendBindEmailVerification(ctx context.Context, userID uuid.UUID, req *SendBindEmailVerificationReq) error
	VerifyBindEmail(ctx context.Context, token string) error

	// SendVerificationCode 发 6 位数字验证码（phone 或 email 之一，Selector 按可用性选通道）。
	// 返回 Delivery 含实际 channel + 脱敏 destination；前端带回 channel 给 register/reset。
	SendVerificationCode(ctx context.Context, req *SendVerificationCodeReq) (*VerificationDelivery, error)

	// RegisterByCode 通用注册：phone 或 email + code + channel（与 SendVerificationCode 返回的 channel 一致）。
	RegisterByCode(ctx context.Context, req *RegisterByCodeReq) (*User, error)

	// ResetPasswordByCode 通用重置：phone 或 email + code + channel + 新密码。
	// phone 重置时 fallback email 从数据库 user.Email 取（不信客户端）。
	ResetPasswordByCode(ctx context.Context, req *ResetByCodeReq) (*User, error)

	// ChangePhoneByCode 登录态变更手机号：向新手机号发码（scene=change_phone），
	// 校验通过后把当前登录用户的手机号改为新号；新号若已被他人占用则拒绝。
	ChangePhoneByCode(ctx context.Context, userID uuid.UUID, req *ChangePhoneByCodeReq) error
}

type UserRepo interface {
	Get(ctx context.Context, uid uuid.UUID) (*db.User, error)
	Update(ctx context.Context, uid uuid.UUID, name, avatarURL string) error
	GetUserWithTeams(ctx context.Context, uid uuid.UUID) (*db.User, error)
	WechatMPBound(ctx context.Context, uid uuid.UUID) (bool, error)
	PasswordLogin(ctx context.Context, req *TeamLoginReq) (*db.User, error)
	ChangePassword(ctx context.Context, uid uuid.UUID, currentPassword, newPassword string, isReset bool) error
	GetUserByEmail(ctx context.Context, emails []string) ([]*db.User, error)
	SetEmail(ctx context.Context, userID uuid.UUID, email string) error
	SetPhone(ctx context.Context, userID uuid.UUID, phone string) error
	GetByPhone(ctx context.Context, phone string) (*db.User, error)
	CreateIndividual(ctx context.Context, phone, hashedPassword string) (*db.User, error)

	// GetByEmailLower 大小写不敏感按 email 查单个 user（注册查重 / phone 用户 fallback 取绑定 email）。
	// 返回 ErrNotFound 表示未找到；ErrDatabaseQuery 表示多账户匹配等异常。
	GetByEmailLower(ctx context.Context, email string) (*db.User, error)

	// CreateIndividualByContact 条件写 phone/email 创建 individual 用户。
	// phone / email 至少一个非空；phone 与 email 都填时同时写入（用户选项 B：phone + 补 email 注册）。
	CreateIndividualByContact(ctx context.Context, phone, email, hashedPassword string) (*db.User, error)
}

type OAuthLoginUser struct {
	Provider   consts.UserPlatform
	IdentityID string
	Email      string
	Username   string
	Name       string
	AvatarURL  string
}

type OAuthLoginRepo interface {
	FindUserByOAuthIdentity(ctx context.Context, platform consts.UserPlatform, identityID string) (*db.User, error)
	FindIndividualByEmail(ctx context.Context, email string) (*db.User, error)
	CreateIndividualWithIdentity(ctx context.Context, external *OAuthLoginUser) (*db.User, error)
	BindOAuthIdentity(ctx context.Context, userID uuid.UUID, external *OAuthLoginUser) error
	UpdateOAuthIdentity(ctx context.Context, external *OAuthLoginUser) error
}

type OAuthLoginUsecase interface {
	StartOAuthLogin(ctx context.Context, provider string, redirectURL string) (string, error)
	HandleOAuthCallback(ctx context.Context, provider string, code string, state string) (*OAuthLoginCallbackResp, error)
}

type OAuthLoginCallbackResp struct {
	User        *User
	RedirectURL string
}

type OAuthLoginResp struct {
	AuthURL string `json:"auth_url"`
}

type OAuthLoginReq struct {
	Provider    string `param:"provider" validate:"required" swaggerignore:"true"`
	RedirectURL string `query:"redirect_url"`
}

type OAuthCallbackReq struct {
	Provider string `param:"provider" validate:"required" swaggerignore:"true"`
	Code     string `query:"code" validate:"required"`
	State    string `query:"state" validate:"required"`
}

// UserActiveRepo 用户活跃记录仓储接口
type UserActiveRepo interface {
	RecordActiveIP(ctx context.Context, key string, ip string) error
	RecordActiveRecord(ctx context.Context, key consts.RedisKey, field string, score time.Time) error
	GetActiveRecord(ctx context.Context, key consts.RedisKey, userID string) (time.Time, error)
}

type User struct {
	ID            uuid.UUID         `json:"id"`
	Name          string            `json:"name"`
	AvatarURL     string            `json:"avatar_url"`
	Email         string            `json:"email"`
	Role          consts.UserRole   `json:"role"`
	Status        consts.UserStatus `json:"status"`
	IsBlocked     bool              `json:"is_blocked"`
	Token         string            `json:"token,omitempty"`
	WechatMPBound bool              `json:"wechat_mp_bound"`
	Identities    []*UserIdentity   `json:"identities"`
	Team          *Team             `json:"team,omitempty"`
	HasPassword   bool              `json:"has_password"`
	// bridal 业务字段（ent users 表 bridal 扩展，team.Login 返回的 User 自带）
	Username           string      `json:"username"`
	DisplayName        string      `json:"displayName"`
	DailyImageLimit    int         `json:"dailyImageLimit"`
	Credits            int         `json:"credits"`
	VisibleCategoryIDs []uuid.UUID `json:"visibleCategoryIds"`
	// bridal 短信注册 / 初始密码
	Phone              string `json:"phone,omitempty"`
	MustChangePassword bool   `json:"mustChangePassword"`
}

type SubscriptionResp struct {
	Plan      string     `json:"plan"`
	Source    string     `json:"source,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	AutoRenew bool       `json:"auto_renew"`
}

func (u *User) From(src *db.User) *User {
	if src == nil {
		return u
	}

	u.ID = src.ID
	u.Name = src.Name
	u.AvatarURL = src.AvatarURL
	u.Email = src.Email
	u.Role = src.Role
	u.Status = src.Status
	u.IsBlocked = src.IsBlocked
	u.HasPassword = src.Password != ""
	u.Username = src.Username
	u.DisplayName = src.DisplayName
	u.DailyImageLimit = src.DailyImageLimit
	u.Credits = src.Credits
	u.VisibleCategoryIDs = src.VisibleCategoryIds
	u.Phone = src.Phone
	u.MustChangePassword = src.MustChangePassword
	u.Identities = cvt.Iter(src.Edges.Identities, func(_ int, i *db.UserIdentity) *UserIdentity {
		return cvt.From(i, &UserIdentity{})
	})
	if teams := src.Edges.Teams; len(teams) > 0 {
		u.Team = cvt.From(teams[0], &Team{})
	}
	return u
}

// bridal 每日生图额度常量（与 Node maxDailyImageLimit/defaultDailyImageLimit 一致）。
const (
	MaxDailyImageLimit     = 1000
	DefaultDailyImageLimit = 20
)

// HasUnlimitedImageGeneration bridal 业务：团队所有者(enterprise)与系统管理员(admin)
// 不受每日生图额度限制，其余角色(subaccount/individual)受 DailyImageLimit 限制。
func (u *User) HasUnlimitedImageGeneration() bool {
	return u.Role == consts.UserRoleEnterprise || u.Role == consts.UserRoleAdmin
}

// NormalizeDailyImageLimit 与 Node normalizeDailyImageLimit 一致：
// 负值返回 fallback，否则 max(0, min(1000, value))。
func NormalizeDailyImageLimit(value, fallback int) int {
	if value < 0 {
		return fallback
	}
	if value > MaxDailyImageLimit {
		return MaxDailyImageLimit
	}
	return value
}

type UserIdentity struct {
	ID         uuid.UUID           `json:"id"`
	AvatarURL  string              `json:"avatar_url"`
	Username   string              `json:"username"`
	IdentityID string              `json:"identity_id"`
	Platform   consts.UserPlatform `json:"platform"`
	Email      string              `json:"email"`
}

func (i *UserIdentity) From(src *db.UserIdentity) *UserIdentity {
	if src == nil {
		return i
	}

	i.ID = src.ID
	i.AvatarURL = src.AvatarURL
	i.Username = src.Username
	i.Platform = src.Platform
	i.Email = src.Email
	i.IdentityID = src.IdentityID

	return i
}

// TeamUserInfo 用户团队信息
type TeamUserInfo struct {
	User  *User         `json:"user"`
	Teams []*TeamMember `json:"teams"`
}

// From 从数据库模型转换为领域模型
func (t *TeamUserInfo) From(src *db.User) *TeamUserInfo {
	if src == nil {
		return t
	}
	t.User = cvt.From(src, &User{})
	t.Teams = cvt.Iter(src.Edges.TeamMembers, func(_ int, team *db.TeamMember) *TeamMember {
		return cvt.From(team, &TeamMember{})
	})
	return t
}

// TeamUserLoginResp 团队用户登录响应
type TeamUserLoginResp struct {
	TeamUserInfo
}

// UpdateUserReq 更新用户信息请求
type UpdateUserReq struct {
	Name      string `json:"name,omitempty" form:"name"`
	AvatarURL string `json:"avatar_url,omitempty" form:"avatar_url"`
}

// UpdateUserResp 更新用户信息响应
type UpdateUserResp struct {
	User    *User  `json:"user"`
	Message string `json:"message"`
	Success bool   `json:"success"`
}

// GetAccountInfoReq 通过 token 查询账户信息请求
type GetAccountInfoReq struct {
	Token string `param:"token" validate:"required"`
}

// ResetUserPasswordReq 修改密码请求
type ResetUserPasswordReq struct {
	NewPassword string `json:"new_password" validate:"required"`
	Token       string `json:"token" validate:"required"`
}

func (r *ResetUserPasswordReq) Validate() error {
	if len(r.NewPassword) < 8 || len(r.NewPassword) > 32 {
		return errcode.ErrPasswordLength
	}
	return nil
}

// ResetUserPasswordEmailReq 发送重置密码邮件请求
type ResetUserPasswordEmailReq struct {
	Emails       []string `json:"emails" validate:"required"`
	CaptchaToken string   `json:"captcha_token"`
}

func (r *ResetUserPasswordEmailReq) Validate() error {
	if len(r.Emails) == 0 {
		return errcode.ErrEmailRequired
	}
	for _, email := range r.Emails {
		if strings.TrimSpace(email) == "" {
			return errcode.ErrEmailRequired
		}
	}
	return nil
}

// TeamMembersResp 团队成员列表响应
type TeamMembersResp []*User

// UserMemberListReq 用户侧团队成员列表请求
type UserMemberListReq struct{}

// ActivateReq 激活请求
type ActivateReq struct {
	InviteCode string `json:"invite_code" validate:"required"`
	InviterID  string `json:"inviter_id,omitempty"`
}

// CursorReq 游标分页请求
type CursorReq struct {
	Cursor string `query:"cursor"`
	Limit  int    `query:"limit"`
}

// SendBindEmailVerificationReq 发送邮箱绑定验证邮件请求
type SendBindEmailVerificationReq struct {
	Email string `json:"email" validate:"required,email"` // 要绑定的邮箱地址
}

// VerifyBindEmailReq 验证邮箱请求
type VerifyBindEmailReq struct {
	Token string `query:"token" validate:"required"` // 验证 token
}

// ===== 新通用验证码接口（SMS / Email 双通道，Selector 选路）=====

// VerificationTarget 账号标识（phone 或 email 至少一个非空；phone + email 共存是 phone 用户补 email 的过渡态）。
type VerificationTarget struct {
	Phone string `json:"phone,omitempty"`
	Email string `json:"email,omitempty"`
}

// Valid 至少一个非空。
func (t VerificationTarget) Valid() bool {
	return t.Phone != "" || t.Email != ""
}

// NormalizePhone 规范化手机号输入（去空格/+86/前导 0），仅在 Phone 非空时有效。
func (t VerificationTarget) NormalizePhone() string {
	p := strings.TrimSpace(t.Phone)
	p = strings.TrimPrefix(p, "+")
	p = strings.TrimPrefix(p, "86")
	p = strings.TrimLeft(p, "0")
	return p
}

// NormalizeEmail 规范化 email（TrimSpace + ToLower），仅在 Email 非空时有效。
func (t VerificationTarget) NormalizeEmail() string {
	return strings.ToLower(strings.TrimSpace(t.Email))
}

// SendVerificationCodeReq 发 6 位数字验证码请求。
type SendVerificationCodeReq struct {
	VerificationTarget
	Scene        string `json:"scene" validate:"required"` // register | reset_password
	CaptchaToken string `json:"captcha_token,omitempty"`
}

// VerificationDelivery 发码响应（前端带回 channel 给 register/reset 提交）。
type VerificationDelivery struct {
	Channel           string `json:"channel"`            // sms | email
	MaskedDestination string `json:"masked_destination"` // 脱敏展示
	ExpiresInSeconds  int    `json:"expires_in_seconds"`
	RetryAfterSeconds int    `json:"retry_after_seconds"`
}

// RegisterByCodeReq 通用注册请求（phone 或 email + code + channel）。
// 注册时 phone + email 共存合法（用户选项 B：phone 用户补 email 收验证码后两者都写入）。
type RegisterByCodeReq struct {
	VerificationTarget
	Password string `json:"password" validate:"required"`
	Code     string `json:"code" validate:"required"`
	Channel  string `json:"channel" validate:"required"` // sms | email
}

// Validate 校验密码长度 8-32 + phone/email 至少一个非空。
func (r *RegisterByCodeReq) Validate() error {
	if !r.VerificationTarget.Valid() {
		return errcode.ErrBadRequest
	}
	if len(r.Password) < 8 || len(r.Password) > 32 {
		return errcode.ErrPasswordLength
	}
	if r.Channel != "sms" && r.Channel != "email" {
		return errcode.ErrBadRequest
	}
	return nil
}

// ResetByCodeReq 通用重置密码请求（phone 或 email + code + channel + 新密码）。
type ResetByCodeReq struct {
	VerificationTarget
	Code        string `json:"code" validate:"required"`
	Channel     string `json:"channel" validate:"required"`
	NewPassword string `json:"new_password" validate:"required"`
}

// Validate 校验新密码长度 8-32 + phone/email 至少一个非空 + channel 合法。
func (r *ResetByCodeReq) Validate() error {
	if !r.VerificationTarget.Valid() {
		return errcode.ErrBadRequest
	}
	if len(r.NewPassword) < 8 || len(r.NewPassword) > 32 {
		return errcode.ErrPasswordLength
	}
	if r.Channel != "sms" && r.Channel != "email" {
		return errcode.ErrBadRequest
	}
	return nil
}

// ChangePhoneByCodeReq 登录态变更手机号请求（新手机号 + code + channel）。
// channel 由 SendVerificationCode(change_phone) 返回的 Delivery 带回，与发码一致。
// 新手机号的规范化与格式校验在 usecase 层完成（与 RegisterByCode 一致）。
type ChangePhoneByCodeReq struct {
	VerificationTarget
	Code    string `json:"code" validate:"required"`
	Channel string `json:"channel" validate:"required"` // sms | email
}

// Validate 校验 target 非空 + channel 合法（手机号的格式校验下沉到 usecase）。
func (r *ChangePhoneByCodeReq) Validate() error {
	if !r.VerificationTarget.Valid() {
		return errcode.ErrBadRequest
	}
	if r.Channel != "sms" && r.Channel != "email" {
		return errcode.ErrBadRequest
	}
	return nil
}
