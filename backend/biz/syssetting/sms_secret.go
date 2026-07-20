package syssetting

import (
	"crypto/sha256"
	"strings"
)

// SMS 配置在 system_settings 表的 key。
const smsSettingKey = "sms"

// SMS SecretKey 加密后的字段名（明文不出库，与 redfox secret 同款 AES-GCM）。
const smsEncryptedSecretKeyField = "encrypted_secret_key"

// newSmsKeyCipher 用 session_secret 派生 SMS 专用 AES-256 密钥（派生串与 redfox 隔离）。
func newSmsKeyCipher(sessionSecret string) redfoxKeyCipher {
	return redfoxKeyCipher{key: sha256.Sum256([]byte("bridal:sms-secret-key:" + sessionSecret))}
}

// maskSmsSecret 脱敏 SecretKey 供 admin 页面回显（****后4位）。
func maskSmsSecret(secret string) string {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return ""
	}
	if len(secret) <= 4 {
		return "已配置"
	}
	return "****" + secret[len(secret)-4:]
}

// toInt 从 system_settings JSON（数字反序列化为 float64）取 int。
func toInt(v any) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case int64:
		return int(n), true
	}
	return 0, false
}
