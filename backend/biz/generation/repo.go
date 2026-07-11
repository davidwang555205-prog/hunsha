package generation

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/generationimage"
	"bridal/backend/db/generationtask"
)

// Repo 生图历史仓储，操作 ent generation_tasks/generation_images 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "generation.repo"),
	}, nil
}

// ImageRecord 图片记录，对应 Node history.images 元素 {id,name,url,downloadUrl,source}。
type ImageRecord struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	DownloadURL  string `json:"downloadUrl"`
	Source       string `json:"source"`
}

// TaskRecord 生图任务记录，对应 Node history 记录（含 sanitizeHistory 字段 + 内部字段）。
type TaskRecord struct {
	ID                 uuid.UUID
	UserID             uuid.UUID
	Username           string
	CreatedAt          time.Time
	Status             string
	Model              string
	Mode               string
	Title              string
	Body               string
	Tags               []string
	Topic              string
	Images             []ImageRecord
	Error              string
	PromptHash         string
	UploadedImageCount int
	LatencyMs          int
}

// InsertTask 写入生图任务 + 关联图片（事务）。
func (r *Repo) InsertTask(ctx context.Context, rec TaskRecord) error {
	tx, err := r.db.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err := tx.GenerationTask.Create().
		SetID(rec.ID).
		SetUserID(rec.UserID).
		SetUsername(rec.Username).
		SetStatus(rec.Status).
		SetModel(rec.Model).
		SetMode(rec.Mode).
		SetTitle(rec.Title).
		SetBody(rec.Body).
		SetTags(rec.Tags).
		SetTopic(rec.Topic).
		SetError(rec.Error).
		SetPromptHash(rec.PromptHash).
		SetUploadedImageCount(rec.UploadedImageCount).
		SetLatencyMs(rec.LatencyMs).
		Save(ctx); err != nil {
		return err
	}
	// 写图片
	for i, img := range rec.Images {
		if _, err := tx.GenerationImage.Create().
			SetID(img.ID).
			SetTaskID(rec.ID).
			SetName(img.Name).
			SetURL(img.URL).
			SetDownloadURL(img.DownloadURL).
			SetSource(img.Source).
			SetImageNumber(i + 1).
			Save(ctx); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// PurgeExpired 删除过期任务（按 created_at < cutoff），先删关联图片再删任务。
// 对应 Node purgeExpiredHistory。
func (r *Repo) PurgeExpired(ctx context.Context, retentionDays int) error {
	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	// 先查出过期 task id
	ids, err := r.db.GenerationTask.Query().
		Where(generationtask.CreatedAtLT(cutoff)).
		IDs(ctx)
	if err != nil {
		return err
	}
	if len(ids) == 0 {
		return nil
	}
	// 删这些 task 的图片
	_, err = r.db.GenerationImage.Delete().
		Where(generationimage.TaskIDIn(ids...)).
		Exec(ctx)
	if err != nil {
		return err
	}
	// 删任务
	_, err = r.db.GenerationTask.Delete().
		Where(generationtask.IDIn(ids...)).
		Exec(ctx)
	return err
}

// CountImagesForDate 统计用户当日（上海时区）已生成图片数。
// 对应 Node countImagesForDate：当天所有 history 记录的图片总数。
func (r *Repo) CountImagesForDate(ctx context.Context, userID uuid.UUID, shanghaiDate string) (int, error) {
	// 上海时区当天：created_at 落在 [shanghaiDate 00:00 +08:00, 次日 00:00 +08:00)
	loc := time.FixedZone("CST", 8*3600)
	dayStart, err := time.ParseInLocation("2006-01-02", shanghaiDate, loc)
	if err != nil {
		return 0, err
	}
	dayEnd := dayStart.Add(24 * time.Hour)

	// 查当日该用户的任务 id，再统计这些任务的图片数。
	taskIDs, err := r.db.GenerationTask.Query().
		Where(
			generationtask.UserIDEQ(userID),
			generationtask.CreatedAtGTE(dayStart),
			generationtask.CreatedAtLT(dayEnd),
		).
		IDs(ctx)
	if err != nil {
		return 0, err
	}
	if len(taskIDs) == 0 {
		return 0, nil
	}
	return r.db.GenerationImage.Query().
		Where(generationimage.TaskIDIn(taskIDs...)).
		Count(ctx)
}

// ListForUser 查用户历史（admin 查全部），倒序最多 limit 条，带图片（两步查询）。
// 对应 Node listHistoryForUser。不用 ent edge，避免自动外键列名问题。
func (r *Repo) ListForUser(ctx context.Context, userID uuid.UUID, isAdmin bool, limit int) ([]TaskRecord, error) {
	if limit <= 0 {
		limit = 100
	}
	q := r.db.GenerationTask.Query()
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	tasks, err := q.Order(db.Desc(generationtask.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	if len(tasks) == 0 {
		return []TaskRecord{}, nil
	}
	// 收集 task id，批量查 images
	taskIDs := make([]uuid.UUID, 0, len(tasks))
	for _, t := range tasks {
		taskIDs = append(taskIDs, t.ID)
	}
	allImages, err := r.db.GenerationImage.Query().
		Where(generationimage.TaskIDIn(taskIDs...)).
		Order(db.Asc(generationimage.FieldImageNumber)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	// 按 task_id 分组
	imageMap := make(map[uuid.UUID][]ImageRecord, len(tasks))
	for _, img := range allImages {
		imageMap[img.TaskID] = append(imageMap[img.TaskID], ImageRecord{
			ID:          img.ID,
			Name:        img.Name,
			URL:         img.URL,
			DownloadURL: img.DownloadURL,
			Source:      img.Source,
		})
	}

	out := make([]TaskRecord, 0, len(tasks))
	for _, t := range tasks {
		rec := TaskRecord{
			ID:                 t.ID,
			UserID:             t.UserID,
			Username:           t.Username,
			CreatedAt:          t.CreatedAt,
			Status:             t.Status,
			Model:              t.Model,
			Mode:               t.Mode,
			Title:              t.Title,
			Body:               t.Body,
			Tags:               t.Tags,
			Topic:              t.Topic,
			Images:             imageMap[t.ID],
			Error:              t.Error,
			PromptHash:         t.PromptHash,
			UploadedImageCount: t.UploadedImageCount,
			LatencyMs:          t.LatencyMs,
		}
		if rec.Images == nil {
			rec.Images = []ImageRecord{}
		}
		if rec.Tags == nil {
			rec.Tags = []string{}
		}
		out = append(out, rec)
	}
	return out, nil
}
