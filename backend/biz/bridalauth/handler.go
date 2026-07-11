package bridalauth

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"
)

// Handler bridal 认证 HTTP 处理器。
//
// 路由契约与 Node 版完全一致（前端零改）：
//   POST /api/login              { username, password } -> { token, user, accounts? }
//   GET  /api/me                 -> { user, accounts?, summary }
//   POST /api/admin/users        { username, displayName?, password, dailyImageLimit } -> { user, accounts }
//   PATCH /api/admin/users/:id   { dailyImageLimit? | password } -> { user, accounts }
//
// 响应体采用 Node 的扁平结构（无 code/message/data 包装），故不使用 web.Context.Success，
// 直接用 echo c.JSON 返回。错误用 { error: "中文文案" }，状态码与 Node 一致。
type Handler struct {
	usecase *Usecase
	repo    *Repo
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		repo:    do.MustInvoke[*Repo](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "bridalauth.handler"),
	}

	// bridal 认证路由组：/api（非 /api/v1），与 Node 前端契约一致。
	// 公开路由（无需鉴权）。
	api := w.Group("/api")
	api.POST("/login", web.BindHandler(h.Login))
	// /me 与 /admin/users 需要 Bearer 鉴权，挂在 BridalAuth 中间件下。
	authed := w.Group("/api", h.BridalAuth())
	authed.GET("/me", web.BaseHandler(h.Me))
	admin := w.Group("/api/admin", h.BridalAuth(), h.RequireAdmin())
	admin.POST("/users", web.BindHandler(h.CreateUser))

	// web.Group 未暴露 PATCH，直接用 echo 注册（前端契约要求 PATCH /api/admin/users/:id）。
	// UpdateUser 走 echo 原生 handler 自行 bind，绕过 web.Context 私有字段限制。
	w.Echo().PATCH("/api/admin/users/:id", h.updateUserEcho, h.BridalAuth(), h.RequireAdmin())

	return h, nil
}

// updateUserEcho 是 PATCH /api/admin/users/:id 的 echo 原生 handler（web.Group 无 PATCH 方法）。
// 逻辑与 UpdateUser 一致，仅请求绑定改为 echo 原生 Bind。
func (h *Handler) updateUserEcho(c echo.Context) error {
	var req UpdateUserReq
	if err := c.Bind(&req); err != nil {
		return sendBridalError(c, http.StatusBadRequest, "请求 JSON 格式不正确。")
	}
	// 复用 BindHandler 的处理逻辑：构造一个最小 web.Context 不现实，直接内联逻辑。
	return h.handleUpdateUser(c, req)
}

// BridalUserContextKey bridal 认证 user 在 echo context 中的 key。
const BridalUserContextKey = "bridal_user"

// BridalAuth Bearer token 鉴权中间件。
// 解析 Authorization: Bearer <token>，校验 HMAC 签名并查 user，注入到 context。
// 复用 MonkeyCode middleware 的 context 注入机制（key 不同，避免与 MonkeyCode session user 冲突）。
func (h *Handler) BridalAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := extractBearer(c)
			if token == "" {
				return sendBridalError(c, http.StatusUnauthorized, ErrLoginExpired.Error())
			}
			user, err := h.usecase.AuthenticateToken(c.Request().Context(), token)
			if err != nil {
				return sendBridalError(c, http.StatusUnauthorized, ErrLoginExpired.Error())
			}
			c.Set(BridalUserContextKey, user)
			return next(c)
		}
	}
}

// RequireAdmin 要求当前用户为 admin。
func (h *Handler) RequireAdmin() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := CurrentUser(c)
			if user == nil || user.Role != RoleAdmin {
				return sendBridalError(c, http.StatusForbidden, "只有管理员可以执行此操作。")
			}
			return next(c)
		}
	}
}

// CurrentUser 从 echo context 取 bridal 认证 user。
func CurrentUser(c echo.Context) *User {
	v, ok := c.Get(BridalUserContextKey).(*User)
	if !ok {
		return nil
	}
	return v
}

// extractBearer 从 Authorization 头取 Bearer token，与 Node getBearerToken 一致。
func extractBearer(c echo.Context) string {
	header := c.Request().Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

// Login POST /api/login
func (h *Handler) Login(c *web.Context, req LoginReq) error {
	resp, err := h.usecase.Login(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return sendBridalError(c, http.StatusUnauthorized, err.Error())
		}
		h.logger.ErrorContext(c.Request().Context(), "login failed", "error", err)
		return sendBridalError(c, http.StatusInternalServerError, "登录失败，请稍后重试。")
	}
	return c.JSON(http.StatusOK, resp)
}

// Me GET /api/me
func (h *Handler) Me(c *web.Context) error {
	user := CurrentUser(c)
	resp, err := h.usecase.Me(c.Request().Context(), user.ID)
	if err != nil {
		if errors.Is(err, ErrLoginExpired) {
			return sendBridalError(c, http.StatusUnauthorized, err.Error())
		}
		h.logger.ErrorContext(c.Request().Context(), "me failed", "error", err)
		return sendBridalError(c, http.StatusInternalServerError, "获取用户信息失败。")
	}
	return c.JSON(http.StatusOK, resp)
}

