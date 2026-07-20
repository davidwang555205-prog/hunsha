package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"net"
	"net/smtp"
	"strings"

	"github.com/samber/do"

	"bridal/backend/biz/syssetting"
	"bridal/backend/config"
	"bridal/backend/domain"
	"bridal/backend/templates"
)

type EmailClient struct {
	*Smtp
}

func NewSMTPClient(i *do.Injector) (domain.EmailSender, error) {
	return &EmailClient{
		Smtp: NewSmtp(do.MustInvoke[*config.Config](i), do.MustInvoke[*syssetting.Usecase](i)),
	}, nil
}

func (c *EmailClient) SendResetPasswordEmail(ctx context.Context, to, username, resetURL string) error {
	tmpl, err := template.New("reset").Parse(string(templates.ResetPassword))
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, map[string]string{
		"user":      username,
		"reset_url": resetURL,
	}); err != nil {
		return err
	}
	return c.Send(ctx, "Reset Your Password", to, buf.String())
}

func (c *EmailClient) SendBindEmailVerification(ctx context.Context, to, username, verifyURL string) error {
	tmpl, err := template.New("bind_email").Parse(string(templates.BindEmail))
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, map[string]string{
		"user":       username,
		"verify_url": verifyURL,
	}); err != nil {
		return err
	}
	return c.Send(ctx, "Verify Your Email", to, buf.String())
}

type Smtp struct {
	cfg        *config.Config
	syssetting *syssetting.Usecase
}

func NewSmtp(cfg *config.Config, ss *syssetting.Usecase) *Smtp {
	return &Smtp{cfg: cfg, syssetting: ss}
}

// Send 读 system_settings 的 SMTP 配置发送（admin 前端可配，未配置回退 config.SMTP）。
func (s *Smtp) Send(ctx context.Context, subject, receiver, content string) error {
	smtpCfg, err := s.syssetting.GetSMTPConfig(ctx)
	if err != nil || smtpCfg.Host == "" {
		smtpCfg = s.cfg.SMTP
	}

	addr := net.JoinHostPort(smtpCfg.Host, smtpCfg.Port)
	c, err := dial(addr, smtpCfg.TLS)
	if err != nil {
		return err
	}
	defer c.Close()

	header := make(map[string]string)
	header["From"] = "MonkeyCode-AI" + "<" + smtpCfg.From + ">"
	header["To"] = receiver
	header["Subject"] = subject
	header["Content-Type"] = "text/html; charset=UTF-8"

	var message strings.Builder
	for k, v := range header {
		fmt.Fprintf(&message, "%s: %s\r\n", k, v)
	}
	message.WriteString("\r\n" + content)

	auth := smtp.PlainAuth(
		"",
		smtpCfg.From,
		smtpCfg.Password,
		smtpCfg.Host,
	)

	if ok, _ := c.Extension("AUTH"); ok {
		if err = c.Auth(auth); err != nil {
			log.Println("Error during AUTH", err)
			return err
		}
	}

	if err = c.Mail(smtpCfg.From); err != nil {
		return err
	}

	if err = c.Rcpt(receiver); err != nil {
		return err
	}

	w, err := c.Data()
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(message.String()))
	if err != nil {
		return err
	}

	err = w.Close()
	if err != nil {
		return err
	}

	return c.Quit()
}

// return a smtp client
func dial(addr string, useTLS bool) (*smtp.Client, error) {
	host, _, _ := net.SplitHostPort(addr)
	if useTLS {
		conn, err := tls.Dial("tcp", addr, nil)
		if err != nil {
			log.Println("Dialing Error:", err)
			return nil, err
		}
		return smtp.NewClient(conn, host)
	}
	c, err := smtp.Dial(addr)
	if err != nil {
		log.Println("Dialing Error:", err)
		return nil, err
	}
	return c, nil
}
