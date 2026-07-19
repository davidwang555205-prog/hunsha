package generation

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"bridal/backend/db"
	"bridal/backend/db/generationimage"
	"bridal/backend/db/generationmodelinvocation"
	"bridal/backend/db/generationtask"
	"bridal/backend/db/modelchannel"
	"bridal/backend/ent/types"
)

// 异步任务仓储方法（V2）。
// sub_task_status 不存 JSON，由 generation_images 的 status 字段派生：
// CreateTask 预写 N 条 pending 占位，worker 逐张更新。

// CreateTask 入库异步任务（status=queued）+ 预写 N 条 pending 子图占位（事务）。
// rec 需含 ID/UserID/Username/Model/Mode/Title/Body/Tags/Topic/PromptHash/UploadedImageCount/EstimatedSeconds。
func (r *Repo) CreateTask(ctx context.Context, rec TaskRecord, names []string) error {
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
		SetStatus("queued").
		SetModel(rec.Model).
		SetMode(rec.Mode).
		SetTitle(rec.Title).
		SetBody(rec.Body).
		SetTags(rec.Tags).
		SetTopic(rec.Topic).
		SetError("").
		SetPromptHash(rec.PromptHash).
		SetUploadedImageCount(rec.UploadedImageCount).
		SetLatencyMs(0).
		SetTotalCount(len(names)).
		SetCompletedCount(0).
		SetEstimatedSeconds(rec.EstimatedSeconds).
		SetCategoryID(rec.CategoryID).
		SetChannelID(rec.ChannelID).
		SetReferenceImages(recordsToRefImages(rec.ReferenceImages)).
		SetPrompts(rec.Prompts).
		Save(ctx); err != nil {
		return err
	}
	// 预写 N 条 pending 子图占位（id=recordID-<i>，url 空）。name 直接用计划标准名（图N｜类型｜描述），与旧版 Node 对齐。
	for i, name := range names {
		imgID := fmt.Sprintf("%s-%d", rec.ID.String(), i+1)
		if _, err := tx.GenerationImage.Create().
			SetID(imgID).
			SetTaskID(rec.ID).
			SetName(name).
			SetURL("").
			SetDownloadURL("").
			SetSource("local").
			SetImageNumber(i + 1).
			SetStatus("pending").
			SetError("").
			SetLatencyMs(0).
			Save(ctx); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// GetTask 查单个任务 + 子图，组装 SubTaskStatus。仅 success 子图计入 Images。
func (r *Repo) GetTask(ctx context.Context, taskID uuid.UUID) (*TaskRecord, error) {
	t, err := r.db.GenerationTask.Query().
		Where(generationtask.IDEQ(taskID), generationtask.DeletedEQ(false)).
		WithImages(func(iq *db.GenerationImageQuery) {
			iq.Where(generationimage.DeletedEQ(false)).Order(db.Asc(generationimage.FieldImageNumber))
		}).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	images := t.Edges.Images
	rec := taskToRecord(t)
	rec.Images = make([]ImageRecord, 0, len(images))
	rec.SubTaskStatus = make([]SubTaskStatusItem, 0, len(images))
	for _, img := range images {
		ir := ImageRecord{
			ID:          img.ID,
			Name:        img.Name,
			URL:         img.URL,
			DownloadURL: img.DownloadURL,
			ThumbURL:    img.ThumbURL,
			Source:      img.Source,
		}
		st := SubTaskStatusItem{
			Index:     img.ImageNumber - 1,
			Status:    img.Status,
			Error:     img.Error,
			LatencyMs: img.LatencyMs,
		}
		if img.Status == "success" && img.URL != "" {
			st.Image = &ir
			rec.Images = append(rec.Images, ir)
		}
		rec.SubTaskStatus = append(rec.SubTaskStatus, st)
	}
	return &rec, nil
}

// SetTaskStarted 置 processing + started_at。
func (r *Repo) SetTaskStarted(ctx context.Context, taskID uuid.UUID) error {
	return r.db.GenerationTask.UpdateOneID(taskID).
		SetStatus("processing").
		SetStartedAt(time.Now()).
		Exec(ctx)
}

// SetTaskDone 置终态 + completed_at + error。
func (r *Repo) SetTaskDone(ctx context.Context, taskID uuid.UUID, status, errMsg string) error {
	return r.db.GenerationTask.UpdateOneID(taskID).
		SetStatus(status).
		SetError(errMsg).
		SetLatencyMs(0). // 异步任务总耗时由 started/completed 计算，latency_ms 留 0
		SetCompletedAt(time.Now()).
		Exec(ctx)
}

// UpdateSubTaskImage 更新单张子图状态（processing/success/failed）。url/thumbURL 非空时一并写入。
func (r *Repo) UpdateSubTaskImage(ctx context.Context, imageID, status, url, thumbURL, errMsg string, latencyMs int) error {
	q := r.db.GenerationImage.UpdateOneID(imageID).
		SetStatus(status).
		SetError(errMsg).
		SetLatencyMs(latencyMs)
	if url != "" {
		q = q.SetURL(url).SetDownloadURL(url)
	}
	if thumbURL != "" {
		q = q.SetThumbURL(thumbURL)
	}
	return q.Exec(ctx)
}

// IncCompletedCount 任务已完成数 +1（含失败，用于进度条）。原子累加，并发安全。
func (r *Repo) IncCompletedCount(ctx context.Context, taskID uuid.UUID) error {
	return r.db.GenerationTask.UpdateOneID(taskID).
		AddCompletedCount(1). // SET completed_count = completed_count + 1，避免并发 read-modify-write 丢更新
		Exec(ctx)
}

// ListTasksPaged 分页查任务（含子图），倒序。isAdmin 查全部。status 空则不过滤。
// finishedOnly 为 true 时只返回已结束任务，避免进行中的任务被误认为历史记录。
func (r *Repo) ListTasksPaged(ctx context.Context, userID uuid.UUID, isAdmin bool, page, pageSize int, status string, startTime, endTime *time.Time, taskID uuid.UUID, filterUserID, categoryID uuid.UUID, finishedOnly bool) ([]TaskRecord, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	q := r.db.GenerationTask.Query().Where(generationtask.DeletedEQ(false))
	if !isAdmin {
		q = q.Where(generationtask.UserIDEQ(userID))
	} else if filterUserID != uuid.Nil {
		// admin 按指定用户筛选；Nil 返回全部用户
		q = q.Where(generationtask.UserIDEQ(filterUserID))
	}
	if status != "" {
		q = q.Where(generationtask.StatusEQ(status))
	} else if finishedOnly {
		q = q.Where(generationtask.StatusIn("completed", "failed", "cancelled"))
	}
	if startTime != nil {
		q = q.Where(generationtask.CreatedAtGTE(*startTime))
	}
	if endTime != nil {
		q = q.Where(generationtask.CreatedAtLTE(*endTime))
	}
	if taskID != uuid.Nil {
		q = q.Where(generationtask.IDEQ(taskID))
	}
	if categoryID != uuid.Nil {
		q = q.Where(generationtask.CategoryIDEQ(categoryID))
	}
	total, err := q.Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	tasks, err := q.Order(db.Desc(generationtask.FieldCreatedAt)).
		Offset((page - 1) * pageSize).Limit(pageSize).All(ctx)
	if err != nil {
		return nil, 0, err
	}
	if len(tasks) == 0 {
		return []TaskRecord{}, total, nil
	}
	channelIDs := make([]uuid.UUID, 0, len(tasks))
	for _, task := range tasks {
		if task.ChannelID != uuid.Nil {
			channelIDs = append(channelIDs, task.ChannelID)
		}
	}
	channelNames := map[uuid.UUID]string{}
	if len(channelIDs) > 0 {
		channels, err := r.db.ModelChannel.Query().Where(modelchannel.IDIn(channelIDs...)).All(ctx)
		if err != nil {
			return nil, 0, err
		}
		for _, channel := range channels {
			channelNames[channel.ID] = channel.Name
		}
	}
	taskIDs := make([]uuid.UUID, 0, len(tasks))
	for _, t := range tasks {
		taskIDs = append(taskIDs, t.ID)
	}
	// 审计表保存的是调用当时的线路与模型快照。旧任务没有 channel_id 时，
	// 用首条调用记录回填展示值，不依赖后来可能被修改的线路配置。
	auditRows, err := r.db.GenerationModelInvocation.Query().
		Where(generationmodelinvocation.TaskIDIn(taskIDs...)).
		Order(db.Asc(generationmodelinvocation.FieldRequestedAt)).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}
	auditRoute := map[uuid.UUID]struct{ channelName, modelID string }{}
	for _, row := range auditRows {
		if _, exists := auditRoute[row.TaskID]; exists {
			continue
		}
		auditRoute[row.TaskID] = struct{ channelName, modelID string }{channelName: row.ChannelName, modelID: row.ModelID}
	}
	allImages, err := r.db.GenerationImage.Query().
		Where(generationimage.TaskIDIn(taskIDs...), generationimage.DeletedEQ(false)).
		Order(db.Asc(generationimage.FieldImageNumber)).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}
	imageMap := make(map[uuid.UUID][]ImageRecord, len(tasks))
	for _, img := range allImages {
		// 仅 success 子图计入 Images，避免 failed（url 空）导致前端破裂图
		if img.Status != "success" || img.URL == "" {
			continue
		}
		imageMap[img.TaskID] = append(imageMap[img.TaskID], ImageRecord{
			ID:          img.ID,
			Name:        img.Name,
			URL:         img.URL,
			DownloadURL: img.DownloadURL,
			ThumbURL:    img.ThumbURL,
			Source:      img.Source,
		})
	}
	out := make([]TaskRecord, 0, len(tasks))
	for _, t := range tasks {
		rec := taskToRecord(t)
		rec.ChannelName = channelNames[t.ChannelID]
		if snapshot, ok := auditRoute[t.ID]; ok {
			if rec.ChannelName == "" {
				rec.ChannelName = snapshot.channelName
			}
			if rec.Model == "" {
				rec.Model = snapshot.modelID
			}
		}
		rec.Images = imageMap[t.ID]
		if rec.Images == nil {
			rec.Images = []ImageRecord{}
		}
		out = append(out, rec)
	}
	return out, total, nil
}

