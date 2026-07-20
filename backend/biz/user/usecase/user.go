package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/samber/do"

	"bridal/backend/biz/syssetting"
	"bridal/backend/config"
	"bridal/backend/consts"
	"bridal/backend/db"
	"bridal/backend/domain"
	"bridal/backend/errcode"
	"bridal/backend/pkg/crypto"
	"bridal/backend/pkg/cvt"
	"bridal/backend/pkg/sms"
	"bridal/backend/pkg/verify"
)

type UserUsecase struct {
	repo           domain.UserRepo
	logger         *slog.Logger
	redis          *redis.Client
	config         *config.Config
	email          domain.EmailSender
	smsCode        *sms.CodeService
	syssetting     *syssetting.Usecase
	verifySelector *verify.Selector
}

func NewUserUsecase(i *do.Injector) (domain.UserUsecase, error) {
	cfg := do.MustInvoke[*config.Config](i)
	return &UserUsecase{
		repo:           do.MustInvoke[domain.UserRepo](i),
		logger:         do.MustInvoke[*slog.Logger](i),
		redis:          do.MustInvoke[*redis.Client](i),
		config:         cfg,
		email:          do.MustInvoke[domain.EmailSender](i),
		smsCode:        do.MustInvoke[*sms.CodeService](i),
		syssetting:     do.MustInvoke[*syssetting.Usecase](i),
		verifySelector: do.MustInvoke[*verify.Selector](i),
	}, nil
}

// Get implements domain.UserUsecase.
func (u *UserUsecase) Get(ctx context.Context, uid uuid.UUID) (*domain.User, error) {
	us, err := u.repo.Get(ctx, uid)
	if err != nil {
		return nil, err
	}
	return cvt.From(us, &domain.User{}), nil
}

// Update implements domain.UserUsecase.
func (u *UserUsecase) Update(ctx context.Context, uid uuid.UUID, avatarURL string, req domain.UpdateUserReq) (*domain.User, error) {
	err := u.repo.Update(ctx, uid, req.Name, avatarURL)
	if err != nil {
		u.logger.ErrorContext(ctx, "update user failed", "error", err, "user_id", uid)
		return nil, err
	}

	user, err := u.Get(ctx, uid)
	if err != nil {
		u.logger.ErrorContext(ctx, "get updated user failed", "error", err, "user_id", uid)
		return nil, err
	}
	return user, nil
}

// GetUserWithTeams implements domain.UserUsecase.
func (u *UserUsecase) GetUserWithTeams(ctx context.Context, userID uuid.UUID) (*domain.TeamUserInfo, error) {
	user, err := u.repo.GetUserWithTeams(ctx, userID)
	if err != nil {
		return nil, err
	}
	teamUser := cvt.From(user, &domain.TeamUserInfo{})
	if teamUser.User != nil {
		bound, err := u.repo.WechatMPBound(ctx, userID)
		if err != nil {
			return nil, err
		}
		teamUser.User.WechatMPBound = bound
	}
	return teamUser, nil
}

// PasswordLogin implements domain.UserUsecase.
func (u *UserUsecase) PasswordLogin(ctx context.Context, req *domain.TeamLoginReq) (*domain.User, error) {
	user, err := u.repo.PasswordLogin(ctx, req)
	if err != nil {
		return nil, err
	}
	return cvt.From(user, &domain.User{}), nil
}

// ChangePassword implements domain.UserUsecase.
func (u *UserUsecase) ChangePassword(ctx context.Context, userID uuid.UUID, req *domain.ChangePasswordReq, isReset bool) error {
	err := u.repo.ChangePassword(ctx, userID, req.CurrentPassword, req.NewPassword, isReset)
	if err != nil {
		u.logger.ErrorContext(ctx, "change password failed", "userID", userID, "error", err)
		return err
	}
	return nil
}

// GetUserByEmail implements domain.UserUsecase.
func (u *UserUsecase) GetUserByEmail(ctx context.Context, emails []string) ([]*domain.User, error) {
	users, err := u.repo.GetUserByEmail(ctx, emails)
	if err != nil && !db.IsNotFound(err) {
		return nil, errcode.ErrDatabaseQuery.Wrap(err)
	}
	if len(users) == 0 {
		u.logger.InfoContext(ctx, "no user found by email", "emails", emails)
		return nil, nil
	}

	result := make([]*domain.User, 0, len(users))
	cvt.Iter(users, func(_ int, user *db.User) error {
		result = append(result, cvt.From(user, &domain.User{}))
		return nil
	})
	return result, nil
}

