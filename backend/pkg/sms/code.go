package sms

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/binary"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"bridal/backend/config"
	"bridal/backend/errcode"
)

// Scene 短信验证码业务场景（不同场景的验证码隔离存储与限流）。
type Scene string

const (
	SceneRegister      Scene = "register"
	SceneResetPassword Scene = "reset_password"
)

// ValidScene 校验场景合法性。
func (s Scene) Valid() bool {
	switch s {
	case SceneRegister, SceneResetPassword:
		return true
	}
	return false
}

// CodeService 验证码服务：生成、限流、存储、校验（依赖 redis）。
//
// 限流策略：
//   - 同手机号同场景 60s 内仅可发一次（SetNX 锁，发送失败回滚允许重试）
//   - 同手机号每日上限 daily_limit 次（默认 10）
//   - 验证码 TTL code_expire_min 分钟（默认 5），校验一次性消费（GetDel）
type CodeService struct {
	redis *redis.Client
}

// NewCodeService 构造验证码服务（配置运行时动态传入 Send，不缓存）。
func NewCodeService(rdb *redis.Client) *CodeService {
	return &CodeService{redis: rdb}
}

// Send 限流校验 -> 生成验证码 -> 调 Sender 发送 -> 存储（发送成功才落码）。
// cfg 运行时传入（admin 配置动态读取），含限流参数（间隔/日上限/有效期）。
func (s *CodeService) Send(ctx context.Context, phone string, scene Scene, sender Sender, cfg config.SMSConfig) error {
	lockKey := lockKey(phone, scene)
	// SetNX 原子占锁，防并发轰炸（60s 间隔）
	ok, err := s.redis.SetNX(ctx, lockKey, 1, time.Duration(sendIntervalSec(cfg))*time.Second).Result()
	if err != nil {
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if !ok {
		return errcode.ErrSmsSendTooFrequent
	}

	// 每日上限计数（发送前 Incr，失败不回滚，防恶意触发消耗配额）
	dailyKey := dailyKey(phone)
	cnt, err := s.redis.Incr(ctx, dailyKey).Result()
	if err != nil {
		s.redis.Del(ctx, lockKey)
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if cnt == 1 {
		s.redis.Expire(ctx, dailyKey, 25*time.Hour)
	}
	if cnt > int64(dailyLimit(cfg)) {
		// 超日上限：保留锁防继续刷，不回滚 daily
		return errcode.ErrSmsSendTooFrequent
	}

	code := generateCode()
	if err := sender.Send(ctx, phone, code); err != nil {
		// 发送失败：回滚间隔锁允许用户重试
		s.redis.Del(ctx, lockKey)
		return err
	}

	// 发送成功：存储验证码（TTL = code_expire_min）
	if err := s.redis.Set(ctx, codeKey(phone, scene), code, time.Duration(codeExpireMin(cfg))*time.Minute).Err(); err != nil {
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	return nil
}

// SendDevCode dev 模式（Debug=true）：限流 + 存固定验证码 "123456"，不调 sender（不发真实短信）。
// 供开发/测试环境使用，Verify 仍走正常校验（用户输 123456 通过）。
func (s *CodeService) SendDevCode(ctx context.Context, phone string, scene Scene, cfg config.SMSConfig) error {
	lockKey := lockKey(phone, scene)
	ok, err := s.redis.SetNX(ctx, lockKey, 1, time.Duration(sendIntervalSec(cfg))*time.Second).Result()
	if err != nil {
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if !ok {
		return errcode.ErrSmsSendTooFrequent
	}
	dailyKey := dailyKey(phone)
	cnt, err := s.redis.Incr(ctx, dailyKey).Result()
	if err != nil {
		s.redis.Del(ctx, lockKey)
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if cnt == 1 {
		s.redis.Expire(ctx, dailyKey, 25*time.Hour)
	}
	if cnt > int64(dailyLimit(cfg)) {
		return errcode.ErrSmsSendTooFrequent
	}
	return s.redis.Set(ctx, codeKey(phone, scene), "123456", time.Duration(codeExpireMin(cfg))*time.Minute).Err()
}

// Verify 校验验证码（一次性消费 GetDel，不匹配或过期返 ErrSmsCodeInvalid）。
func (s *CodeService) Verify(ctx context.Context, phone string, scene Scene, code string) error {
	val, err := s.redis.GetDel(ctx, codeKey(phone, scene)).Result()
	if err != nil {
		if err == redis.Nil {
			return errcode.ErrSmsCodeInvalid
		}
		return errcode.ErrDatabaseOperation.Wrap(err)
	}
	if val != code {
		return errcode.ErrSmsCodeInvalid
	}
	return nil
}

func sendIntervalSec(cfg config.SMSConfig) int {
	if cfg.SendIntervalSec <= 0 {
		return 60
	}
	return cfg.SendIntervalSec
}

func dailyLimit(cfg config.SMSConfig) int {
	if cfg.DailyLimit <= 0 {
		return 10
	}
	return cfg.DailyLimit
}

func codeExpireMin(cfg config.SMSConfig) int {
	if cfg.CodeExpireMin <= 0 {
		return 5
	}
	return cfg.CodeExpireMin
}

// generateCode 用 crypto/rand 生成 6 位数字验证码（前导零补齐）。
func generateCode() string {
	var b [4]byte
	_, _ = cryptorand.Read(b[:])
	n := binary.BigEndian.Uint32(b[:])
	return fmt.Sprintf("%06d", n%1000000)
}

func codeKey(phone string, scene Scene) string {
	return fmt.Sprintf("sms:code:%s:%s", scene, phone)
}

func lockKey(phone string, scene Scene) string {
	return fmt.Sprintf("sms:lock:%s:%s", scene, phone)
}

func dailyKey(phone string) string {
	return fmt.Sprintf("sms:daily:%s:%s", phone, time.Now().Format("20060102"))
}