// CancelTask 置 cancelled（worker 检测 ctx 取消后调）。
func (r *Repo) CancelTask(ctx context.Context, taskID uuid.UUID) error {
	return r.db.GenerationTask.UpdateOneID(taskID).
		SetStatus("cancelled").
		SetCompletedAt(time.Now()).
		Exec(ctx)
}

// UpdateTaskFeedback 更新任务的小红书发布反馈（用户回填笔记链接 + 数据指标）。
func (r *Repo) UpdateTaskFeedback(ctx context.Context, taskID uuid.UUID, fb types.TaskFeedback) error {
	return r.db.GenerationTask.UpdateOneID(taskID).
		SetFeedback(fb).
		Exec(ctx)
}

// IsTaskCancelled 查任务是否已取消（worker 循环检测）。
func (r *Repo) IsTaskCancelled(ctx context.Context, taskID uuid.UUID) (bool, error) {
	t, err := r.db.GenerationTask.Get(ctx, taskID)
	if err != nil {
		return false, err
	}
	return t.Status == "cancelled", nil
}

// CountActiveTasks 统计用户进行中任务数（queued/processing），用于限流。
// 对应 Node countActiveTasks（index.mjs:804）。
func (r *Repo) CountActiveTasks(ctx context.Context, userID uuid.UUID) (int, error) {
	return r.db.GenerationTask.Query().
		Where(
			generationtask.UserIDEQ(userID),
			generationtask.StatusIn("queued", "processing"),
		).
		Count(ctx)
}

