package customerservice

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/biz/generation/imagestore"
	"bridal/backend/middleware"
)

// Handler 客服信息 HTTP 处理器。
//
// 路由契约：
//
//	GET    /api/customer-service            公开列表（登录用户，仅生效）
//	GET    /api/admin/customer-service      管理列表（admin，含禁用）
//	POST   /api/admin/customer-service      创建客服（admin）
//	PATCH  /api/admin/customer-service/:id  更新客服（admin）
//	DELETE /api/admin/customer-service/:id  删除客服（admin）
type Handler struct {
	usecase *Usecase
	store   *imagestore.Store
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	authMw := do.MustInvoke[*middleware.AuthMiddleware](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		store:   do.MustInvoke[*imagestore.Store](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "customerservice.handler"),
	}
	authM := authMw.Auth()
	adminM := authMw.AdminAuth()

	w.Echo().GET("/api/customer-service", h.listPublic, authM)
	w.Echo().GET("/api/admin/customer-service", h.listAdmin, authM, adminM)
	w.Echo().POST("/api/admin/customer-service", h.create, authM, adminM)
	w.Echo().PATCH("/api/admin/customer-service/:id", h.update, authM, adminM)
	w.Echo().DELETE("/api/admin/customer-service/:id", h.remove, authM, adminM)
	// 微信二维码上传（复用 imagestore 存 MinIO，返回 /api/v1/generation/images/{filename} 代理 URL）
	w.Echo().POST("/api/admin/customer-service/upload-qrcode", h.uploadQrcode, authM, adminM)
	return h, nil
}

func (h *Handler) listPublic(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "登录已失效。"})
	}
	out, err := h.usecase.ListPublic(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list public customer service failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取客服列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"customerService": out})
}

func (h *Handler) listAdmin(c echo.Context) error {
	out, err := h.usecase.ListAdmin(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list admin customer service failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取客服列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"customerService": out})
}

func (h *Handler) create(c echo.Context) error {
	var req CreateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	cs, err := h.usecase.Create(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"customerService": cs})
}

func (h *Handler) update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "客服 ID 格式不正确。"})
	}
	var req UpdateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	cs, err := h.usecase.Update(c.Request().Context(), id, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"customerService": cs})
}

func (h *Handler) remove(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "客服 ID 格式不正确。"})
	}
	if err := h.usecase.Delete(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

// uploadQrcode POST /api/admin/customer-service/upload-qrcode
// 上传客服微信二维码，复用 imagestore 存 MinIO，返回代理访问 URL。
func (h *Handler) uploadQrcode(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择图片文件。"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "读取文件失败。"})
	}
	defer src.Close()
	data, err := io.ReadAll(src)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "读取文件失败。"})
	}
	if int64(len(data)) > 10<<20 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "图片不能超过 10MB。"})
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !isImageExt(ext) {
		ext = ".png"
	}
	filename := fmt.Sprintf("qrcode-%s%s", uuid.New().String(), ext)
	url, err := h.store.PutImage(c.Request().Context(), filename, data, file.Header.Get("Content-Type"))
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "upload customer service qrcode failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "上传失败，请稍后重试。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"url": url})
}

// isImageExt 判断扩展名是否为支持的图片格式。
func isImageExt(ext string) bool {
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif":
		return true
	}
	return false
}
