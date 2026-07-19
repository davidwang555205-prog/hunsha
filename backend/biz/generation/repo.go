package generation

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/db"
	"bridal/backend/db/category"
	"bridal/backend/db/generationimage"
	"bridal/backend/db/generationtask"
	"bridal/backend/ent/types"
)

// Repo 生图历史仓储，操作 ent generation_tasks/generation_images 表。
type Repo struct {
	db     *db.Client
	logger *slog.Logger
}

// GetCategoryEngine 返回生图请求所属类目的内容引擎路由。
func (r *Repo) GetCategoryEngine(ctx context.Context, categoryID uuid.UUID) (*CategoryEngine, error) {
	c, err := r.db.Category.Query().
		Where(category.IDEQ(categoryID)).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return &CategoryEngine{Engine: c.Engine, IsEnabled: c.IsEnabled}, nil
}

func NewRepo(i *do.Injector) (*Repo, error) {
	return &Repo{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "generation.repo"),
	}, nil
}

// ImageRecord 图片记录，对应 Node history.images 元素 {id,name,url,downloadUrl,source}。
// Kind 仅参考图用：scene=场景参考图, product=婚纱产品图；生成图留空。
type ImageRecord struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	DownloadURL string `json:"downloadUrl"`
	Source      string `json:"source"`
	Kind        string `json:"kind,omitempty"`
	// ThumbURL 列表/详情缩略图 URL（COS 公开 URL + imageMogr2 实时缩放，~260KB）。
	// 公有读模式由 sanitize 填充；私有/代理模式留空，前端兜底用 URL。
	ThumbURL string `json:"thumbUrl,omitempty"`
}

// SubTaskStatusItem 逐张子图状态，对应前端 SubTaskStatus。
// status: pending|processing|success|failed|cancelled。
// pending 表示等待通道槽位，processing 表示已实际发往上游模型。
// image: success 时非空（含可访问 url）；pending/processing/failed 时为 nil。
type SubTaskStatusItem struct {
	Index     int          `json:"index"`
	Status    string       `json:"status"`
	Image     *ImageRecord `json:"image"`
	Error     string       `json:"error"`
	LatencyMs int          `json:"latencyMs"`
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
	ReferenceImages    []ImageRecord
	Prompts            []string            // 每张图给大模型的英文提示词（管理员复盘）
	Feedback           *types.TaskFeedback // 小红书发布反馈，nil=未反馈
	Error              string
	PromptHash         string
	UploadedImageCount int
	LatencyMs          int
	// V2 异步任务字段
	TotalCount       int                 // 子图总数
	CompletedCount   int                 // 已完成数（含失败）
	CategoryID       uuid.UUID           // 类目 id（uuid.Nil 表示未指定）
	ChannelID        uuid.UUID           // 模型线路 id（uuid.Nil 表示未指定）
	ChannelName      string              // 模型线路名称（历史列表由 channel_id 回填）
	EstimatedSeconds int                 // 预估耗时秒
	ImageSize        string              // 生图尺寸（单张重试恢复）
	ImageQuality     string              // 生图质量（单张重试恢复）
	StartedAt        *time.Time          // 开始处理时间
	CompletedAt      *time.Time          // 完成时间
	SubTaskStatus    []SubTaskStatusItem // 逐张状态（GetTask 时组装）
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
			SetThumbURL(img.ThumbURL).
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
			generationtask.DeletedEQ(false),
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
		Where(generationimage.TaskIDIn(taskIDs...), generationimage.DeletedEQ(false)).
		Count(ctx)
}

// ListForUser 查用户历史（admin 查全部），倒序最多 limit 条，带图片（WithImages 一步查询）。
// 对应 Node listHistoryForUser。
func (r *Repo) ListForUser(ctx context.Context, userID uuid.UUID, isAdmin bool, limit int) ([]TaskRecord, error) {
	if limit <= 0 {
		limit = 100
	}
	q := r.db.GenerationTask.Query().Where(generationtask.DeletedEQ(false))
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	}
	tasks, err := q.Order(db.Desc(generationtask.FieldCreatedAt)).Limit(limit).
		WithImages(func(iq *db.GenerationImageQuery) {
			iq.Where(generationimage.DeletedEQ(false)).Order(db.Asc(generationimage.FieldImageNumber))
		}).
		All(ctx)
	if err != nil {
		return nil, err
	}
	if len(tasks) == 0 {
		return []TaskRecord{}, nil
	}

	out := make([]TaskRecord, 0, len(tasks))
	for _, t := range tasks {
		images := make([]ImageRecord, 0, len(t.Edges.Images))
		for _, img := range t.Edges.Images {
			images = append(images, ImageRecord{
				ID:          img.ID,
				Name:        img.Name,
				URL:         img.URL,
				DownloadURL: img.DownloadURL,
				ThumbURL:    img.ThumbURL,
				Source:      img.Source,
			})
		}
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
			Images:             images,
			Error:              t.Error,
			PromptHash:         t.PromptHash,
			UploadedImageCount: t.UploadedImageCount,
			LatencyMs:          t.LatencyMs,
		}
		if rec.Tags == nil {
			rec.Tags = []string{}
		}
		out = append(out, rec)
	}
	return out, nil
}