// MarkInterruptedTasksFailed 启动崩溃恢复：把所有 queued/processing 的任务标为 failed，
// 并把对应 pending/processing 子图也标 failed。前端轮询拿到 failed 状态后提示用户重试。
// 设计决策：不自动恢复 goroutine（goroutine 仅在 HTTP 请求时触发），改为让用户重试，简单可靠。
func (r *Repo) MarkInterruptedTasksFailed(ctx context.Context) (int, error) {
	tasks, err := r.db.GenerationTask.Query().
		Where(generationtask.StatusIn("queued", "processing")).
		All(ctx)
	if err != nil {
		return 0, err
	}
	if len(tasks) == 0 {
		return 0, nil
	}
	const interruptMsg = "服务重启，任务中断，请重试。"
	now := time.Now()
	for _, t := range tasks {
		if err := r.db.GenerationTask.UpdateOneID(t.ID).
			SetStatus("failed").
			SetError(interruptMsg).
			SetCompletedAt(now).
			Exec(ctx); err != nil {
			return 0, err
		}
		// 子图：pending/processing 标 failed（已 success/failed 的不动）
		if _, err := r.db.GenerationImage.Update().
			Where(
				generationimage.TaskIDEQ(t.ID),
				generationimage.StatusIn("pending", "processing"),
			).
			SetStatus("failed").
			SetError(interruptMsg).
			Save(ctx); err != nil {
			return 0, err
		}
	}
	return len(tasks), nil
}

