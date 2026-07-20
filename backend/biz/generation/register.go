package generation

import (
	"context"
	"log/slog"
	"time"

	"github.com/samber/do"

	"bridal/backend/biz/generation/imagestore"
)

// ProvideGeneration 注册生图业务依赖（Repo + Store + Usecase + Handler）。
func ProvideGeneration(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, imagestore.NewStore)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewXHSUsecase)
	do.Provide(i, NewHandler)
}

// InvokeGeneration 实例化 Handler（注册路由）。
//
// 启动崩溃恢复：把上次未完成的生图任务（queued/processing）标为 failed，
// 前端轮询拿到 failed 状态后提示用户重试（不自动恢复 goroutine）。
func InvokeGeneration(i *do.Injector) {
	logger := do.MustInvoke[*slog.Logger](i).With("module", "generation.recover")
	repo := do.MustInvoke[*Repo](i)
	if n, err := repo.MarkInterruptedTasksFailed(context.Background()); err != nil {
		logger.Warn("recover interrupted tasks failed", "error", err)
	} else if n > 0 {
		logger.Info("interrupted tasks marked failed", "count", n)
	}
	do.MustInvoke[*Handler](i)

	// 定时清理过期历史（逻辑删除：task+image 标记 deleted，MinIO 文件保留）。
	// 启动后先跑一次，再每 24h 跑一次。
	go func() {
		uc := do.MustInvoke[*Usecase](i)
		cl := do.MustInvoke[*slog.Logger](i).With("module", "generation.cleanup")
		run := func() {
			nTask, nImage, err := uc.CleanupExpired(context.Background())
			if err != nil {
				cl.Warn("cleanup expired history failed", "error", err)
				return
			}
			if nTask > 0 || nImage > 0 {
				cl.Info("cleanup expired history done", "tasks", nTask, "images", nImage)
			}
		}
		run()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()

	// 定时自动采集小红书笔记数据（提交后立即首次 + 1/7/15 天节奏持续）。
	// 首次采集由 Import/UpdateLink 异步触发，本 ticker 负责后续节点与失败短重试。
	InvokeXHSAutoRefresh(i)
}
