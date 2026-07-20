package verify

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"bridal/backend/domain"
	"bridal/backend/errcode"
)

// mockSender 记录 SendVerificationCode 调用次数与参数（不用真 SMTP）。
type mockSender struct {
	mu          sync.Mutex
	calls       int
	lastCode    string
	lastEmail   string
	lastExpire  int
	shouldError error
}

func (m *mockSender) SendResetPasswordEmail(context.Context, string, string, string) error {
	return errors.New("not implemented")
}
func (m *mockSender) SendBindEmailVerification(context.Context, string, string, string) error {
	return errors.New("not implemented")
}
func (m *mockSender) SendVerificationCode(_ context.Context, to, _ string, code string, expire int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	m.lastCode = code
	m.lastEmail = to
	m.lastExpire = expire
	return m.shouldError
}

func newTestEmailChannel(t *testing.T, debug bool, sender domain.EmailSender) (*EmailChannel, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run() error = %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	ch := NewEmailChannel(rdb, EmailChannelConfig{
		CodeExpireMin:   5,
		SendIntervalSec: 60,
		DailyLimit:      10,
		Debug:           debug,
		Sender:          sender,
	})
	return ch, mr
}

// TestGenerateEmailCode 1000 次生成 6 位数字，distinct 数量充足。
func TestGenerateEmailCode(t *testing.T) {
	seen := make(map[string]struct{}, 1000)
	for i := 0; i < 1000; i++ {
		c := generateEmailCode()
		if len(c) != 6 {
			t.Fatalf("code %q len = %d, want 6", c, len(c))
		}
		for _, r := range c {
			if r < '0' || r > '9' {
				t.Fatalf("code %q contains non-digit", c)
			}
		}
		seen[c] = struct{}{}
	}
	if len(seen) < 900 {
		t.Errorf("distinct codes = %d, want >= 900", len(seen))
	}
}

// TestEmailChannel_Send_Success 发送成功 → sender 收到 code + Redis 存码。
func TestEmailChannel_Send_Success(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "User@Example.com", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if m.calls != 1 {
		t.Errorf("sender calls = %d, want 1", m.calls)
	}
	if len(m.lastCode) != 6 {
		t.Errorf("sender lastCode = %q, want 6 digits", m.lastCode)
	}
	if m.lastEmail != "user@example.com" {
		t.Errorf("sender lastEmail = %q, want lower-case normalized", m.lastEmail)
	}
}

// TestEmailChannel_Send_TooFrequent 60s 间隔：第二次返 ErrEmailCodeSendTooFrequent。
func TestEmailChannel_Send_TooFrequent(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("first SendCode: %v", err)
	}
	err := ch.SendCode(context.Background(), "a@x.com", SceneRegister)
	if !errors.Is(err, errcode.ErrEmailCodeSendTooFrequent) {
		t.Errorf("second SendCode err = %v, want ErrEmailCodeSendTooFrequent", err)
	}
	if m.calls != 1 {
		t.Errorf("sender should not be called on lock fail, calls = %d", m.calls)
	}
}

// TestEmailChannel_Send_FailureRollbackLock 发送失败后能立刻重试（lock 回滚）。
func TestEmailChannel_Send_FailureRollbackLock(t *testing.T) {
	m := &mockSender{shouldError: errors.New("smtp down")}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); !errors.Is(err, errcode.ErrEmailCodeSendFailed) {
		t.Fatalf("first SendCode err = %v, want ErrEmailCodeSendFailed", err)
	}
	// 立刻再发：lock 应已回滚，能进入流程（但因 sender 仍失败，返 ErrEmailCodeSendFailed）
	err := ch.SendCode(context.Background(), "a@x.com", SceneRegister)
	if !errors.Is(err, errcode.ErrEmailCodeSendFailed) {
		t.Errorf("retry SendCode err = %v, want ErrEmailCodeSendFailed (lock should have rolled back)", err)
	}
}

// TestEmailChannel_Verify_Success 正确码校验成功。
func TestEmailChannel_Verify_Success(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, m.lastCode); err != nil {
		t.Errorf("Verify correct code: %v", err)
	}
}

