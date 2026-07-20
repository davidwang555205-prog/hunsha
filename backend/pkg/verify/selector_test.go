package verify

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"

	"bridal/backend/errcode"
)

// mockChannel 记录调用次数与参数。
type mockChannel struct {
	mu          sync.Mutex
	name        ChannelName
	sendCalls   int
	verifyCalls int
	lastDest    string
	lastCode    string
	sendErr     error
	verifyErr   error
}

func (m *mockChannel) Name() ChannelName { return m.name }
func (m *mockChannel) SendCode(_ context.Context, dest string, _ Scene) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sendCalls++
	m.lastDest = dest
	return m.sendErr
}
func (m *mockChannel) Verify(_ context.Context, dest string, _ Scene, code string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verifyCalls++
	m.lastDest = dest
	m.lastCode = code
	return m.verifyErr
}

func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func fixedAvail(smsOK, emailOK bool) AvailabilityFunc {
	return func(_ context.Context) (Availability, error) {
		return Availability{SMS: smsOK, Email: emailOK}, nil
	}
}

func erroringAvail(err error) AvailabilityFunc {
	return func(_ context.Context) (Availability, error) {
		return Availability{}, err
	}
}

func newSelector(sms, email Channel, af AvailabilityFunc) *Selector {
	return NewSelector(af, sms, email, quietLogger())
}

// TestSelector_PhoneSMSOK 场景 1：SMS 可用 + phone → SMS。
func TestSelector_PhoneSMSOK(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(true, true))

	d, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, SceneRegister)
	if err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if d.Channel != ChannelSMS {
		t.Errorf("channel = %v, want sms", d.Channel)
	}
	if smsCh.sendCalls != 1 {
		t.Errorf("sms.sendCalls = %d, want 1", smsCh.sendCalls)
	}
	if emCh.sendCalls != 0 {
		t.Errorf("email should not be called, calls = %d", emCh.sendCalls)
	}
}

// TestSelector_PhoneSMSUnavailable_NoEmail 场景 2：SMS 不可用 + phone 无 email → ErrSmsUnavailableForPhone。
func TestSelector_PhoneSMSUnavailable_NoEmail(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(false, true))

	_, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, SceneRegister)
	if !errors.Is(err, errcode.ErrSmsUnavailableForPhone) {
		t.Errorf("err = %v, want ErrSmsUnavailableForPhone", err)
	}
	if smsCh.sendCalls != 0 || emCh.sendCalls != 0 {
		t.Errorf("no channel should be called, sms=%d email=%d", smsCh.sendCalls, emCh.sendCalls)
	}
}

// TestSelector_PhoneSMSUnavailable_HasEmail 场景 3：SMS 不可用 + phone 有 email → Email（用户选项 B 保留 phone + 补 email）。
func TestSelector_PhoneSMSUnavailable_HasEmail(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(false, true))

	d, err := sel.SendCode(context.Background(), Target{Phone: "13800138000", Email: "u@x.com"}, SceneRegister)
	if err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if d.Channel != ChannelEmail {
		t.Errorf("channel = %v, want email (phone fallback)", d.Channel)
	}
	if smsCh.sendCalls != 0 {
		t.Errorf("sms should not be called, calls = %d", smsCh.sendCalls)
	}
	if emCh.sendCalls != 1 {
		t.Errorf("email calls = %d, want 1", emCh.sendCalls)
	}
	if emCh.lastDest != "u@x.com" {
		t.Errorf("email dest = %q, want u@x.com", emCh.lastDest)
	}
}

// TestSelector_EmailInputEvenSMSOK 场景 4：email 输入 + SMS 可用 → 仍走 Email。
func TestSelector_EmailInputEvenSMSOK(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(true, true))

	d, err := sel.SendCode(context.Background(), Target{Email: "u@x.com"}, SceneRegister)
	if err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if d.Channel != ChannelEmail {
		t.Errorf("channel = %v, want email", d.Channel)
	}
	if smsCh.sendCalls != 0 {
		t.Errorf("sms should not be called for email target, calls = %d", smsCh.sendCalls)
	}
}

// TestSelector_DoubleUnavailable 场景 5：双不可用 → ErrVerificationChannelUnavailable。
func TestSelector_DoubleUnavailable(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(false, false))

	// phone 无 email → ErrSmsUnavailableForPhone（优先于双不可用）
	_, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, SceneRegister)
	if !errors.Is(err, errcode.ErrSmsUnavailableForPhone) {
		t.Errorf("phone no email err = %v, want ErrSmsUnavailableForPhone", err)
	}

	// email → 双不可用
	_, err = sel.SendCode(context.Background(), Target{Email: "u@x.com"}, SceneRegister)
	if !errors.Is(err, errcode.ErrVerificationChannelUnavailable) {
		t.Errorf("email target err = %v, want ErrVerificationChannelUnavailable", err)
	}

	if smsCh.sendCalls != 0 || emCh.sendCalls != 0 {
		t.Errorf("no channel should be called, sms=%d email=%d", smsCh.sendCalls, emCh.sendCalls)
	}
}