// CreateUserReq POST /api/admin/users 请求体，与 Node handleCreateUser 一致。
type CreateUserReq struct {
	Username        string `json:"username"`
	DisplayName     string `json:"displayName"`
	Password        string `json:"password"`
	DailyImageLimit int    `json:"dailyImageLimit"`
}

// CreateUser POST /api/admin/users
func (h *Handler) CreateUser(c *web.Context, req CreateUserReq) error {
	username := strings.ToLower(strings.TrimSpace(req.Username))
	if !ValidUsername(username) {
		return sendBridalError(c, http.StatusBadRequest, ErrUsernameInvalid.Error())
	}
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = username
	}
	if len([]rune(displayName)) > DisplayNameMaxLen {
		displayName = string([]rune(displayName)[:DisplayNameMaxLen])
	}
	if len(req.Password) < PasswordMinLen || len(req.Password) > PasswordMaxLen {
		return sendBridalError(c, http.StatusBadRequest, ErrPasswordLength.Error())
	}
	limit := NormalizeDailyImageLimit(req.DailyImageLimit, DefaultDailyImageLimit)

	existing, err := h.repo.FindByUsername(c.Request().Context(), username)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "check existing user failed", "error", err)
		return sendBridalError(c, http.StatusInternalServerError, "创建账号失败。")
	}
	if existing != nil {
		return sendBridalError(c, http.StatusConflict, ErrUsernameTaken.Error())
	}

	created, err := h.repo.Create(c.Request().Context(), CreateUserParams{
		ID:              uuid.New(),
		Username:        username,
		DisplayName:     displayName,
		Role:            RoleUser,
		Password:        req.Password,
		DailyImageLimit: limit,
	})
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "create user failed", "error", err)
		return sendBridalError(c, http.StatusInternalServerError, "创建账号失败。")
	}

	accounts, _ := h.usecase.buildAccountSummaries(c.Request().Context())
	return c.JSON(http.StatusCreated, map[string]any{
		"user":     created.ToPublic(),
		"accounts": accounts,
	})
}

// UpdateUserReq PATCH /api/admin/users/:id 请求体，与 Node handleUpdateUser 一致。
type UpdateUserReq struct {
	DailyImageLimit *int    `json:"dailyImageLimit"`
	Password        *string `json:"password"`
}

// UpdateUser PATCH /api/admin/users/:id（web.Group 无 PATCH，此方法仅供文档说明，
// 实际路由由 updateUserEcho 注册并调用 handleUpdateUser）。
func (h *Handler) UpdateUser(c *web.Context, req UpdateUserReq) error {
	return h.handleUpdateUser(c, req)
}

// handleUpdateUser 更新账号逻辑，供 web.BindHandler 与 echo 原生 handler 共用。
func (h *Handler) handleUpdateUser(c echo.Context, req UpdateUserReq) error {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return sendBridalError(c, http.StatusBadRequest, "账号 ID 格式不正确。")
	}
	target, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get target user failed", "error", err)
		return sendBridalError(c, http.StatusInternalServerError, "更新账号失败。")
	}
	if target == nil {
		return sendBridalError(c, http.StatusNotFound, ErrUserNotFound.Error())
	}

	if req.DailyImageLimit != nil {
		if target.HasUnlimitedImageGeneration() {
			return sendBridalError(c, http.StatusBadRequest, "管理员账号不受每日生图数量限制，无需设置额度。")
		}
		limit := *req.DailyImageLimit
		if limit < 0 || limit > MaxDailyImageLimit {
			return sendBridalError(c, http.StatusBadRequest, "每日生成图片上限需要在 0-1000 之间。")
		}
		if err := h.repo.SetDailyImageLimit(c.Request().Context(), id, limit); err != nil {
			h.logger.ErrorContext(c.Request().Context(), "update daily limit failed", "error", err)
			return sendBridalError(c, http.StatusInternalServerError, "更新账号失败。")
		}
	}
	if req.Password != nil {
		pwd := *req.Password
		if len(pwd) < PasswordMinLen || len(pwd) > PasswordMaxLen {
			return sendBridalError(c, http.StatusBadRequest, "新密码长度需要在 6-72 位之间。")
		}
		if err := h.repo.SetPassword(c.Request().Context(), id, pwd); err != nil {
			h.logger.ErrorContext(c.Request().Context(), "update password failed", "error", err)
			return sendBridalError(c, http.StatusInternalServerError, "更新账号失败。")
		}
	}

	updated, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return sendBridalError(c, http.StatusInternalServerError, "更新账号失败。")
	}
	accounts, _ := h.usecase.buildAccountSummaries(c.Request().Context())
	return c.JSON(http.StatusOK, map[string]any{
		"user":     updated.ToPublic(),
		"accounts": accounts,
	})
}

// sendBridalError 以 Node 风格返回错误：{ error: "中文文案" }，与前端契约一致。
func sendBridalError(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}
