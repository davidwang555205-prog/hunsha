package domain

import "context"

// EmailSender 邮件发送接口
type EmailSender interface {
	SendResetPasswordEmail(ctx context.Context, to, username, resetURL string) error
	SendBindEmailVerification(ctx context.Context, to, username, verifyURL string) error
	// SendVerificationCode 发 6 位数字验证码邮件。expireMinutes 用于模板渲染（显示有效期）。
	// 入参 code 由调用方生成（pkg/verify 决定走 SMS 还是 Email 通道，code 来自该通道）。
	SendVerificationCode(ctx context.Context, to, username, code string, expireMinutes int) error
}
