package channels

import (
	"log/slog"
	"net/http"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/middleware"
)

// Handler 模型线路 HTTP 处理器。
//
// 路由契约：
//   GET    /api/channels            公开列表（登录用户，不含 apiKey）
//   GET    /api/admin/channels      管理列表（admin，含 apiKey）
//   POST   /api/admin/channels      创建线路（admin）
//   PATCH  /api/admin/channels/:id  更新线路（admin）
//   DELETE /api/admin/channels/:id  删除线路（admin）
type Handler struct {
	usecase *Usecase
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	authMw := do.MustInvoke[*middleware.AuthMiddleware](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "channels.handler"),
	}
	authM := authMw.Auth()
	adminM := authMw.AdminAuth()

	w.Echo().GET("/api/channels", h.listPublic, authM)
	w.Echo().GET("/api/admin/channels", h.listAdmin, authM, adminM)
	w.Echo().POST("/api/admin/channels", h.create, authM, adminM)
	w.Echo().PATCH("/api/admin/channels/:id", h.update, authM, adminM)
	w.Echo().DELETE("/api/admin/channels/:id", h.remove, authM, adminM)
	return h, nil
}

func (h *Handler) listPublic(c echo.Context) error {
	out, err := h.usecase.ListPublic(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list public channels failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取线路列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"channels": out})
}

func (h *Handler) listAdmin(c echo.Context) error {
	out, err := h.usecase.ListAdmin(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list admin channels failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取线路列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"channels": out})
}

func (h *Handler) create(c echo.Context) error {
	var req CreateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	ch, err := h.usecase.Create(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"channel": ch})
}

func (h *Handler) update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "线路 ID 格式不正确。"})
	}
	var req UpdateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	ch, err := h.usecase.Update(c.Request().Context(), id, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"channel": ch})
}

func (h *Handler) remove(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "线路 ID 格式不正确。"})
	}
	if err := h.usecase.Delete(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}
