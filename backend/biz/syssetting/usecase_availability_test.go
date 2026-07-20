package syssetting

import (
	"testing"

	"bridal/backend/config"
)

func TestIsSMSConfigComplete(t *testing.T) {
	full := config.SMSConfig{
		Enabled:    true,
		SecretID:   "AKIDxxxx",
		SecretKey:  "secret",
		AppID:      "1400000000",
		SignName:   "签名",
		TemplateID: "100001",
		Region:     "ap-guangzhou",
	}

	clearOne := func(mod func(*config.SMSConfig)) config.SMSConfig {
		c := full
		mod(&c)
		return c
	}

	cases := []struct {
		name string
		cfg  config.SMSConfig
		want bool
	}{
		{"全字段完整", full, true},
		{"Enabled=false", clearOne(func(c *config.SMSConfig) { c.Enabled = false }), false},
		{"SecretID 空字符串", clearOne(func(c *config.SMSConfig) { c.SecretID = "" }), false},
		{"SecretID 空白字符", clearOne(func(c *config.SMSConfig) { c.SecretID = "   " }), false},
		{"SecretKey 空", clearOne(func(c *config.SMSConfig) { c.SecretKey = "" }), false},
		{"AppID 空", clearOne(func(c *config.SMSConfig) { c.AppID = "" }), false},
		{"SignName 空", clearOne(func(c *config.SMSConfig) { c.SignName = "" }), false},
		{"TemplateID 空", clearOne(func(c *config.SMSConfig) { c.TemplateID = "" }), false},
		{"Region 空", clearOne(func(c *config.SMSConfig) { c.Region = "" }), false},
		{"全字段空（零值）", config.SMSConfig{}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := isSMSConfigComplete(tc.cfg)
			if got != tc.want {
				t.Errorf("isSMSConfigComplete() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsSMTPConfigComplete(t *testing.T) {
	full := config.SMTP{
		Host:     "smtp.example.com",
		Port:     "587",
		From:     "noreply@example.com",
		Username: "user",
		Password: "pw",
		TLS:      false,
	}

	clearOne := func(mod func(*config.SMTP)) config.SMTP {
		c := full
		mod(&c)
		return c
	}

	cases := []struct {
		name string
		cfg  config.SMTP
		want bool
	}{
		{"全字段完整（认证 SMTP）", full, true},
		{"无认证 SMTP（User/Password 都空）", clearOne(func(c *config.SMTP) {
			c.Username = ""
			c.Password = ""
		}), true},
		{"Host 空", clearOne(func(c *config.SMTP) { c.Host = "" }), false},
		{"Port 空", clearOne(func(c *config.SMTP) { c.Port = "" }), false},
		{"From 空", clearOne(func(c *config.SMTP) { c.From = "" }), false},
		{"Host 空白字符", clearOne(func(c *config.SMTP) { c.Host = "   " }), false},
		{"仅 Username 填（Password 空）", clearOne(func(c *config.SMTP) { c.Password = "" }), false},
		{"仅 Password 填（Username 空）", clearOne(func(c *config.SMTP) { c.Username = "" }), false},
		{"Username 空白字符", clearOne(func(c *config.SMTP) { c.Username = "   " }), false},
		{"全字段空（零值）", config.SMTP{}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := isSMTPConfigComplete(tc.cfg)
			if got != tc.want {
				t.Errorf("isSMTPConfigComplete() = %v, want %v", got, tc.want)
			}
		})
	}
}
