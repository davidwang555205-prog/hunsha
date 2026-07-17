package categories

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

// Handler 内容类目 HTTP 处理器。
//
// 路由契约：
//
//	GET    /api/categories            公开列表（登录用户，仅启用）
//	GET    /api/admin/categories      管理列表（admin，含禁用）
//	POST   /api/admin/categories      创建类目（admin）
//	PATCH  /api/admin/categories/:id  更新类目（admin）
//	DELETE /api/admin/categories/:id  删除类目（admin）
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
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "categories.handler"),
	}
	authM := authMw.Auth()
	adminM := authMw.AdminAuth()

	w.Echo().GET("/api/categories", h.listPublic, authM)
	w.Echo().GET("/api/admin/categories", h.listAdmin, authM, adminM)
	w.Echo().POST("/api/admin/categories", h.create, authM, adminM)
	w.Echo().PATCH("/api/admin/categories/:id", h.update, authM, adminM)
	w.Echo().DELETE("/api/admin/categories/:id", h.remove, authM, adminM)
	// 类目卡片封面图上传（复用 imagestore 存 MinIO，返回 /api/v1/generation/images/{filename} 代理 URL）
	w.Echo().POST("/api/admin/categories/upload-cover", h.uploadCover, authM, adminM)
	return h, nil
}

func (h *Handler) listPublic(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "登录已失效。"})
	}
	out, err := h.usecase.ListPublic(c.Request().Context(), user.ID)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list public categories failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取类目列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"categories": out})
}

func (h *Handler) listAdmin(c echo.Context) error {
	out, err := h.usecase.ListAdmin(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list admin categories failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取类目列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"categories": out})
}

func (h *Handler) create(c echo.Context) error {
	var req CreateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	cat, err := h.usecase.Create(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"category": cat})
}

func (h *Handler) update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "类目 ID 格式不正确。"})
	}
	var req UpdateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	cat, err := h.usecase.Update(c.Request().Context(), id, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"category": cat})
}

func (h *Handler) remove(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "类目 ID 格式不正确。"})
	}
	if err := h.usecase.Delete(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

// uploadCover POST /api/admin/categories/upload-cover
// 上传类目卡片封面图，复用 imagestore 存 MinIO，返回代理访问 URL。
// 前端拿到 url 后存进 category.config.coverImages，首页卡片直接 img src 加载。
func (h *Handler) uploadCover(c echo.Context) error {
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
	filename := fmt.Sprintf("category-%s%s", uuid.New().String(), ext)
	url, err := h.store.PutImage(c.Request().Context(), filename, data, file.Header.Get("Content-Type"))
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "upload category cover failed", "error", err)
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
