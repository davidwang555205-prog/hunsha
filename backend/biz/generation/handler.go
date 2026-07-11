package generation

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/GoYoko/web"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/biz/bridalauth"
	"bridal/backend/biz/generation/imagestore"
	"bridal/backend/biz/generation/wala"
)

// Handler 生图 HTTP 处理器。
//
// 路由契约（与 Node 对齐，前端零改语义，路径用 bridal 新契约 /api/v1/generation）：
//   POST /api/v1/generation            生图（需 Bearer 鉴权）
//   GET  /api/v1/generation/history    历史（需 Bearer 鉴权）
//   GET  /api/v1/generation/images/:filename  图片代理（无鉴权，UUID 不可猜）
//
// 响应体采用 Node 的扁平结构（无 code/message/data 包装），错误用 { error: "..." }。
type Handler struct {
	usecase *Usecase
	store   *imagestore.Store
	auth    *bridalauth.Handler
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		store:   do.MustInvoke[*imagestore.Store](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "generation.handler"),
	}
	// 复用 bridalauth 的 Bearer 鉴权中间件。
	authMw := bridalAuthMiddleware(i)
	gen := w.Group("/api/v1/generation", authMw)
	gen.POST("", web.BindHandler(h.Generate))
	gen.GET("/history", web.BaseHandler(h.History))

	// 图片代理：无鉴权（图 URL 本身即凭证），只取 basename 防路径穿越。
	w.Echo().GET("/api/v1/generation/images/:filename", h.ServeImage)

	return h, nil
}

// bridalAuthMiddleware 取 bridalauth Handler 的 BridalAuth 中间件。
func bridalAuthMiddleware(i *do.Injector) echo.MiddlewareFunc {
	// bridalauth.Handler 在 InvokeBridalAuth 中已实例化；此处直接取。
	h := do.MustInvoke[*bridalauth.Handler](i)
	return h.BridalAuth()
}

// Generate POST /api/v1/generation
func (h *Handler) Generate(c *web.Context, req GenerateReq) error {
	user := bridalauth.CurrentUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	resp, err := h.usecase.Generate(c.Request().Context(), user, req)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, resp)
}

// History GET /api/v1/generation/history
func (h *Handler) History(c *web.Context) error {
	user := bridalauth.CurrentUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	recs, err := h.usecase.ListHistory(c.Request().Context(), user)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list history failed", "error", err)
		return sendGenError(c, http.StatusInternalServerError, "获取历史记录失败。")
	}
	return c.JSON(http.StatusOK, map[string]any{"history": recs})
}

// ServeImage GET /api/v1/generation/images/:filename
// 与 Node serveGenerated 一致：只取 basename，流式返回，Content-Type image/png，1 年缓存。
func (h *Handler) ServeImage(c echo.Context) error {
	filename := c.Param("filename")
	// 只取 basename，防路径穿越（与 Node path.basename 一致）。
	if idx := strings.LastIndex(filename, "/"); idx >= 0 {
		filename = filename[idx+1:]
	}
	if filename == "" || strings.Contains(filename, "..") {
		return c.NoContent(http.StatusNotFound)
	}
	reader, err := h.store.GetImage(c.Request().Context(), filename)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	defer reader.Close()
	c.Response().Header().Set("Content-Type", "image/png")
	c.Response().Header().Set("Cache-Control", "private, max-age=31536000")
	return c.Stream(http.StatusOK, "image/png", reader)
}

// handleGenError 把 wala.Error / 普通错误转成 Node 风格响应。
func handleGenError(c echo.Context, err error) error {
	var walaErr *wala.Error
	if errors.As(err, &walaErr) {
		return sendGenError(c, walaErr.StatusCode, walaErr.Message)
	}
	return sendGenError(c, http.StatusInternalServerError, err.Error())
}

func sendGenError(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}