// SendBindEmailVerification 发送邮箱绑定验证邮件
func (u *UserUsecase) SendBindEmailVerification(ctx context.Context, userID uuid.UUID, req *domain.SendBindEmailVerificationReq) error {
	// 检查邮箱是否已被其他用户使用
	existingUsers, err := u.repo.GetUserByEmail(ctx, []string{req.Email})
	if err != nil && !db.IsNotFound(err) {
		return errcode.ErrDatabaseQuery.Wrap(err)
	}
	for _, eu := range existingUsers {
		if eu.ID == userID {
			return errcode.ErrEmailAlreadyBound
		}
		return errcode.ErrEmailTaken
	}

	// 生成验证 token（使用 UUID，避免 base32 填充字符在邮件传输中被破坏）
	token := uuid.NewString()

	// 存储 token 到 Redis，key: bind_email_token:{token}，value: {userID}:{email}，有效期 24 小时
	key := fmt.Sprintf("bind_email_token:%s", token)
	value := fmt.Sprintf("%s:%s", userID.String(), req.Email)
	if err := u.redis.Set(ctx, key, value, time.Hour*24).Err(); err != nil {
		u.logger.ErrorContext(ctx, "set redis key failed", "userID", userID, "email", req.Email, "error", err)
		return errcode.ErrDatabaseOperation.Wrap(err)
	}

	// 获取用户信息用于邮件发送
	user, err := u.repo.Get(ctx, userID)
	if err != nil {
		u.logger.ErrorContext(ctx, "get user failed", "userID", userID, "email", req.Email, "error", err)
		return errcode.ErrDatabaseQuery.Wrap(err)
	}

	verifyURL := fmt.Sprintf("%s/api/v1/users/email/verify?token=%s", u.config.Server.BaseURL, token)
	if u.config.Debug {
		u.logger.InfoContext(ctx, "dev mode: bind email skipped, use verify_url", "email", req.Email, "verify_url", verifyURL)
		return nil
	}
	go func() {
		if err := u.email.SendBindEmailVerification(context.Background(), req.Email, user.Name, verifyURL); err != nil {
			u.logger.ErrorContext(ctx, "send bind email verification mail failed", "userID", userID, "email", req.Email, "error", err)
		}
	}()

	return nil
}

// VerifyBindEmail 验证邮箱绑定
func (u *UserUsecase) VerifyBindEmail(ctx context.Context, token string) error {
	// 以 token 为 key 从 Redis 中取出 userID 和邮箱（一次性消费）
	key := fmt.Sprintf("bind_email_token:%s", token)
	redisValue, err := u.redis.GetDel(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return errcode.ErrEmailVerifyFailed
		}
		u.logger.ErrorContext(ctx, "get redis key failed", "error", err)
		return errcode.ErrDatabaseOperation.Wrap(err)
	}

	// 解析 Redis 中的值：{userID}:{email}
	parts := strings.SplitN(redisValue, ":", 2)
	if len(parts) != 2 {
		u.logger.WarnContext(ctx, "invalid redis value format", "value", redisValue)
		return errcode.ErrEmailVerifyFailed
	}

	userID, err := uuid.Parse(parts[0])
	if err != nil {
		u.logger.WarnContext(ctx, "parse user id from redis value failed", "error", err)
		return errcode.ErrEmailVerifyFailed.Wrap(err)
	}
	email := parts[1]

	// 再次检查邮箱是否被其他用户占用（防止竞态条件）
	existingUsers, err := u.repo.GetUserByEmail(ctx, []string{email})
	if err != nil && !db.IsNotFound(err) {
		return errcode.ErrDatabaseQuery.Wrap(err)
	}
	for _, eu := range existingUsers {
		if eu.ID != userID {
			return errcode.ErrEmailTaken
		}
	}

	// 更新用户邮箱
	if err := u.repo.SetEmail(ctx, userID, email); err != nil {
		u.logger.ErrorContext(ctx, "set email failed", "error", err)
		return errcode.ErrDatabaseOperation.Wrap(err)
	}

	u.logger.InfoContext(ctx, "bind email success", "user_id", userID, "email", email)
	return nil
}

