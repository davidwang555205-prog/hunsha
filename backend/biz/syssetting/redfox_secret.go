package syssetting

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

const redfoxEncryptedAPIKeyField = "encryptedApiKey"

// redfoxKeyCipher derives a dedicated AES-256 key from the existing server
// session secret. The Redfox credential itself stays in the database, not in
// an environment file, while a database dump cannot expose it directly.
type redfoxKeyCipher struct {
	key [32]byte
}

func newRedfoxKeyCipher(sessionSecret string) redfoxKeyCipher {
	return redfoxKeyCipher{key: sha256.Sum256([]byte("bridal:redfox-api-key:" + sessionSecret))}
}

func (c redfoxKeyCipher) seal(plain string) (string, error) {
	block, err := aes.NewCipher(c.key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nil, nonce, []byte(plain), nil)
	return base64.RawURLEncoding.EncodeToString(append(nonce, sealed...)), nil
}

func (c redfoxKeyCipher) open(encoded string) (string, error) {
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode encrypted key: %w", err)
	}
	block, err := aes.NewCipher(c.key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", fmt.Errorf("encrypted key payload is too short")
	}
	plain, err := gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt encrypted key: %w", err)
	}
	return string(plain), nil
}

func maskRedfoxAPIKey(apiKey string) string {
	apiKey = strings.TrimSpace(apiKey)
	if len(apiKey) <= 4 {
		return "已配置"
	}
	return "****" + apiKey[len(apiKey)-4:]
}
