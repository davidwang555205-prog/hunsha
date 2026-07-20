package credits

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/GoYoko/web"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/samber/do"

	"bridal/backend/middleware"
)

// Handler 积分 HTTP 处理器。
//
// 路由契约：
//   GET  /api/credits/transactions          当前用户积分明细（需 cookie 鉴权）
//   GET  /api/credits/balance               当前用户积分余额
//   POST /api/admin/users/:id/credits       admin 调整用户积分（需 admin）
type Handler struct {
	usecase *Usecase
	logger  *slog.Logger
}

func NewHandler(i *do.Injector) (*Handler, error) {
	w := do.MustInvoke[*web.Web](i)
	authMw := do.MustInvoke[*middleware.AuthMiddleware](i)
	h := &Handler{
		usecase: do.MustInvoke[*Usecase](i),
		logger:  do.MustInvoke[*slog.Logger](i).With("module", "credits.handler"),
	}
	creditsAuth := authMw.Auth()
	adminAuth := authMw.AdminAuth()
	credits := w.Group("/api/credits", creditsAuth)
	credits.GET("/transactions", web.BaseHandler(h.ListTransactions))
	credits.GET("/balance", web.BaseHandler(h.Balance))
	admin := w.Group("/api/admin/users", creditsAuth, adminAuth)
	admin.POST("/:id/credits", web.BindHandler(h.Adjust))
	w.Echo().GET("/api/admin/credits/transactions", h.listAllTransactions, creditsAuth, adminAuth)
	return h, nil
}

// ListTransactions GET /api/credits/transactions
// 支持可选过滤：type（recharge|consume|adjust）、startTime/endTime（RFC3339）+ 分页 page/pageSize。
// 与 admin /api/admin/credits/transactions 的过滤/分页语义一致，但当前用户视角强制按自身 userID。
func (h *Handler) ListTransactions(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "登录已失效。"})
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	filter := TransactionFilter{Type: c.QueryParam("type")}
	if s := c.QueryParam("startTime"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			filter.StartTime = &t
		}
	}
	if e := c.QueryParam("endTime"); e != "" {
		if t, err := time.Parse(time.RFC3339, e); err == nil {
			filter.EndTime = &t
		}
	}
	resp, err := h.usecase.ListTransactions(c.Request().Context(), user.ID, page, pageSize, filter)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list transactions failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取积分明细失败。"})
	}
	return c.JSON(http.StatusOK, resp)
}

// Balance GET /api/credits/balance
func (h *Handler) Balance(c *web.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "登录已失效。"})
	}
	balance, err := h.usecase.GetBalance(c.Request().Context(), user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取积分余额失败。"})
	}
	return c.JSON(http.StatusOK, map[string]any{"balance": balance})
}

// AdjustReq POST /api/admin/users/:id/credits 请求体，对应前端 AdjustCreditsRequest。
type AdjustReq struct {
	Amount      int    `json:"amount"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

// Adjust POST /api/admin/users/:id/credits
func (h *Handler) Adjust(c *web.Context, req AdjustReq) error {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "用户 ID 格式不正确。"})
	}
	resp, err := h.usecase.Adjust(c.Request().Context(), targetID, req.Amount, req.Type, req.Description)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, resp)
}

// listAllTransactions GET /api/admin/credits/transactions（admin，全平台分页倒序，支持过滤）
func (h *Handler) listAllTransactions(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	filter := TransactionFilter{Type: c.QueryParam("type")}
	if uid := c.QueryParam("userId"); uid != "" {
		if id, err := uuid.Parse(uid); err == nil {
			filter.UserID = &id
		}
	}
	if s := c.QueryParam("startTime"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			filter.StartTime = &t
		}
	}
	if e := c.QueryParam("endTime"); e != "" {
		if t, err := time.Parse(time.RFC3339, e); err == nil {
			filter.EndTime = &t
		}
	}
	resp, err := h.usecase.ListAllTransactions(c.Request().Context(), page, pageSize, filter)
	if err != nil {
		h.logger.ErrorContext(c.Request().Context(), "list all transactions failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "获取积分记录失败。"})
	}
	return c.JSON(http.StatusOK, resp)
}
