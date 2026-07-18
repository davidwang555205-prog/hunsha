package generation

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/biz/generation/imagestore"
	"bridal/backend/biz/generation/redfox"
	"bridal/backend/biz/generation/wala"
	"bridal/backend/middleware"
)

// Handler 生图 HTTP 处理器。
//
// 路由契约（与 Node 对齐，前端零改语义，路径用 bridal 新契约 /api/v1/generation）：
//
//	POST /api/v1/generation            生图（需 Bearer 鉴权）
//	GET  /api/v1/generation/history    历史（需 Bearer 鉴权）
//	GET  /api/v1/generation/images/:filename  图片代理（无鉴权，UUID 不可猜）
//
// 响应体采用 Node 的扁平结构（无 code/message/data 包装），错误用 { error: "..." }。
type Handler struct {
	usecase *Usecase
	xhs     *XHSUsecase
	store   *imagestore.Store
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		xhs:     do.MustInvoke[*XHSUsecase](i),
		store:   do.MustInvoke[*imagestore.Store](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "generation.handler"),
	}
	// cookie session 鉴权（MonkeyCode middleware.Auth）。
	authMw := do.MustInvoke[*middleware.AuthMiddleware](i).Auth()
	gen := w.Group("/api/v1/generation", authMw)
	gen.POST("", web.BindHandler(h.Generate))
	gen.GET("/history", web.BaseHandler(h.History))
	gen.GET("/tasks", web.BaseHandler(h.ListTasks))
	gen.GET("/tasks/:id", web.BaseHandler(h.GetTask))
	gen.GET("/tasks/:id/invocations", web.BaseHandler(h.ListTaskModelInvocations))
	gen.GET("/invocations", web.BaseHandler(h.ListModelInvocations))
	gen.POST("/tasks/:id/cancel", web.BaseHandler(h.CancelTask))
	// 手工指标录入已取消；历史 feedback 数据只读保留，新增数据必须经 Redfox 采集。
	gen.POST("/tasks/:id/feedback", web.BaseHandler(h.LegacyFeedbackDisabled))
	gen.POST("/tasks/:id/xhs-note", web.BindHandler(h.ImportXHSNote))
	gen.PUT("/tasks/:id/xhs-note", web.BindHandler(h.UpdateXHSNote))
	gen.POST("/tasks/:id/xhs-note/refresh", web.BaseHandler(h.RefreshXHSNote))
	gen.GET("/tasks/:id/xhs-note", web.BaseHandler(h.GetXHSNote))
	gen.GET("/stats", web.BaseHandler(h.Stats))
	gen.GET("/stats/trend", web.BaseHandler(h.StatsTrend))

	// 图片代理：无鉴权（图 URL 本身即凭证），只取 basename 防路径穿越。
	w.Echo().GET("/api/v1/generation/images/:filename", h.ServeImage)

	return h, nil
}

// Generate POST /api/v1/generation
func (h *Handler) Generate(c *web.Context, req GenerateReq) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	resp, err := h.usecase.Generate(c.Request().Context(), user, req)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, resp)
}