// normalizePhoneInput 规范化手机号输入：去空格 / + / 86 前缀 / 前导 0，保留纯数字。
func normalizePhoneInput(phone string) string {
	p := strings.TrimSpace(phone)
	p = strings.TrimPrefix(p, "+")
	p = strings.TrimPrefix(p, "86")
	p = strings.TrimLeft(p, "0")
	return p
}

// isPhoneValid 校验中国大陆手机号：11 位、1 开头、全数字。
func isPhoneValid(phone string) bool {
	if len(phone) != 11 || phone[0] != '1' {
		return false
	}
	for _, r := range phone {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// ===== 新通用验证码接口（SMS / Email 双通道，Selector 静态选路）=====

// SendVerificationCode 发 6 位数字验证码（phone 或 email 之一，Selector 按可用性选通道）。
// 返回 Delivery 含实际 channel + 脱敏 destination；前端带回 channel 给 register/reset 提交。
func (u *UserUsecase) SendVerificationCode(ctx context.Context, req *domain.SendVerificationCodeReq) (*domain.VerificationDelivery, error) {
	if !req.VerificationTarget.Valid() {
		return nil, errcode.ErrBadRequest
	}
	scene := verify.Scene(req.Scene)
	if !scene.Valid() {
		return nil, errcode.ErrBadRequest
	}

	// 规范化 target
	t := req.VerificationTarget
	if t.Phone != "" {
		t.Phone = normalizePhoneInput(t.Phone)
		if !isPhoneValid(t.Phone) {
			return nil, errcode.ErrPhoneInvalid
		}
	}
	if t.Email != "" {
		t.Email = t.NormalizeEmail()
	}

	// 业务前置：register 场景查 phone 重，reset 场景查 phone / email 是否存在
	if err := u.precheckVerificationTarget(ctx, t, scene); err != nil {
		return nil, err
	}

	// 委托给 Selector
	d, err := u.verifySelector.SendCode(ctx, verify.Target{Phone: t.Phone, Email: t.Email}, scene)
	if err != nil {
		return nil, err
	}
	return &domain.VerificationDelivery{
		Channel:           string(d.Channel),
		MaskedDestination: d.MaskedDestination,
		ExpiresInSeconds:  d.ExpiresInSeconds,
		RetryAfterSeconds: d.RetryAfterSeconds,
	}, nil
}

// precheckVerificationTarget 在发码前做业务校验：
//   - scene=register + phone 非空 + phone 已注册 → ErrPhoneTaken
//   - scene=register + email 非空 + email 已注册 → ErrEmailTaken
//   - scene=reset_password + phone 非空 + phone 未注册 → ErrPhoneNotFound
//   - scene=reset_password + email 非空 + email 未注册 → ErrEmailNotBound
// phone + email 共存时两个都查，任一不通过即返。
func (u *UserUsecase) precheckVerificationTarget(ctx context.Context, t domain.VerificationTarget, scene verify.Scene) error {
	switch scene {
	case verify.SceneRegister:
		if t.Phone != "" {
			if existing, err := u.repo.GetByPhone(ctx, t.Phone); err != nil {
				if !db.IsNotFound(err) {
					return errcode.ErrDatabaseQuery.Wrap(err)
				}
			} else if existing != nil {
				return errcode.ErrPhoneTaken
			}
		}
		if t.Email != "" {
			if existing, err := u.repo.GetByEmailLower(ctx, t.Email); err != nil {
				if !db.IsNotFound(err) {
					return errcode.ErrDatabaseQuery.Wrap(err)
				}
			} else if existing != nil {
				return errcode.ErrEmailTaken
			}
		}
	case verify.SceneResetPassword:
		// 重置场景：phone / email 至少要查到一个用户
		found := false
		if t.Phone != "" {
			if existing, err := u.repo.GetByPhone(ctx, t.Phone); err == nil && existing != nil {
				found = true
			} else if err != nil && !db.IsNotFound(err) {
				return errcode.ErrDatabaseQuery.Wrap(err)
			}
		}
		if !found && t.Email != "" {
			if existing, err := u.repo.GetByEmailLower(ctx, t.Email); err == nil && existing != nil {
				found = true
			} else if err != nil && !db.IsNotFound(err) {
				return errcode.ErrDatabaseQuery.Wrap(err)
			}
		}
		if !found {
			if t.Phone != "" {
				return errcode.ErrPhoneNotFound
			}
			return errcode.ErrEmailNotBound
		}
	}
	return nil
}

// RegisterByCode 通用注册：phone 或 email + code + channel（与 SendVerificationCode 返回的 channel 一致）。
// phone + email 共存合法（用户选项 B：SMS 不可用时 phone 用户补 email 收验证码，两者都写入 user）。
func (u *UserUsecase) RegisterByCode(ctx context.Context, req *domain.RegisterByCodeReq) (*domain.User, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	t := req.VerificationTarget
	if t.Phone != "" {
		t.Phone = normalizePhoneInput(t.Phone)
		if !isPhoneValid(t.Phone) {
			return nil, errcode.ErrPhoneInvalid
		}
	}
	if t.Email != "" {
		t.Email = t.NormalizeEmail()
	}

	// 校验验证码：按 channel 路由到对应 channel.Verify
	destination := t.Phone
	if req.Channel == "email" {
		destination = t.Email
	}
	if err := u.verifySelector.Verify(ctx, verify.ChannelName(req.Channel), destination, verify.SceneRegister, req.Code); err != nil {
		return nil, err
	}

	// 再次查重（防并发注册）
	if t.Phone != "" {
		if existing, err := u.repo.GetByPhone(ctx, t.Phone); err != nil {
			if !db.IsNotFound(err) {
				return nil, errcode.ErrDatabaseQuery.Wrap(err)
			}
		} else if existing != nil {
			return nil, errcode.ErrPhoneTaken
		}
	}
	if t.Email != "" {
		if existing, err := u.repo.GetByEmailLower(ctx, t.Email); err != nil {
			if !db.IsNotFound(err) {
				return nil, errcode.ErrDatabaseQuery.Wrap(err)
			}
		} else if existing != nil {
			return nil, errcode.ErrEmailTaken
		}
	}

	hashed, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, errcode.ErrPasswordHashFailed.Wrap(err)
	}
	usr, err := u.repo.CreateIndividualByContact(ctx, t.Phone, t.Email, hashed)
	if err != nil {
		return nil, errcode.ErrDatabaseOperation.Wrap(err)
	}
	u.logger.InfoContext(ctx, "user registered by code",
		"phone", t.Phone, "email", t.Email, "channel", req.Channel, "user_id", usr.ID)
	return cvt.From(usr, &domain.User{}), nil
}

// ResetPasswordByCode 通用重置：phone 或 email + code + channel + 新密码。
// phone 重置时 fallback email 从数据库 user.Email 取（不信客户端）。
func (u *UserUsecase) ResetPasswordByCode(ctx context.Context, req *domain.ResetByCodeReq) (*domain.User, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	t := req.VerificationTarget
	if t.Phone != "" {
		t.Phone = normalizePhoneInput(t.Phone)
		if !isPhoneValid(t.Phone) {
			return nil, errcode.ErrPhoneInvalid
		}
	}
	if t.Email != "" {
		t.Email = t.NormalizeEmail()
	}

	// 校验验证码
	destination := t.Phone
	if req.Channel == "email" {
		destination = t.Email
	}
	if err := u.verifySelector.Verify(ctx, verify.ChannelName(req.Channel), destination, verify.SceneResetPassword, req.Code); err != nil {
		return nil, err
	}

	// 查用户：phone 路径从 phone 查；email 路径从 email 查
	var usr *db.User
	var err error
	if t.Phone != "" {
		usr, err = u.repo.GetByPhone(ctx, t.Phone)
	} else {
		usr, err = u.repo.GetByEmailLower(ctx, t.Email)
	}
	if err != nil {
		if db.IsNotFound(err) {
			if t.Phone != "" {
				return nil, errcode.ErrPhoneNotFound
			}
			return nil, errcode.ErrEmailNotBound
		}
		return nil, errcode.ErrDatabaseQuery.Wrap(err)
	}
	if usr.Role == consts.UserRoleEnterprise {
		return nil, errcode.ErrEnterpriseResetPasswordDenied
	}
	if err := u.repo.ChangePassword(ctx, usr.ID, "", req.NewPassword, true); err != nil {
		return nil, err
	}
	u.logger.InfoContext(ctx, "password reset by code",
		"phone", t.Phone, "email", t.Email, "channel", req.Channel, "user_id", usr.ID)
	return cvt.From(usr, &domain.User{}), nil
}
