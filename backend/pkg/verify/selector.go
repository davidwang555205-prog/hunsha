package verify

import (
	"context"
	"log/slog"
	"strings"

	"bridal/backend/errcode"
)

// Selector 静态通道选择器（单次请求单 channel；同请求内 SMS 失败不降级）。
//
// 决策树（与 plan §3 一致）：
//   target.Email != ""（email 目标）:
//     availability.Email == false → ErrVerificationChannelUnavailable
//     → 走 Email channel
//   target.Phone != ""（phone 目标）:
//     availability.SMS == true → SMS channel
//     availability.SMS == false:
//       target.Email == "" → ErrSmsUnavailableForPhone（让前端补 email）
//       target.Email != "" && availability.Email → Email channel（phone 降级兜底）
//       target.Email != "" && !availability.Email → ErrVerificationChannelUnavailable
//
// Verify 不读 Availability，按客户端带回的 channel 直接路由。
type Selector struct {
	availability AvailabilityFunc
	channels     map[ChannelName]Channel
	logger       *slog.Logger
}

// NewSelector 构造选路器。sms / email 任一为 nil 时调用会返 ErrBadRequest。
func NewSelector(af AvailabilityFunc, smsCh, emailCh Channel, logger *slog.Logger) *Selector {
	if logger == nil {
		logger = slog.Default()
	}
	return &Selector{
		availability: af,
		channels: map[ChannelName]Channel{
			ChannelSMS:   smsCh,
			ChannelEmail: emailCh,
		},
		logger: logger,
	}
}

// SendCode 决策并发送；返回 Delivery（含实际 channel 与脱敏 destination）。
func (s *Selector) SendCode(ctx context.Context, target Target, scene Scene) (*Delivery, error) {
	if !scene.Valid() {
		return nil, errcode.ErrBadRequest
	}
	if !target.Valid() {
		return nil, errcode.ErrBadRequest
	}

	avail, err := s.availability(ctx)
	if err != nil {
		// 配置存储故障：原样上抛，不静默降级（避免把后端故障误判为通道不可用）。
		return nil, errcode.ErrInternalServer.Wrap(err)
	}

	// 纯 email 目标（仅 email 非空）：仅走 Email（即使 SMS 可用也不绕道）
	if target.Email != "" && target.Phone == "" {
		if !avail.Email {
			return nil, errcode.ErrVerificationChannelUnavailable
		}
		return s.sendEmail(ctx, target.Email, scene, "email 目标")
	}

	// phone 目标
	if avail.SMS {
		return s.sendSMS(ctx, target.Phone, scene)
	}

	// SMS 不可用
	if target.Email == "" {
		s.logger.WarnContext(ctx, "phone SMS unavailable, need email fallback",
			"phone", maskPhone(target.Phone), "scene", string(scene))
		return nil, errcode.ErrSmsUnavailableForPhone
	}
	if !avail.Email {
		s.logger.WarnContext(ctx, "phone SMS unavailable and Email also unavailable",
			"phone", maskPhone(target.Phone), "scene", string(scene))
		return nil, errcode.ErrVerificationChannelUnavailable
	}

	s.logger.InfoContext(ctx, "phone SMS unavailable, fallback to email",
		"phone", maskPhone(target.Phone),
		"email", maskEmail(target.Email),
		"scene", string(scene))
	return s.sendEmail(ctx, target.Email, scene, "phone 降级 email")
}

func (s *Selector) sendSMS(ctx context.Context, phone string, scene Scene) (*Delivery, error) {
	ch := s.channels[ChannelSMS]
	if ch == nil {
		return nil, errcode.ErrInternalServer
	}
	if err := ch.SendCode(ctx, phone, scene); err != nil {
		// 实际 SMS 失败 → 返 SMS 错误，不尝试 Email（plan §D7 已拍板）。
		return nil, err
	}
	return &Delivery{
		Channel:           ChannelSMS,
		MaskedDestination: maskPhone(phone),
		ExpiresInSeconds:  5 * 60,
		RetryAfterSeconds: 60,
	}, nil
}

func (s *Selector) sendEmail(ctx context.Context, email string, scene Scene, reason string) (*Delivery, error) {
	ch := s.channels[ChannelEmail]
	if ch == nil {
		return nil, errcode.ErrInternalServer
	}
	if err := ch.SendCode(ctx, email, scene); err != nil {
		return nil, err
	}
	return &Delivery{
		Channel:           ChannelEmail,
		MaskedDestination: maskEmail(email),
		ExpiresInSeconds:  5 * 60,
		RetryAfterSeconds: 60,
	}, nil
}

// Verify 不重读 Availability，按 channel 路由。
func (s *Selector) Verify(ctx context.Context, channel ChannelName, destination string, scene Scene, code string) error {
	if !scene.Valid() {
		return errcode.ErrBadRequest
	}
	if channel != ChannelSMS && channel != ChannelEmail {
		return errcode.ErrBadRequest
	}
	ch := s.channels[channel]
	if ch == nil {
		return errcode.ErrInternalServer
	}
	return ch.Verify(ctx, destination, scene, code)
}

// maskPhone 脱敏手机号：138****8000
func maskPhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if len(phone) < 7 {
		return "****"
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

// maskEmail 脱敏邮箱：a***@example.com
func maskEmail(email string) string {
	email = strings.ToLower(strings.TrimSpace(email))
	at := strings.Index(email, "@")
	if at <= 0 {
		return "****"
	}
	if at == 1 {
		return email[:1] + "***" + email[at:]
	}
	return email[:1] + "***" + email[at:]
}
