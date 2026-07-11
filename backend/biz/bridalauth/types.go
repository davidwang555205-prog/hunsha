package bridalauth

import (
	"regexp"
	"time"

	"github.com/google/uuid"
)

// bridal 角色与 Node 版一致：admin 不受限每日生图额度，user 受 dailyImageLimit 限制。
const (
	RoleAdmin = "admin"
	RoleUser  = "user"

	// MaxDailyImageLimit 与 Node maxDailyImageLimit 一致。
	MaxDailyImageLimit = 1000
	// DefaultDailyImageLimit 与 Node defaultDailyImageLimit 一致。
	DefaultDailyImageLimit = 20

	// UsernameRegex 与 Node handleCreateUser 校验一致：3-32 位小写字母/数字/_/./-。
	// 用于创建账号校验，login 不做 lower（与 Node 行为一致，login 精确匹配大小写敏感）。
	PasswordMinLen = 6
	PasswordMaxLen = 72
	DisplayNameMaxLen = 40
)

var usernameRegex = regexp.MustCompile(`^[a-z0-9_.-]{3,32}$`)

// ValidUsername 创建账号时校验用户名格式。
func ValidUsername(username string) bool {
	return usernameRegex.MatchString(username)
}

// NormalizeDailyImageLimit 与 Node normalizeDailyImageLimit 一致：
// 非数返回 fallback，否则 max(0, min(1000, floor(value)))。
func NormalizeDailyImageLimit(value, fallback int) int {
	if value < 0 {
		return fallback
	}
	if value > MaxDailyImageLimit {
		return MaxDailyImageLimit
	}
	return value
}

// User 是 bridal 认证域用户模型（独立于 MonkeyCode domain.User，避免耦合 team/OAuth）。
// 直接映射 ent users 表的 bridal 字段。
type User struct {
	ID                 uuid.UUID `json:"id"`
	Username           string    `json:"username"`
	DisplayName        string    `json:"displayName"`
	Role               string    `json:"role"`
	DailyImageLimit    int       `json:"dailyImageLimit"`
	PasswordSalt       string    `json:"-"` // 不对外暴露
	PasswordHash       string    `json:"-"` // 不对外暴露
	CreatedAt          time.Time `json:"createdAt"`
}

// HasUnlimitedImageGeneration 与 Node 一致：admin 不受限。
func (u *User) HasUnlimitedImageGeneration() bool {
	return u.Role == RoleAdmin
}

// PublicUser 对外暴露的用户对象，与 Node publicUser 字段完全一致：
// { id, username, displayName, role, dailyImageLimit, hasUnlimitedImageGeneration }。
type PublicUser struct {
	ID                          uuid.UUID `json:"id"`
	Username                    string    `json:"username"`
	DisplayName                 string    `json:"displayName"`
	Role                        string    `json:"role"`
	DailyImageLimit             int       `json:"dailyImageLimit"`
	HasUnlimitedImageGeneration bool      `json:"hasUnlimitedImageGeneration"`
}

// ToPublic 转成对外对象。
func (u *User) ToPublic() PublicUser {
	return PublicUser{
		ID:                          u.ID,
		Username:                    u.Username,
		DisplayName:                 u.DisplayName,
		Role:                        u.Role,
		DailyImageLimit:             NormalizeDailyImageLimit(u.DailyImageLimit, DefaultDailyImageLimit),
		HasUnlimitedImageGeneration: u.HasUnlimitedImageGeneration(),
	}
}
