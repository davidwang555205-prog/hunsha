package engines

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

// 关键路由回归：GET /api/admin/engines/default-assets 必须命中静态路由，
// 不能被先注册的 /api/admin/engines/:id 通配符吞掉（否则 uuid.Parse("default-assets") 失败回 400）。
//
// Echo 路由器（radix tree）静态路径优先于参数路径，与本 handler.go 的注册顺序无关；
// 这里用最简 Echo 实例复现路由形状，防未来重构破坏该不变量。
func TestAdminEnginesDefaultAssetsRouteNotShadowedByID(t *testing.T) {
	e := echo.New()

	// 与 handler.go 完全一致的注册顺序：先 default-assets，后 :id
	e.GET("/api/admin/engines", func(c echo.Context) error { return c.String(http.StatusOK, "list") })
	e.GET("/api/admin/engines/default-assets", func(c echo.Context) error {
		return c.String(http.StatusOK, "default-assets")
	})
	e.GET("/api/admin/engines/:id", func(c echo.Context) error {
		return c.String(http.StatusOK, "by-id:"+c.Param("id"))
	})

	// 1. /default-assets 必须命中静态路由
	req := httptest.NewRequest(http.MethodGet, "/api/admin/engines/default-assets", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("default-assets status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "default-assets" {
		t.Errorf("default-assets body = %q, want %q (路由被 :id 吞掉了)", rec.Body.String(), "default-assets")
	}

	// 2. /:id 仍正常工作
	req2 := httptest.NewRequest(http.MethodGet, "/api/admin/engines/abc-123", nil)
	rec2 := httptest.NewRecorder()
	e.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("/:id status = %d, want 200", rec2.Code)
	}
	if rec2.Body.String() != "by-id:abc-123" {
		t.Errorf("/:id body = %q, want %q", rec2.Body.String(), "by-id:abc-123")
	}

	// 3. / 列表仍正常工作
	req3 := httptest.NewRequest(http.MethodGet, "/api/admin/engines", nil)
	rec3 := httptest.NewRecorder()
	e.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK || rec3.Body.String() != "list" {
		t.Errorf("list status=%d body=%q, want 200 list", rec3.Code, rec3.Body.String())
	}
}
