package syssetting

import (
	"crypto/sha256"
	"strings"
)

// SMTP 配置在 system_settings 表的 key。
const smtpSettingKey = "smtp"

// SMTP 密码加密后的字段名（明文不出库，与 redfox/sms 同款 AES-GCM）。
const smtpEncryptedPasswordField = "encrypted_password"

// newSmtpKeyCipher 用 session_secret 派生 SMTP 专用 AES-256 密钥（派生串与 redfox/sms 隔离）。
func newSmtpKeyCipher(sessionSecret string) redfoxKeyCipher {
	return redfoxKeyCipher{key: sha256.Sum256([]byte("bridal:smtp-password:" + sessionSecret))}
}

// maskSmtpPassword 脱敏 SMTP 密码供 admin 页面回显（****后4位）。
func maskSmtpPassword(pw string) string {
	pw = strings.TrimSpace(pw)
	if pw == "" {
		return ""
	}
	if len(pw) <= 4 {
		return "已配置"
	}
	return "****" + pw[len(pw)-4:]
}
