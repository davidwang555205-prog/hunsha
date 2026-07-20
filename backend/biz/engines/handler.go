package engines

import (
	"log/slog"
	"net/http"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/biz/engines/seeding"
	"bridal/backend/middleware"
)

// Handler 内容引擎 HTTP 处理器。
//
// 路由契约：
//
//	GET    /api/engines                       公开列表（登录用户，仅启用，含 config 供运行时拉取）
//	POST   /api/engines/:key/generate         生成内容（登录用户，按 key 路由引擎 + config 覆盖素材）
//	GET    /api/engines/:key/topic-options    当前引擎 JSON 配置的主题列表
//	GET    /api/admin/engines                 管理列表（admin，含禁用，无 config 大字段）
//	GET    /api/admin/engines/:id             单条完整引擎（admin，含 config，编辑弹窗回填用）
//	POST   /api/admin/engines                 创建引擎（admin）
//	PATCH  /api/admin/engines/:id             更新引擎（admin）
//	DELETE /api/admin/engines/:id             删除引擎（admin）
//	GET    /api/admin/engines/default-assets  默认素材（admin，供编辑弹窗显示当前生效值）
type Handler struct {
	usecase *Usecase
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	authMw := do.MustInvoke[*middleware.AuthMiddleware](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "engines.handler"),
	}
	authM := authMw.Auth()
	adminM := authMw.AdminAuth()

	w.Echo().GET("/api/engines", h.listPublic, authM)
	w.Echo().POST("/api/engines/:key/generate", h.generate, authM)
	w.Echo().GET("/api/engines/:key/capabilities", h.capabilities, authM)
	w.Echo().GET("/api/engines/:key/topic-options", h.topicOptions, authM)
	w.Echo().GET("/api/engines/:key/prompt-options", h.promptOptions, authM)
	w.Echo().GET("/api/admin/engines", h.listAdmin, authM, adminM)
	w.Echo().GET("/api/admin/engines/default-assets", h.defaultAssets, authM, adminM)
	w.Echo().GET("/api/admin/engines/:id", h.getByID, authM, adminM)
	w.Echo().POST("/api/admin/engines", h.create, authM, adminM)
	w.Echo().PATCH("/api/admin/engines/:id", h.update, authM, adminM)
	w.Echo().DELETE("/api/admin/engines/:id", h.remove, authM, adminM)
	return h, nil
}

// capabilities GET /api/engines/:key/capabilities：返回工作台需要的通用引擎能力。
func (h *Handler) capabilities(c echo.Context) error {
	copyEnabled, err := h.usecase.CopyEnabled(c.Request().Context(), c.Param("key"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"copyEnabled": copyEnabled})
}

// topicOptions GET /api/engines/:key/topic-options：返回工作台可选主题。
func (h *Handler) topicOptions(c echo.Context) error {
	productCategory := c.QueryParam("productCategory")
	if productCategory != seeding.ProductCategoryBridal && productCategory != seeding.ProductCategoryDress {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "产品品类不正确。"})
	}
	topics, err := h.usecase.TopicOptions(c.Request().Context(), c.Param("key"), productCategory)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get topic options failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取内容主题失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"topics": topics})
}

func (h *Handler) listPublic(c echo.Context) error {
	out, err := h.usecase.ListPublic(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list public engines failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取内容引擎列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"engines": out})
}

func (h *Handler) listAdmin(c echo.Context) error {
	out, err := h.usecase.ListAdminSummary(c.Request().Context())
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list admin engines failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取内容引擎列表失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"engines": out})
}

// getByID GET /api/admin/engines/:id：单条完整引擎（含 config），编辑弹窗回填用。
func (h *Handler) getByID(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "引擎 ID 格式不正确。"})
	}
	resp, err := h.usecase.GetByID(c.Request().Context(), id)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get engine failed", "id", id, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取内容引擎失败。"})
	}
	if resp == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "内容引擎不存在。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"engine": resp})
}

// defaultAssets GET /api/admin/engines/default-assets：返回代码默认素材，供编辑弹窗与 config.seeding 合并显示。
func (h *Handler) defaultAssets(c echo.Context) error {
	out, err := h.usecase.DefaultAssets()
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get default assets failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取默认素材失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"assets": out})
}

// promptOptions GET /api/engines/:key/prompt-options：返回当前生效的 imagePrompt 素材，
// 供前端 UI 拉取选项（款式/场景/模特/季节/光线/关键词档案/兼容映射）。
func (h *Handler) promptOptions(c echo.Context) error {
	key := c.Param("key")
	out, err := h.usecase.PromptOptions(c.Request().Context(), key)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get prompt options failed", "key", key, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取提示词选项失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"assets": out})
}

func (h *Handler) create(c echo.Context) error {
	var req CreateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	resp, err := h.usecase.Create(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"engine": resp})
}

func (h *Handler) update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "引擎 ID 格式不正确。"})
	}
	var req UpdateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	resp, err := h.usecase.Update(c.Request().Context(), id, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"engine": resp})
}

func (h *Handler) remove(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "引擎 ID 格式不正确。"})
	}
	if err := h.usecase.Delete(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

// GenerateReq 生成内容请求（对应前端 generateContent 调用，TS FashionSeedingInput）。
type GenerateReq struct {
	ProductCategory string               `json:"productCategory"`
	BaseParams      seeding.PromptParams `json:"baseParams"`
	ImageCount      int                  `json:"imageCount"`
	Topic           string               `json:"topic"`
	DailySlot       int                  `json:"dailySlot"`
	ContentNonce    int                  `json:"contentNonce"`
}

// generate POST /api/engines/:key/generate：按 key 路由引擎，读 config 覆盖默认素材，生成内容。
func (h *Handler) generate(c echo.Context) error {
	key := c.Param("key")
	var req GenerateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求 JSON 格式不正确。"})
	}
	input := seeding.FashionSeedingInput{
		ProductCategory: req.ProductCategory,
		BaseParams:      req.BaseParams,
		ImageCount:      req.ImageCount,
		Topic:           req.Topic,
		DailySlot:       req.DailySlot,
		ContentNonce:    req.ContentNonce,
	}
	content, err := h.usecase.Generate(c.Request().Context(), key, input)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "generate content failed", "key", key, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "生成内容失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"content": content})
}
