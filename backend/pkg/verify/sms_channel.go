package verify

import (
	"context"
	"log/slog"

	"bridal/backend/config"
	"bridal/backend/errcode"
	"bridal/backend/pkg/sms"
)

// SMSConfigGetter 仅取 SMSConfig 子集（避免循环依赖 syssetting → verify → syssetting）。
type SMSConfigGetter interface {
	GetSMSConfig(ctx context.Context) (config.SMSConfig, error)
}

// SMSChannel 适配现有 pkg/sms.CodeService。
// production 调 sms.NewSender + CodeService.Send；Debug 模式走 CodeService.SendDevCode（不真发，写固定 123456）。
// 不复制 SMS 限流 / 存储逻辑——全部委托给 pkg/sms。
type SMSChannel struct {
	code       *sms.CodeService
	syssetting SMSConfigGetter
	debug      bool
	logger     *slog.Logger
}

// NewSMSChannel 构造 SMS 通道。debug=true 时走 SendDevCode（不真发）。
func NewSMSChannel(code *sms.CodeService, sg SMSConfigGetter, cfg *config.Config, logger *slog.Logger) *SMSChannel {
	if logger == nil {
		logger = slog.Default()
	}
	return &SMSChannel{
		code:       code,
		syssetting: sg,
		debug:      cfg.Debug,
		logger:     logger,
	}
}

func (c *SMSChannel) Name() ChannelName { return ChannelSMS }

func (c *SMSChannel) SendCode(ctx context.Context, phone string, scene Scene) error {
	smsScene := sms.Scene(scene)
	if !smsScene.Valid() {
		return errcode.ErrBadRequest
	}
	smsCfg, err := c.syssetting.GetSMSConfig(ctx)
	if err != nil {
		return errcode.ErrInternalServer.Wrap(err)
	}
	if c.debug {
		return c.code.SendDevCode(ctx, phone, smsScene, smsCfg)
	}
	sender, err := sms.NewSender(smsCfg)
	if err != nil {
		return errcode.ErrSmsSendFailed.Wrap(err)
	}
	return c.code.Send(ctx, phone, smsScene, sender, smsCfg)
}

func (c *SMSChannel) Verify(ctx context.Context, phone string, scene Scene, code string) error {
	return c.code.Verify(ctx, phone, sms.Scene(scene), code)
}
