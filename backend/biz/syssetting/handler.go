package syssetting

import (
	"log/slog"
	"net/http"

	"github.com/GoYoko/web"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/middleware"
)

// Handler 系统设置 HTTP 处理器。
//
// 路由契约：
//   GET   /api/admin/settings         管理列表（admin）
//   PATCH /api/admin/settings/:key    更新单个设置（admin）
type Handler struct {
	usecase *Usecase
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	authMw := do.MustInvoke[*middleware.AuthMiddleware](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "syssetting.handler"),
	}
	authM := authMw.Auth()
	adminM := authMw.AdminAuth()

	w.Echo().GET("/api/admin/settings", h.list, authM, adminM)
	w.Echo().PATCH("/api/admin/settings/:key", h.update, authM, adminM)
	return h, nil
}

func (h *Handler) list(c echo.Context) error {
	out, err := h.usecase.GetAll(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list settings failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取系统设置失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"settings": out})
}

func (h *Handler) update(c echo.Context) error {
	key := c.Param("key")
	var req UpdateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	resp, err := h.usecase.Update(c.Request().Context(), key, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"setting": resp})
}
