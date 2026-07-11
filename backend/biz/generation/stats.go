package generation

import (
	"context"
	"time"

	"github.com/google/uuid"

	"bridal/backend/biz/bridalauth"
	"bridal/backend/db"
	"bridal/backend/db/generationimage"
	"bridal/backend/db/generationtask"
)

// statsAdapter 实现 bridalauth.HistoryStats，桥接 generation.Repo。
// 注入到容器供 bridalauth.Usecase 可选调用（避免 bridalauth 反向依赖 generation）。
type statsAdapter struct {
	repo *Repo
}

// NewStatsAdapter 创建统计适配器。
func NewStatsAdapter(repo *Repo) bridalauth.HistoryStats {
	return &statsAdapter{repo: repo}
}

// UserStats 返回 (requestCount, successCount, generatedImageCount)。
func (s *statsAdapter) UserStats(ctx context.Context, userID uuid.UUID, isAdmin bool) (int, int, int, error) {
	q := s.repo.db.GenerationTask.Query()
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	tasks, err := q.All(ctx)
	if err != nil {
		return 0, 0, 0, err
	}
	request := len(tasks)
	success := 0
	taskIDs := make([]uuid.UUID, 0, len(tasks))
	for _, t := range tasks {
		if t.Status == "success" {
			success++
		}
		taskIDs = append(taskIDs, t.ID)
	}
	imageCount := 0
	if len(taskIDs) > 0 {
		imageCount, err = s.repo.db.GenerationImage.Query().
			Where(generationimage.TaskIDIn(taskIDs...)).
			Count(ctx)
		if err != nil {
			imageCount = 0
		}
	}
	return request, success, imageCount, nil
}

// DailyImages 返回用户当日（上海时区）已生成图片数。
func (s *statsAdapter) DailyImages(ctx context.Context, userID uuid.UUID, isAdmin bool) (int, error) {
	dateKey := shanghaiDateKey(time.Now())
	loc := time.FixedZone("CST", 8*3600)
	dayStart, err := time.ParseInLocation("2006-01-02", dateKey, loc)
	if err != nil {
		return 0, err
	}
	dayEnd := dayStart.Add(24 * time.Hour)

	q := s.repo.db.GenerationTask.Query().Where(
		generationtask.CreatedAtGTE(dayStart),
		generationtask.CreatedAtLT(dayEnd),
	)
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	taskIDs, err := q.IDs(ctx)
	if err != nil || len(taskIDs) == 0 {
		return 0, err
	}
	return s.repo.db.GenerationImage.Query().
		Where(generationimage.TaskIDIn(taskIDs...)).
		Count(ctx)
}

// LastGeneratedAt 返回最近一次生图时间，无记录返回 nil。
func (s *statsAdapter) LastGeneratedAt(ctx context.Context, userID uuid.UUID, isAdmin bool) (*time.Time, error) {
	q := s.repo.db.GenerationTask.Query()
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	t, err := q.Order(db.Desc(generationtask.FieldCreatedAt)).First(ctx)
	if err != nil {
		return nil, nil // 无记录不报错
	}
	createdAt := t.CreatedAt
	return &createdAt, nil
}
