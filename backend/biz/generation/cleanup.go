package generation

import (
	"context"
	"time"
)

// CleanupExpired 清理过期历史（逻辑删除）。
//
// 按 syssetting.retention_days 计算截止时间 cutoff = now - days，委托 *Repo.CleanupExpired
// 将超过保留期且未删的 generationtask 及其 generationimage 标记 deleted=true（deleted_at=now）。
// 对象存储（MinIO）文件保留，不物理删除。供定时 ticker 与手动触发调用。
// 返回 (清理 task 数, 清理 image 数, error)。
func (u *Usecase) CleanupExpired(ctx context.Context) (int, int, error) {
	days := u.syssetting.GetRetentionDays(ctx, 180)
	cutoff := time.Now().AddDate(0, 0, -days)
	nTask, nImage, err := u.repo.CleanupExpired(ctx, cutoff)
	if err != nil {
		u.logger.ErrorContext(ctx, "cleanup expired failed", "error", err)
		return 0, 0, err
	}
	if nTask > 0 {
		u.logger.InfoContext(ctx, "cleanup expired history done", "retentionDays", days, "tasks", nTask, "images", nImage)
	}
	return nTask, nImage, nil
}
