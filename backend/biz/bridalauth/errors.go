package bridalauth

import "errors"

// bridal 认证错误。文案与 Node 版中文错误信息对齐，前端直接展示。
var (
	ErrInvalidCredentials = errors.New("账号或密码不正确。")
	ErrLoginExpired       = errors.New("登录已失效。")
	ErrUsernameTaken      = errors.New("该账号已存在。")
	ErrUserNotFound       = errors.New("账号不存在。")
	ErrUsernameInvalid    = errors.New("账号只能使用 3-32 位小写字母、数字、下划线、点或短横线。")
	ErrPasswordLength     = errors.New("初始密码长度需要在 6-72 位之间。")
)
