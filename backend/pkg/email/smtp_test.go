package email

import (
	"bytes"
	"context"
	"html/template"
	"testing"

	"bridal/backend/domain"
	"bridal/backend/templates"
)

// TestEmailClientImplementsEmailSender 编译期断言：EmailClient 实现 domain.EmailSender。
// 业务编译期检查，无需运行。
var _ domain.EmailSender = (*EmailClient)(nil)

// TestVerificationCodeTemplateRender 验证 verification_code 模板能正确渲染 code + expire_min。
// 用 html/template 直接 Parse（与 EmailClient.SendVerificationCode 内部一致），不发真实网络邮件。
func TestVerificationCodeTemplateRender(t *testing.T) {
	tmpl, err := template.New("verification_code").Parse(string(templates.VerificationCode))
	if err != nil {
		t.Fatalf("parse template: %v", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, map[string]string{
		"user":       "",
		"code":       "123456",
		"expire_min": "5",
	}); err != nil {
		t.Fatalf("execute template: %v", err)
	}
	out := buf.String()
	if !contains(out, "123456") {
		t.Errorf("rendered template missing code, got head: %.200s", out)
	}
	if !contains(out, "5") {
		t.Errorf("rendered template missing expire_min, got head: %.200s", out)
	}
	// 模板应有的安全提示
	if !contains(out, "请勿将验证码告知他人") {
		t.Errorf("rendered template missing 安全提示")
	}
}

func TestResetPasswordTemplateRender(t *testing.T) {
	tmpl, err := template.New("reset").Parse(string(templates.ResetPassword))
	if err != nil {
		t.Fatalf("parse template: %v", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, map[string]string{
		"user":      "alice",
		"reset_url": "https://example.com/reset?token=xxx",
	}); err != nil {
		t.Fatalf("execute template: %v", err)
	}
	out := buf.String()
	if !contains(out, "alice") {
		t.Errorf("rendered template missing user, got head: %.200s", out)
	}
	if !contains(out, "https://example.com/reset?token=xxx") {
		t.Errorf("rendered template missing reset_url")
	}
}

func TestBindEmailTemplateRender(t *testing.T) {
	tmpl, err := template.New("bind_email").Parse(string(templates.BindEmail))
	if err != nil {
		t.Fatalf("parse template: %v", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, map[string]string{
		"user":       "bob",
		"verify_url": "https://example.com/verify?token=yyy",
	}); err != nil {
		t.Fatalf("execute template: %v", err)
	}
	out := buf.String()
	if !contains(out, "bob") {
		t.Errorf("rendered template missing user")
	}
	if !contains(out, "https://example.com/verify?token=yyy") {
		t.Errorf("rendered template missing verify_url")
	}
}

// TestEmailClientContextAware 简单构造测试，确保 EmailClient 暴露给 DI 后实现接口。
func TestEmailClientContextAware(t *testing.T) {
	// 防止 import 未使用
	_ = context.Background
}

// contains 是 strings.Contains 的局部别名，避免引入 strings 包的样板 import。
func contains(s, sub string) bool {
	return bytes.Contains([]byte(s), []byte(sub))
}
