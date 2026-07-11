package bridalauth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestVerifyPasswordNodeCompat 验证 Go scrypt 实现能与 Node 生成的 hash 互通。
// 向量由 Node crypto.scryptSync("admin123", salt_hex, 64) 生成，参数 N=16384,r=8,p=1（Node 默认）。
func TestVerifyPasswordNodeCompat(t *testing.T) {
	const (
		password = "admin123"
		salt     = "0123456789abcdef0123456789abcdef"
		// Node 生成的 hash（64 字节 hex）。
		nodeHash = "b73d71a9980ff5c0b357becdf2a10bba8841da7a1ad820ce28e15f2b8622fcdb8942397c8791c6c12807bb5afbd4a9ec855dfa0207d3e4b753a103246e03c0ee"
	)

	if !VerifyPassword(password, salt, nodeHash) {
		t.Fatal("Go VerifyPassword 应能验证 Node 生成的 scrypt hash，但验证失败")
	}
	// 错误密码应失败
	if VerifyPassword("wrong-password", salt, nodeHash) {
		t.Fatal("错误密码不应通过验证")
	}
}

// TestHashPasswordRoundTrip 自生成 hash 后应能验证通过。
func TestHashPasswordRoundTrip(t *testing.T) {
	hash, salt, err := HashPassword("user123", "")
	if err != nil {
		t.Fatalf("HashPassword error: %v", err)
	}
	if len(salt) != 32 { // 16 字节 hex = 32 字符
		t.Fatalf("salt 长度应为 32 hex 字符，实际 %d", len(salt))
	}
	if len(hash) != 128 { // 64 字节 hex = 128 字符
		t.Fatalf("hash 长度应为 128 hex 字符，实际 %d", len(hash))
	}
	if !VerifyPassword("user123", salt, hash) {
		t.Fatal("自生成的 hash 应能验证通过")
	}
}

// TestHashPasswordFixedSalt 与 Node 一致：传入固定 salt 时，相同 password+salt 产生相同 hash。
func TestHashPasswordFixedSalt(t *testing.T) {
	hash1, _, err := HashPassword("admin123", "0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatalf("HashPassword error: %v", err)
	}
	if hash1 != "b73d71a9980ff5c0b357becdf2a10bba8841da7a1ad820ce28e15f2b8622fcdb8942397c8791c6c12807bb5afbd4a9ec855dfa0207d3e4b753a103246e03c0ee" {
		t.Fatalf("固定 salt 下 Go 应产生与 Node 相同的 hash，实际 %s", hash1)
	}
}

// TestTokenRoundTrip token 签发后应能正确解析出 userId。
func TestTokenRoundTrip(t *testing.T) {
	secret := "test-secret"
	uid := uuid.New()
	now := time.Now()

	token := CreateToken(uid, secret, now)
	if token == "" {
		t.Fatal("token 不应为空")
	}

	parsed, err := ParseToken(token, secret, now)
	if err != nil {
		t.Fatalf("ParseToken error: %v", err)
	}
	if parsed != uid {
		t.Fatalf("解析出的 userId 应为 %s，实际 %s", uid, parsed)
	}
}

// TestTokenExpired 过期 token 应解析失败。
func TestTokenExpired(t *testing.T) {
	secret := "test-secret"
	uid := uuid.New()
	past := time.Now().Add(-25 * time.Hour) // 25 小时前签发，已过期

	token := CreateToken(uid, secret, past)
	_, err := ParseToken(token, secret, time.Now())
	if err == nil {
		t.Fatal("过期 token 应解析失败")
	}
}

// TestTokenWrongSecret 密钥错误应解析失败（签名不匹配）。
func TestTokenWrongSecret(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	token := CreateToken(uid, "correct-secret", now)

	_, err := ParseToken(token, "wrong-secret", now)
	if err == nil {
		t.Fatal("密钥错误应解析失败")
	}
}

// TestTokenTampered 篡改 payload 应解析失败。
func TestTokenTampered(t *testing.T) {
	secret := "test-secret"
	uid := uuid.New()
	now := time.Now()
	token := CreateToken(uid, secret, now)

	// 篡改 payload 部分（第一段），保留签名。
	for i := 0; i < len(token); i++ {
		if token[i] == '.' {
			// 把 payload 第一个字符替换
			tampered := "X" + token[1:]
			_, err := ParseToken(tampered, secret, now)
			if err == nil {
				t.Fatal("篡改 payload 后应解析失败")
			}
			break
		}
	}
}

// TestNormalizeDailyImageLimit 与 Node normalizeDailyImageLimit 行为一致。
func TestNormalizeDailyImageLimit(t *testing.T) {
	cases := []struct {
		value    int
		fallback int
		want     int
	}{
		{20, 20, 20},
		{0, 20, 0},
		{1001, 20, 1000}, // 超上限截断
		{-5, 20, 20},     // 负数用 fallback
		{50, 20, 50},
	}
	for _, c := range cases {
		got := NormalizeDailyImageLimit(c.value, c.fallback)
		if got != c.want {
			t.Errorf("NormalizeDailyImageLimit(%d, %d) = %d, want %d", c.value, c.fallback, got, c.want)
		}
	}
}

// TestValidUsername 与 Node username 正则一致。
func TestValidUsername(t *testing.T) {
	valid := []string{"admin", "wang", "user_01", "a.b-c", "abc123"}
	invalid := []string{"ab", "AB", "中文", "a!b", ""}
	for _, u := range valid {
		if !ValidUsername(u) {
			t.Errorf("ValidUsername(%q) 应为 true", u)
		}
	}
	for _, u := range invalid {
		if ValidUsername(u) {
			t.Errorf("ValidUsername(%q) 应为 false", u)
		}
	}
}
