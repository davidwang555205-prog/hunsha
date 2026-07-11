package bridalauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// token 格式与 Node 版完全一致（server/index.mjs createSessionToken/parseSessionToken）：
//
//	payload = base64url( JSON{userId, expiresAt} )   // expiresAt 为毫秒时间戳
//	sig     = base64url( HMAC-SHA256(payload, secret) )
//	token   = payload + "." + sig
//
// TTL 24 小时，校验用常数时间比较。前端 localStorage 存 token，请求带 Authorization: Bearer <token>。
const tokenTTL = 24 * time.Hour

// sessionPayload 对应 Node 的 { userId, expiresAt }。
type sessionPayload struct {
	UserID    string `json:"userId"`
	ExpiresAt int64  `json:"expiresAt"` // 毫秒时间戳
}

// base64URLEncode 无 padding 的 base64url 编码（与 Node Buffer.toString("base64url") 一致）。
func base64URLEncode(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

// base64URLDecode 无 padding 的 base64url 解码。
func base64URLDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

// SignPayload 用 HMAC-SHA256 对 payload 签名，返回 base64url 编码的签名。
func SignPayload(payload string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64URLEncode(mac.Sum(nil))
}

// CreateToken 为指定 userId 签发 24h TTL 的 token。
func CreateToken(userID uuid.UUID, secret string, now time.Time) string {
	payload := sessionPayload{
		UserID:    userID.String(),
		ExpiresAt: now.Add(tokenTTL).UnixMilli(),
	}
	b, _ := json.Marshal(payload)
	encoded := base64URLEncode(b)
	return encoded + "." + SignPayload(encoded, secret)
}

// ParseToken 校验 token 签名与有效期，返回 userId。任意一步失败返回 error。
func ParseToken(token string, secret string, now time.Time) (uuid.UUID, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return uuid.Nil, fmt.Errorf("invalid token format")
	}
	encoded, sig := parts[0], parts[1]

	expectedSig := SignPayload(encoded, secret)
	// 常数时间比较，防时序攻击。
	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return uuid.Nil, fmt.Errorf("invalid token signature")
	}

	raw, err := base64URLDecode(encoded)
	if err != nil {
		return uuid.Nil, fmt.Errorf("decode payload: %w", err)
	}
	var p sessionPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return uuid.Nil, fmt.Errorf("unmarshal payload: %w", err)
	}
	if p.UserID == "" || p.ExpiresAt == 0 {
		return uuid.Nil, fmt.Errorf("invalid token payload")
	}
	if p.ExpiresAt < now.UnixMilli() {
		return uuid.Nil, fmt.Errorf("token expired")
	}

	uid, err := uuid.Parse(p.UserID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("parse user id: %w", err)
	}
	return uid, nil
}
