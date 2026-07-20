// Package verify 验证码通道抽象与静态选路。
//
// 业务场景：注册 / 密码重置需要给用户发 6 位数字验证码。短信通道（腾讯云）配置
// 不可用时降级到邮件通道。降级粒度为静态（仅看配置完整性，不做网络探测或失败
// 计数），由本包 Selector 决策。
//
// 依赖方向（避免循环）：
//   pkg/verify → pkg/sms / domain.EmailSender / *redis.Client
//   biz/user   → pkg/verify（构造 Selector 并调用）
//   biz/syssetting → config（提供 AvailabilityFunc 适配器）
package verify

import (
	"context"
)

// ChannelName 通道标识。
type ChannelName string

const (
	ChannelSMS   ChannelName = "sms"
	ChannelEmail ChannelName = "email"
)

// Scene 验证码业务场景（与 sms.Scene 同名同值；本包独立类型便于不依赖 pkg/sms）。
type Scene string

const (
	SceneRegister      Scene = "register"
	SceneResetPassword Scene = "reset_password"
)

// Valid 校验场景合法性。
func (s Scene) Valid() bool {
	switch s {
	case SceneRegister, SceneResetPassword:
		return true
	}
	return false
}

// Channel 验证码通道接口。
//
// 实现包需负责：限流（间隔/日上限）、生成 6 位数字、调用具体 sender（SMS 调
// 腾讯云 SDK；Email 调 SMTP）、存 Redis、一次性消费校验。
//
// 注意：Channel 接口故意不放 Available()——可用性由 Selector 通过 AvailabilityFunc
// 在请求开始时统一读一次快照决定，避免每个通道自己做网络探测或吞错。
type Channel interface {
	Name() ChannelName
	// SendCode 发送 6 位数字验证码到指定 destination（phone 或 email，按 Channel 而定）。
	// 通道内部完成限流 + 生成 + 发送 + 存储；返回错误原样上抛（含 ErrXxxSendTooFrequent）。
	SendCode(ctx context.Context, destination string, scene Scene) error
	// Verify 一次性消费校验（GetDel）。
	// 失败/过期/不存在一律返回 ErrSmsCodeInvalid 或 ErrEmailCodeInvalid。
	Verify(ctx context.Context, destination string, scene Scene, code string) error
}

// Delivery 发送结果（Selector.SendCode 返回给调用方，handler 透传给前端）。
type Delivery struct {
	Channel           ChannelName
	MaskedDestination string
	ExpiresInSeconds  int
	RetryAfterSeconds int
}

// Availability 通道可用性快照（仅在请求开始时取一次）。
type Availability struct {
	SMS   bool
	Email bool
}

// AvailabilityFunc 提供可用性的函数（biz/syssetting 适配）。
// 错误应原样上抛——配置存储故障不应被静默降级。
type AvailabilityFunc func(ctx context.Context) (Availability, error)

// Target 账号标识（phone 或 email 恰好一个；phone + email 共存是 phone 用户补 email 的过渡态）。
type Target struct {
	Phone string
	Email string
}

// Valid 校验 target 合法性：phone / email 至少一个非空。
//
// 允许 phone + email 同时填（用户选项 B：phone 用户补 email 收验证码的过渡态）；
// 注册成功后 phone + email 都写入 user。
// 两边都空才是非法。
func (t Target) Valid() bool {
	return t.Phone != "" || t.Email != ""
}