// refImagesToRecords types.ReferenceImage -> ImageRecord（参考图，source=reference，保留 kind 区分 scene/product）。
func refImagesToRecords(refs []types.ReferenceImage) []ImageRecord {
	out := make([]ImageRecord, len(refs))
	for i, r := range refs {
		out[i] = ImageRecord{
			ID:          fmt.Sprintf("ref-%d", i+1),
			Name:        r.Name,
			URL:         r.URL,
			DownloadURL: r.URL,
			Source:      "reference",
			Kind:        r.Kind,
		}
	}
	return out
}

// recordsToRefImages ImageRecord -> types.ReferenceImage（存 url + name + kind）。
func recordsToRefImages(recs []ImageRecord) []types.ReferenceImage {
	out := make([]types.ReferenceImage, len(recs))
	for i, r := range recs {
		out[i] = types.ReferenceImage{URL: r.URL, Name: r.Name, Kind: r.Kind}
	}
	return out
}

// taskToRecord ent GenerationTask -> TaskRecord。
func taskToRecord(t *db.GenerationTask) TaskRecord {
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
		Error:              t.Error,
		PromptHash:         t.PromptHash,
		UploadedImageCount: t.UploadedImageCount,
		LatencyMs:          t.LatencyMs,
		TotalCount:         t.TotalCount,
		CompletedCount:     t.CompletedCount,
		EstimatedSeconds:   t.EstimatedSeconds,
		CategoryID:         t.CategoryID,
		ChannelID:          t.ChannelID,
		ReferenceImages:    refImagesToRecords(t.ReferenceImages),
		Prompts:            t.Prompts,
	}
	if t.Feedback.SubmittedAt != "" {
		fb := t.Feedback
		rec.Feedback = &fb
	}
	if !t.StartedAt.IsZero() {
		sa := t.StartedAt
		rec.StartedAt = &sa
	}
	if !t.CompletedAt.IsZero() {
		ca := t.CompletedAt
		rec.CompletedAt = &ca
	}
	if rec.Tags == nil {
		rec.Tags = []string{}
	}
	return rec
}

// CleanupExpired 逻辑删除过期任务及其图片（MinIO 文件保留）。cutoff 之前未删的 task 标 deleted=true。
// 从 cleanup.go 迁入：数据访问归 repo 层，Usecase.CleanupExpired 只做 cutoff 计算与日志。
func (r *Repo) CleanupExpired(ctx context.Context, cutoff time.Time) (nTask, nImage int, err error) {
	taskIDs, err := r.db.GenerationTask.Query().
		Where(generationtask.DeletedEQ(false), generationtask.CreatedAtLT(cutoff)).
		IDs(ctx)
	if err != nil {
		return 0, 0, err
	}
	if len(taskIDs) == 0 {
		return 0, 0, nil
	}
	now := time.Now()
	nTask, err = r.db.GenerationTask.Update().
		Where(generationtask.IDIn(taskIDs...), generationtask.DeletedEQ(false)).
		SetDeleted(true).SetDeletedAt(now).Save(ctx)
	if err != nil {
		return 0, 0, err
	}
	nImage, err = r.db.GenerationImage.Update().
		Where(generationimage.TaskIDIn(taskIDs...), generationimage.DeletedEQ(false)).
		SetDeleted(true).SetDeletedAt(now).Save(ctx)
	if err != nil {
		return nTask, 0, err
	}
	return nTask, nImage, nil
}
