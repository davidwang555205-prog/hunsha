package bridalauth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/scrypt"
)

// scrypt 参数与 Node 版完全对齐（server/db.mjs hashPassword）：
// Node crypto.scryptSync(password, salt, 64) 默认 N=16384, r=8, p=1，keyLen=64。
// salt 为 16 字节随机 hex（32 字符），hash 为 64 字节 hex（128 字符）。
// 存量 Node 用户可直接用本函数验证。
const (
	scryptN      = 16384
	scryptR      = 8
	scryptP      = 1
	scryptKeyLen = 64
	saltBytes    = 16
)

// HashPassword 用 scrypt 加密密码，返回 {salt, hash}（均为 hex 字符串）。
// 与 Node hashPassword(password, salt?) 行为一致：salt 为空时随机生成。
func HashPassword(password string, salt string) (hash string, outSalt string, err error) {
	if salt == "" {
		b := make([]byte, saltBytes)
		if _, err := rand.Read(b); err != nil {
			return "", "", fmt.Errorf("generate salt: %w", err)
		}
		salt = hex.EncodeToString(b)
	}
	// Node 的 salt 是 hex 字符串，scryptSync 直接以该字符串作为 salt 输入（字节即 utf8 编码的 hex 串）。
	// Go 这里保持一致：salt 原样作为字节传入，不做 hex decode。
	key, err := scrypt.Key([]byte(password), []byte(salt), scryptN, scryptR, scryptP, scryptKeyLen)
	if err != nil {
		return "", "", fmt.Errorf("scrypt key: %w", err)
	}
	return hex.EncodeToString(key), salt, nil
}

// VerifyPassword 用给定 salt 重算 hash 并常数时间比较，与 Node verifyPassword 一致。
func VerifyPassword(password, salt, expectedHash string) bool {
	if salt == "" || expectedHash == "" {
		return false
	}
	hash, _, err := HashPassword(password, salt)
	if err != nil {
		return false
	}
	// hex 编码后字节长度固定，subtle.ConstantTimeCompare 要求等长。
	return subtle.ConstantTimeCompare([]byte(hash), []byte(expectedHash)) == 1
}