// History GET /api/v1/generation/history?page&pageSize&status&startTime&endTime
func (h *Handler) History(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	status := c.QueryParam("status")
	var startTime, endTime *time.Time
	if s := c.QueryParam("startTime"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			startTime = &t
		}
	}
	if e := c.QueryParam("endTime"); e != "" {
		if t, err := time.Parse(time.RFC3339, e); err == nil {
			endTime = &t
		}
	}
	var taskID uuid.UUID
	if s := c.QueryParam("taskId"); s != "" {
		if id, err := uuid.Parse(s); err == nil {
			taskID = id
		}
	}
	// admin 按用户筛选（普通用户传了也忽略，后端按自身 userID 过滤）
	var filterUserID uuid.UUID
	if s := c.QueryParam("userId"); s != "" {
		if id, err := uuid.Parse(s); err == nil {
			filterUserID = id
		}
	}
	recs, total, err := h.usecase.ListHistory(c.Request().Context(), user, page, pageSize, status, startTime, endTime, taskID, filterUserID)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list history failed", "error", err)
		return sendGenError(c, http.StatusInternalServerError, "获取历史记录失败。")
	}
	if page == 0 {
		page = 1
	}
	if pageSize == 0 {
		pageSize = 20
	}
	return c.JSON(http.StatusOK, map[string]any{
		"history":  recs,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
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
	contentType := contentTypeFromFilename(filename)
	// public + immutable：nginx/Lucky 中间层也可缓存，兜底代理路径不再每请求回源 COS
	c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	return c.Stream(http.StatusOK, contentType, reader)
}

// contentTypeFromFilename 按文件名扩展名返回 Content-Type（生成图 png / 参考图 jpg|webp）。
func contentTypeFromFilename(filename string) string {
	switch {
	case strings.HasSuffix(filename, ".jpg"), strings.HasSuffix(filename, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(filename, ".webp"):
		return "image/webp"
	default:
		return "image/png"
	}
}

// GetTask GET /api/v1/generation/tasks/:id -- 任务详情（含逐张 subTaskStatus）。
func (h *Handler) GetTask(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	rec, err := h.usecase.GetTask(c.Request().Context(), taskID)
	if err != nil || rec == nil {
		return sendGenError(c, http.StatusNotFound, "任务不存在。")
	}
	if !user.HasUnlimitedImageGeneration() && rec.UserID != user.ID {
		return sendGenError(c, http.StatusForbidden, "无权查看他人任务。")
	}
	return c.JSON(http.StatusOK, map[string]any{"task": h.usecase.SanitizeAsyncTask(*rec)})
}

// ListTasks GET /api/v1/generation/tasks?page&page_size&status -- 任务分页列表。
func (h *Handler) ListTasks(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	status := c.QueryParam("status")
	var startTime, endTime *time.Time
	if s := c.QueryParam("startTime"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			startTime = &t
		}
	}
	if e := c.QueryParam("endTime"); e != "" {
		if t, err := time.Parse(time.RFC3339, e); err == nil {
			endTime = &t
		}
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	recs, total, err := h.usecase.ListTasks(c.Request().Context(), user.ID, isAdmin, page, pageSize, status, startTime, endTime)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list tasks failed", "error", err)
		return sendGenError(c, http.StatusInternalServerError, "获取任务列表失败。")
	}
	tasks := make([]AsyncTaskResp, 0, len(recs))
	for _, r := range recs {
		tasks = append(tasks, h.usecase.SanitizeAsyncTask(r))
	}
	if page == 0 {
		page = 1
	}
	if pageSize == 0 {
		pageSize = 20
	}
	return c.JSON(http.StatusOK, map[string]any{
		"tasks":    tasks,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// ListTaskModelInvocations GET /api/v1/generation/tasks/:id/invocations。
// 真实模型请求含完整提示词和参考图指纹，仅管理员可读。
func (h *Handler) ListTaskModelInvocations(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	if !user.HasUnlimitedImageGeneration() {
		return sendGenError(c, http.StatusForbidden, "仅管理员可查看模型调用审计。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	return h.respondModelInvocations(c, ModelInvocationQuery{TaskID: taskID, Page: 1, PageSize: 100, Ascending: true})
}

// ListModelInvocations GET /api/v1/generation/invocations?page&pageSize&taskId&userId&channelId&status&startTime&endTime。
// 管理后台的横向排障入口，默认按实际请求开始时间倒序。
func (h *Handler) ListModelInvocations(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	if !user.HasUnlimitedImageGeneration() {
		return sendGenError(c, http.StatusForbidden, "仅管理员可查看模型调用审计。")
	}
	filter := ModelInvocationQuery{Status: strings.TrimSpace(c.QueryParam("status"))}
	filter.Page, _ = strconv.Atoi(c.QueryParam("page"))
	filter.PageSize, _ = strconv.Atoi(c.QueryParam("pageSize"))
	if s := c.QueryParam("taskId"); s != "" {
		if id, err := uuid.Parse(s); err != nil {
			return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
		} else {
			filter.TaskID = id
		}
	}
	if s := c.QueryParam("userId"); s != "" {
		if id, err := uuid.Parse(s); err != nil {
			return sendGenError(c, http.StatusBadRequest, "用户 ID 格式不正确。")
		} else {
			filter.UserID = id
		}
	}
	if s := c.QueryParam("channelId"); s != "" {
		if id, err := uuid.Parse(s); err != nil {
			return sendGenError(c, http.StatusBadRequest, "线路 ID 格式不正确。")
		} else {
			filter.ChannelID = id
		}
	}
	if s := c.QueryParam("startTime"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			filter.StartTime = &t
		}
	}
	if s := c.QueryParam("endTime"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			filter.EndTime = &t
		}
	}
	return h.respondModelInvocations(c, filter)
}

func (h *Handler) respondModelInvocations(c *web.Context, filter ModelInvocationQuery) error {
	rows, total, err := h.usecase.ListModelInvocations(c.Request().Context(), filter)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list model invocations failed", "error", err)
		return sendGenError(c, http.StatusInternalServerError, "获取模型调用审计失败。")
	}
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}
	return c.JSON(http.StatusOK, map[string]any{
		"invocations": rows,
		"total":       total,
		"page":        filter.Page,
		"pageSize":    filter.PageSize,
	})
}

// Stats GET /api/v1/generation/stats 生图统计（admin 概览页用）。
// isAdmin=true 返回全平台统计，否则仅当前用户。
func (h *Handler) Stats(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	resp, err := h.usecase.Stats(c.Request().Context(), user.ID, isAdmin)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get stats failed", "error", err)
		return sendGenError(c, http.StatusInternalServerError, "获取统计失败。")
	}
	return c.JSON(http.StatusOK, resp)
}

// StatsTrend GET /api/v1/generation/stats/trend?days=14 趋势统计（admin 概览页趋势图用）。
// isAdmin=true 返回全平台，否则仅当前用户。
func (h *Handler) StatsTrend(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	days, _ := strconv.Atoi(c.QueryParam("days"))
	if days <= 0 {
		days = 14
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	resp, err := h.usecase.StatsTrend(c.Request().Context(), user.ID, isAdmin, days)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "get stats trend failed", "error", err)
		return sendGenError(c, http.StatusInternalServerError, "获取趋势统计失败。")
	}
	return c.JSON(http.StatusOK, resp)
}

