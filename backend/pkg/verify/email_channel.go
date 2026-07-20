package verify

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"bridal/backend/domain"
	"bridal/backend/errcode"
)

// EmailChannelConfig 邮件验证码通道运行参数（直接传值，不读 syssetting）。
// - CodeExpireMin  默认 5
// - SendIntervalSec 默认 60
// - DailyLimit     默认 10
// - Debug=true 时写固定 123456，不调 Sender（不发真实邮件）
type EmailChannelConfig struct {
	CodeExpireMin   int
	SendIntervalSec int
	DailyLimit      int
	Debug           bool
	Sender          domain.EmailSender
	Logger          *slog.Logger
}

// EmailChannel 邮件验证码完整生命周期：限流 + 生成 + 发送 + 存储 + 一次性校验。
// Redis 命名空间与 sms 平行（email:code:* / email:lock:* / email:daily:*）。
type EmailChannel struct {
	redis  *redis.Client
	cfg    EmailChannelConfig
	logger *slog.Logger
}

// NewEmailChannel 构造邮件通道，缺省参数用 SMS 同款默认值。
func NewEmailChannel(rdb *redis.Client, cfg EmailChannelConfig) *EmailChannel {
	if cfg.CodeExpireMin <= 0 {
		cfg.CodeExpireMin = 5
	}
	if cfg.SendIntervalSec <= 0 {
		cfg.SendIntervalSec = 60
	}
	if cfg.DailyLimit <= 0 {
		cfg.DailyLimit = 10
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	return &EmailChannel{redis: rdb, cfg: cfg, logger: cfg.Logger}
}

func (c *EmailChannel) Name() ChannelName { return ChannelEmail }

// SendCode 限流 + 发送 + 存储。失败回滚 interval lock，不回滚 daily（与 SMS 一致）。
func (c *EmailChannel) SendCode(ctx context.Context, email string, scene Scene) error {
	email = normalizeEmail(email)
	if email == "" || c.cfg.Sender == nil {
		return errcode.ErrEmailCodeSendFailed
	}

	lockK := emailLockKey(email, scene)
	ok, err := c.redis.SetNX(ctx, lockK, 1, time.Duration(c.cfg.SendIntervalSec)*time.Second).Result()
	if err != nil {
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if !ok {
		return errcode.ErrEmailCodeSendTooFrequent
	}

	dailyK := emailDailyKey(email)
	cnt, err := c.redis.Incr(ctx, dailyK).Result()
	if err != nil {
		c.redis.Del(ctx, lockK)
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if cnt == 1 {
		c.redis.Expire(ctx, dailyK, 25*time.Hour)
	}
	if cnt > int64(c.cfg.DailyLimit) {
		// 超日上限：保留锁防继续刷，不回滚 daily
		return errcode.ErrEmailCodeSendTooFrequent
	}

	var code string
	if c.cfg.Debug {
		code = "123456"
	} else {
		code = generateEmailCode()
		if err := c.cfg.Sender.SendVerificationCode(ctx, email, "", code, c.cfg.CodeExpireMin); err != nil {
			c.redis.Del(ctx, lockK)
			return errcode.ErrEmailCodeSendFailed.Wrap(err)
		}
	}

	if err := c.redis.Set(ctx, emailCodeKey(email, scene), code, time.Duration(c.cfg.CodeExpireMin)*time.Minute).Err(); err != nil {
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	c.logger.InfoContext(ctx, "email verification code sent",
		"scene", string(scene), "email", maskEmail(email))
	return nil
}

// Verify 一次性消费 GetDel。
func (c *EmailChannel) Verify(ctx context.Context, email string, scene Scene, code string) error {
	email = normalizeEmail(email)
	if email == "" {
		return errcode.ErrEmailCodeInvalid
	}
	val, err := c.redis.GetDel(ctx, emailCodeKey(email, scene)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return errcode.ErrEmailCodeInvalid
		}
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if val != code {
		return errcode.ErrEmailCodeInvalid
	}
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func generateEmailCode() string {
	var b [4]byte
	_, _ = cryptorand.Read(b[:])
	n := binary.BigEndian.Uint32(b[:])
	return fmt.Sprintf("%06d", n%1000000)
}

func emailCodeKey(email string, scene Scene) string {
	return fmt.Sprintf("email:code:%s:%s", scene, email)
}

func emailLockKey(email string, scene Scene) string {
	return fmt.Sprintf("email:lock:%s:%s", scene, email)
}

func emailDailyKey(email string) string {
	return fmt.Sprintf("email:daily:%s:%s", email, time.Now().Format("20060102"))
}