// TestEmailChannel_Verify_OneTimeConsume 校验成功后第二次使用失败。
func TestEmailChannel_Verify_OneTimeConsume(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, m.lastCode); err != nil {
		t.Fatalf("first Verify: %v", err)
	}
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, m.lastCode); !errors.Is(err, errcode.ErrEmailCodeInvalid) {
		t.Errorf("second Verify err = %v, want ErrEmailCodeInvalid (one-time consume)", err)
	}
}

// TestEmailChannel_Verify_InvalidCode 错码返 ErrEmailCodeInvalid。
func TestEmailChannel_Verify_InvalidCode(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, "000000"); !errors.Is(err, errcode.ErrEmailCodeInvalid) {
		t.Errorf("Verify wrong code err = %v, want ErrEmailCodeInvalid", err)
	}
}

// TestEmailChannel_Verify_Expired TTL 过期后验证失败。
func TestEmailChannel_Verify_Expired(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	mr.FastForward(6 * time.Minute) // 超过 5 分钟 TTL
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, m.lastCode); !errors.Is(err, errcode.ErrEmailCodeInvalid) {
		t.Errorf("Verify after TTL err = %v, want ErrEmailCodeInvalid", err)
	}
}

// TestEmailChannel_SceneIsolation register / reset_password key 隔离。
func TestEmailChannel_SceneIsolation(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("SendCode register: %v", err)
	}
	regCode := m.lastCode

	// reset_password 应能独立发码（不被 register 占用）
	if err := ch.SendCode(context.Background(), "a@x.com", SceneResetPassword); err != nil {
		t.Fatalf("SendCode reset_password: %v", err)
	}
	rpCode := m.lastCode

	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, regCode); err != nil {
		t.Errorf("Verify register code after reset_password sent: %v", err)
	}
	if err := ch.Verify(context.Background(), "a@x.com", SceneResetPassword, rpCode); err != nil {
		t.Errorf("Verify reset_password code: %v", err)
	}
}

// TestEmailChannel_EmailNormalization 大小写与首尾空格归一。
func TestEmailChannel_EmailNormalization(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "  A@X.COM  ", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	// Verify 用归一后的 email（小写、无空格）
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, m.lastCode); err != nil {
		t.Errorf("Verify normalized email: %v", err)
	}
	if m.lastEmail != "a@x.com" {
		t.Errorf("sender lastEmail = %q, want normalized a@x.com", m.lastEmail)
	}
}

// TestEmailChannel_DebugMode Debug 写固定 123456 + sender 不调用。
func TestEmailChannel_DebugMode(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, true, m)
	defer mr.Close()

	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if m.calls != 0 {
		t.Errorf("Debug mode should not call sender, calls = %d", m.calls)
	}
	if err := ch.Verify(context.Background(), "a@x.com", SceneRegister, "123456"); err != nil {
		t.Errorf("Verify 123456 in debug mode: %v", err)
	}
}

// TestEmailChannel_Send_DailyLimit 日上限（默认 10）：第 11 次返频繁。
func TestEmailChannel_Send_DailyLimit(t *testing.T) {
	m := &mockSender{}
	ch, mr := newTestEmailChannel(t, false, m)
	defer mr.Close()

	// 第一次成功占 60s lock；通过 FastForward 跳过间隔，但 daily 计数累加
	if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
		t.Fatalf("first SendCode: %v", err)
	}
	for i := 0; i < 9; i++ {
		mr.FastForward(61 * time.Second)
		if err := ch.SendCode(context.Background(), "a@x.com", SceneRegister); err != nil {
			t.Fatalf("iter %d SendCode: %v", i, err)
		}
	}
	// 累计 10 次，下一次超日限
	mr.FastForward(61 * time.Second)
	err := ch.SendCode(context.Background(), "a@x.com", SceneRegister)
	if !errors.Is(err, errcode.ErrEmailCodeSendTooFrequent) {
		t.Errorf("11th SendCode err = %v, want ErrEmailCodeSendTooFrequent", err)
	}
}