// CancelTask POST /api/v1/generation/tasks/:id/cancel。
func (h *Handler) CancelTask(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	if err := h.usecase.CancelTask(c.Request().Context(), taskID, user.ID, isAdmin); err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true, "status": "cancelled"})
}

// SubmitFeedback POST /api/v1/generation/tasks/:id/feedback -- 用户回填小红书发布反馈。
func (h *Handler) SubmitFeedback(c *web.Context, req SubmitFeedbackReq) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	rec, err := h.usecase.SubmitFeedback(c.Request().Context(), user, taskID, req)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"task": h.usecase.SanitizeHistory(*rec)})
}

func (h *Handler) LegacyFeedbackDisabled(c *web.Context) error {
	return sendGenError(c, http.StatusGone, "已取消手工填写指标，请使用小红书笔记链接自动采集数据。")
}

// ImportXHSNote links one published Xiaohongshu note to a generation task and
// immediately records its first Redfox data snapshot.
func (h *Handler) ImportXHSNote(c *web.Context, req XHSNoteImportReq) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	note, err := h.xhs.Import(c.Request().Context(), user, taskID, req)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"note": note})
}

// UpdateXHSNote replaces a linked note and immediately re-collects its data.
func (h *Handler) UpdateXHSNote(c *web.Context, req XHSNoteImportReq) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	note, err := h.xhs.UpdateLink(c.Request().Context(), user, taskID, req)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"note": note})
}

func (h *Handler) RefreshXHSNote(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	note, err := h.xhs.Refresh(c.Request().Context(), user, taskID)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"note": note})
}

func (h *Handler) GetXHSNote(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return sendGenError(c, http.StatusUnauthorized, "登录已失效。")
	}
	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return sendGenError(c, http.StatusBadRequest, "任务 ID 格式不正确。")
	}
	note, err := h.xhs.Get(c.Request().Context(), user, taskID)
	if err != nil {
		return handleGenError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"note": note})
}

// handleGenError 把 wala.Error / 普通错误转成 Node 风格响应。
// wala 上游 401/403（key 失效/鉴权错）映射为 502，避免触发前端全局登出。
func handleGenError(c echo.Context, err error) error {
	var redfoxErr *redfox.Error
	if errors.As(err, &redfoxErr) {
		return sendGenError(c, redfoxErr.StatusCode, redfoxErr.Message)
	}
	var walaErr *wala.Error
	if errors.As(err, &walaErr) {
		status := walaErr.StatusCode
		if status == 401 || status == 403 {
			status = 502
		}
		return sendGenError(c, status, walaErr.Message)
	}
	return sendGenError(c, http.StatusInternalServerError, err.Error())
}

func sendGenError(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}
