package user

import (
	"context"
	"log/slog"

	"github.com/redis/go-redis/v9"
	"github.com/samber/do"

	"bridal/backend/biz/syssetting"
	v1 "bridal/backend/biz/user/handler/v1"
	"bridal/backend/biz/user/repo"
	"bridal/backend/biz/user/usecase"
	"bridal/backend/config"
	"bridal/backend/domain"
	"bridal/backend/pkg/sms"
	"bridal/backend/pkg/verify"
)

// ProvideUser 注册 user 模块的服务工厂
func ProvideUser(i *do.Injector) {
	do.Provide(i, repo.NewUserRepo)
	do.Provide(i, repo.NewOAuthLoginRepo)
	do.Provide(i, repo.NewUserActiveRepo)
	// 验证码服务（短信发送器动态构造，配置运行时从 syssetting 读，不在此注入）
	do.Provide(i, func(i *do.Injector) (*sms.CodeService, error) {
		rdb := do.MustInvoke[*redis.Client](i)
		return sms.NewCodeService(rdb), nil
	})
	// 验证码通道与选路器（SMS + Email 双通道，SMS 不可用时降级到 Email）
	do.Provide(i, newVerifySelector)
	do.Provide(i, usecase.NewUserUsecase)
	do.Provide(i, usecase.NewOAuthLoginUsecase)
	do.Provide(i, v1.NewAuthHandler)
}

// newVerifySelector 构造 pkg/verify.Selector（短信 / 邮件双通道 + syssetting 适配的 AvailabilityFunc）。
// syssetting.Usecase 实现 verify.SMSConfigGetter 子集接口，避免 pkg/verify 直接依赖 biz/syssetting。
func newVerifySelector(i *do.Injector) (*verify.Selector, error) {
	cfg := do.MustInvoke[*config.Config](i)
	logger := do.MustInvoke[*slog.Logger](i).With("module", "user.verify")
	sys := do.MustInvoke[*syssetting.Usecase](i)
	rdb := do.MustInvoke[*redis.Client](i)
	code := do.MustInvoke[*sms.CodeService](i)
	sender := do.MustInvoke[domain.EmailSender](i)

	af := func(ctx context.Context) (verify.Availability, error) {
		sa, err := sys.GetVerificationAvailability(ctx)
		if err != nil {
			return verify.Availability{}, err
		}
		return verify.Availability{SMS: sa.SMS, Email: sa.Email}, nil
	}

	smsCh := verify.NewSMSChannel(code, sys, cfg, logger)
	emCh := verify.NewEmailChannel(rdb, verify.EmailChannelConfig{
		CodeExpireMin:   cfg.Bridal.SMS.CodeExpireMin,
		SendIntervalSec: cfg.Bridal.SMS.SendIntervalSec,
		DailyLimit:      cfg.Bridal.SMS.DailyLimit,
		Debug:           cfg.Debug,
		Sender:          sender,
		Logger:          logger,
	})
	return verify.NewSelector(af, smsCh, emCh, logger), nil
}

// InvokeUser 触发 user 模块的 handler 初始化
func InvokeUser(i *do.Injector) {
	do.MustInvoke[*v1.AuthHandler](i)
}