// TestSelector_SMSRuntimeFailNoEmailFallback 场景 6：SMS 实际发送失败 → 返 SMS 错误，Email 不调用。
func TestSelector_SMSRuntimeFailNoEmailFallback(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS, sendErr: errors.New("tencent 400")}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(true, true))

	_, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, SceneRegister)
	if err == nil {
		t.Fatal("expected error from SMS failure, got nil")
	}
	if !errors.Is(err, smsCh.sendErr) {
		t.Errorf("err = %v, want to wrap %v", err, smsCh.sendErr)
	}
	if smsCh.sendCalls != 1 {
		t.Errorf("sms calls = %d, want 1", smsCh.sendCalls)
	}
	if emCh.sendCalls != 0 {
		t.Errorf("email should NOT be called on SMS failure (plan §D7), calls = %d", emCh.sendCalls)
	}
}

// TestSelector_AvailabilityError 场景 7：availability 读失败 → 不调任何 channel，返内部错误。
func TestSelector_AvailabilityError(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, erroringAvail(errors.New("redis down")))

	_, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, SceneRegister)
	if err == nil {
		t.Fatal("expected error from availability failure, got nil")
	}
	if smsCh.sendCalls != 0 || emCh.sendCalls != 0 {
		t.Errorf("no channel should be called, sms=%d email=%d", smsCh.sendCalls, emCh.sendCalls)
	}
}

// TestSelector_VerifyRoutesByChannel 场景 8：Verify 不读 Availability，按 channel 路由。
func TestSelector_VerifyRoutesByChannel(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	// 即使 availability 返双不可用，Verify 仍按 channel 路由（保证发码后配置变化不失效）
	sel := newSelector(smsCh, emCh, fixedAvail(false, false))

	if err := sel.Verify(context.Background(), ChannelSMS, "13800138000", SceneRegister, "123456"); err != nil {
		t.Errorf("Verify SMS: %v", err)
	}
	if smsCh.verifyCalls != 1 {
		t.Errorf("sms verifyCalls = %d, want 1", smsCh.verifyCalls)
	}
	if emCh.verifyCalls != 0 {
		t.Errorf("email should not be called, calls = %d", emCh.verifyCalls)
	}
}

// TestSelector_InvalidSceneOrChannel 场景 9：非法 scene/channel/全空 target → ErrBadRequest。
func TestSelector_InvalidSceneOrChannel(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(true, true))

	// 非法 scene
	_, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, Scene("nope"))
	if !errors.Is(err, errcode.ErrBadRequest) {
		t.Errorf("invalid scene err = %v, want ErrBadRequest", err)
	}
	// Target 两边都空（非法）
	_, err = sel.SendCode(context.Background(), Target{}, SceneRegister)
	if !errors.Is(err, errcode.ErrBadRequest) {
		t.Errorf("empty target err = %v, want ErrBadRequest", err)
	}
	// phone + email 同时填是合法（用户选项 B 过渡态），不应返 ErrBadRequest
	_, err = sel.SendCode(context.Background(), Target{Phone: "13800138000", Email: "u@x.com"}, SceneRegister)
	if errors.Is(err, errcode.ErrBadRequest) {
		t.Errorf("phone+email both-filled should be valid, got ErrBadRequest")
	}
	// 非法 channel（Verify）
	if err := sel.Verify(context.Background(), ChannelName("carrier-pigeon"), "13800138000", SceneRegister, "123456"); !errors.Is(err, errcode.ErrBadRequest) {
		t.Errorf("invalid channel Verify err = %v, want ErrBadRequest", err)
	}
}

// TestSelector_Delivery_MaskedDestination 脱敏输出。
func TestSelector_Delivery_MaskedDestination(t *testing.T) {
	smsCh := &mockChannel{name: ChannelSMS}
	emCh := &mockChannel{name: ChannelEmail}
	sel := newSelector(smsCh, emCh, fixedAvail(true, true))

	d, err := sel.SendCode(context.Background(), Target{Phone: "13800138000"}, SceneRegister)
	if err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if d.MaskedDestination != "138****8000" {
		t.Errorf("phone masked = %q, want 138****8000", d.MaskedDestination)
	}
	if d.ExpiresInSeconds != 300 {
		t.Errorf("ExpiresInSeconds = %d, want 300", d.ExpiresInSeconds)
	}

	d, err = sel.SendCode(context.Background(), Target{Email: "alice@example.com"}, SceneRegister)
	if err != nil {
		t.Fatalf("SendCode: %v", err)
	}
	if d.MaskedDestination != "a***@example.com" {
		t.Errorf("email masked = %q, want a***@example.com", d.MaskedDestination)
	}
}
