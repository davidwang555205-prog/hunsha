package sms

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"bridal/backend/config"
	"bridal/backend/errcode"
)

// mockSender 记录调用次数与最后一次验证码，可注入失败。
type mockSender struct {
	err       error
	lastCode  string
	callCount int
}

func (m *mockSender) Send(_ context.Context, _ string, code string) error {
	m.callCount++
	m.lastCode = code
	return m.err
}

func newTestCodeService(t *testing.T) (*CodeService, *miniredis.Miniredis, config.SMSConfig) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run() error = %v", err)
	}
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	cfg := config.SMSConfig{CodeExpireMin: 5, SendIntervalSec: 60, DailyLimit: 10}
	return NewCodeService(rdb), mr, cfg
}

func TestGenerateCode(t *testing.T) {
	seen := make(map[string]struct{})
	for i := 0; i < 1000; i++ {
		c := generateCode()
		if len(c) != 6 {
			t.Fatalf("code length = %d, want 6 (code=%s)", len(c), c)
		}
		for _, r := range c {
			if r < '0' || r > '9' {
				t.Fatalf("code contains non-digit: %s", c)
			}
		}
		seen[c] = struct{}{}
	}
	// 1000 次生成应有充分分散（避免退化成固定值）
	if len(seen) < 900 {
		t.Fatalf("code not random enough, distinct = %d", len(seen))
	}
}

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"13800138000":    "+8613800138000",
		"+8613800138000": "+8613800138000",
		"8613800138000":  "+8613800138000",
		"013800138000":   "+8613800138000",
		" 13800138000 ":  "+8613800138000",
	}
	for in, want := range cases {
		if got := normalizePhone(in); got != want {
			t.Errorf("normalizePhone(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCodeService_Send_Success(t *testing.T) {
	svc, mr, cfg := newTestCodeService(t)
	ctx := context.Background()
	sender := &mockSender{}

	if err := svc.Send(ctx, "13800138000", SceneRegister, sender, cfg); err != nil {
		t.Fatalf("Send error = %v", err)
	}
	if sender.callCount != 1 {
		t.Fatalf("sender.callCount = %d, want 1", sender.callCount)
	}
	if sender.lastCode == "" {
		t.Fatal("lastCode empty")
	}
	stored, err := mr.Get(codeKey("13800138000", SceneRegister))
	if err != nil || stored != sender.lastCode {
		t.Fatalf("stored code = %q, err = %v, want %q", stored, err, sender.lastCode)
	}
}

func TestCodeService_Send_TooFrequent(t *testing.T) {
	svc, _, cfg := newTestCodeService(t)
	ctx := context.Background()
	sender := &mockSender{}

	if err := svc.Send(ctx, "13800138000", SceneRegister, sender, cfg); err != nil {
		t.Fatalf("first Send error = %v", err)
	}
	err := svc.Send(ctx, "13800138000", SceneRegister, sender, cfg)
	if !errors.Is(err, errcode.ErrSmsSendTooFrequent) {
		t.Fatalf("second Send error = %v, want ErrSmsSendTooFrequent", err)
	}
	if sender.callCount != 1 {
		t.Fatalf("sender.callCount = %d, want 1 (should not call sender on rate-limited)", sender.callCount)
	}
}

func TestCodeService_Send_FailureRollbackLock(t *testing.T) {
	svc, _, cfg := newTestCodeService(t)
	ctx := context.Background()
	failSender := &mockSender{err: errcode.ErrSmsSendFailed}
	if err := svc.Send(ctx, "13800138000", SceneRegister, failSender, cfg); !errors.Is(err, errcode.ErrSmsSendFailed) {
		t.Fatalf("first Send error = %v, want ErrSmsSendFailed", err)
	}
	okSender := &mockSender{}
	if err := svc.Send(ctx, "13800138000", SceneRegister, okSender, cfg); err != nil {
		t.Fatalf("retry Send error = %v (lock should have been rolled back)", err)
	}
	if okSender.callCount != 1 {
		t.Fatalf("okSender.callCount = %d, want 1", okSender.callCount)
	}
}

func TestCodeService_Verify_Success(t *testing.T) {
	svc, _, cfg := newTestCodeService(t)
	ctx := context.Background()
	sender := &mockSender{}
	_ = svc.Send(ctx, "13800138000", SceneRegister, sender, cfg)

	if err := svc.Verify(ctx, "13800138000", SceneRegister, sender.lastCode); err != nil {
		t.Fatalf("Verify error = %v", err)
	}
}

func TestCodeService_Verify_OneTimeConsume(t *testing.T) {
	svc, _, cfg := newTestCodeService(t)
	ctx := context.Background()
	sender := &mockSender{}
	_ = svc.Send(ctx, "13800138000", SceneRegister, sender, cfg)

	if err := svc.Verify(ctx, "13800138000", SceneRegister, sender.lastCode); err != nil {
		t.Fatalf("first Verify error = %v", err)
	}
	err := svc.Verify(ctx, "13800138000", SceneRegister, sender.lastCode)
	if !errors.Is(err, errcode.ErrSmsCodeInvalid) {
		t.Fatalf("second Verify error = %v, want ErrSmsCodeInvalid", err)
	}
}

func TestCodeService_Verify_Invalid(t *testing.T) {
	svc, _, cfg := newTestCodeService(t)
	ctx := context.Background()
	sender := &mockSender{}
	_ = svc.Send(ctx, "13800138000", SceneRegister, sender, cfg)

	err := svc.Verify(ctx, "13800138000", SceneRegister, "000000")
	if !errors.Is(err, errcode.ErrSmsCodeInvalid) {
		t.Fatalf("Verify wrong code error = %v, want ErrSmsCodeInvalid", err)
	}
}

func TestCodeService_Verify_Expired(t *testing.T) {
	svc, mr, cfg := newTestCodeService(t)
	ctx := context.Background()
	sender := &mockSender{}
	_ = svc.Send(ctx, "13800138000", SceneRegister, sender, cfg)

	mr.FastForward(6 * time.Minute)

	err := svc.Verify(ctx, "13800138000", SceneRegister, sender.lastCode)
	if !errors.Is(err, errcode.ErrSmsCodeInvalid) {
		t.Fatalf("Verify expired code error = %v, want ErrSmsCodeInvalid", err)
	}
}

func TestScene_Valid(t *testing.T) {
	if !SceneRegister.Valid() || !SceneResetPassword.Valid() {
		t.Fatal("register/reset_password scenes should be valid")
	}
	if Scene("bogus").Valid() {
		t.Fatal("bogus scene should be invalid")
	}
}
