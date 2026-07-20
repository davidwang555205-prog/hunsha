package generation

import (
	"context"
	"log/slog"
	"time"

	"github.com/samber/do"

	"bridal/backend/db/xhsnotetracking"
)

// RunAutoRefresh 扫描所有到点的 tracking（next_refresh_at <= now）逐条采集。
// 供后台 ticker 定时调用：覆盖 1/7/15 节奏的后续节点与失败短重试；
// 首次采集已由 Import/UpdateLink 的 triggerAutoCollect 异步触发，不依赖本方法。
// 返回 (成功条数, 失败条数, error)。
func (u *XHSUsecase) RunAutoRefresh(ctx context.Context) (int, int, error) {
	now := time.Now()
	trackings, err := u.db.XHSNoteTracking.Query().
		Where(
			xhsnotetracking.NextRefreshAtNotNil(),
			xhsnotetracking.NextRefreshAtLTE(now),
		).
		All(ctx)
	if err != nil {
		return 0, 0, err
	}
	ok, failed := 0, 0
	for _, t := range trackings {
		// taskLock 防与 Import/UpdateLink/Refresh 并发重复采集同一笔记。
		lock := u.taskLock(t.TaskID)
		lock.Lock()
		// 重新查一次：拿锁前 next_refresh_at 可能已被异步首次采集或手动刷新推进，跳过已不到点的。
		current, err := u.db.XHSNoteTracking.Get(ctx, t.ID)
		if err != nil {
			lock.Unlock()
			failed++
			u.logger.Warn("xhs auto refresh: tracking gone", "trackingId", t.ID, "error", err)
			continue
		}
		if current.NextRefreshAt == nil || current.NextRefreshAt.After(now) {
			lock.Unlock()
			continue
		}
		_, colErr := u.collectOnce(ctx, current, "auto", true)
		lock.Unlock()
		if colErr != nil {
			failed++
			u.logger.Warn("xhs auto refresh collect failed", "trackingId", t.ID, "noteUrl", current.NoteURL, "error", colErr)
			continue
		}
		ok++
	}
	return ok, failed, nil
}

// InvokeXHSAutoRefresh 启动后台自动采集 ticker：启动先跑一次（补采启动期间到点的），
// 之后每 15 分钟扫描一次。15 分钟粒度兜底，首次采集靠 Import/UpdateLink 异步触发无延迟。
func InvokeXHSAutoRefresh(i *do.Injector) {
	uc := do.MustInvoke[*XHSUsecase](i)
	logger := do.MustInvoke[*slog.Logger](i).With("module", "generation.xhs.scheduler")
	run := func() {
		ok, failed, err := uc.RunAutoRefresh(context.Background())
		if err != nil {
			logger.Warn("xhs auto refresh run failed", "error", err)
			return
		}
		if ok > 0 || failed > 0 {
			logger.Info("xhs auto refresh done", "ok", ok, "failed", failed)
		}
	}
	go func() {
		run()
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()
}
