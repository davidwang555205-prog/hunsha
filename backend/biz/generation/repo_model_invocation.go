package generation

import (
	"context"
	"time"

	"github.com/google/uuid"

	"bridal/backend/db"
	"bridal/backend/db/generationmodelinvocation"
	"bridal/backend/ent/types"
)

// ModelInvocationRecord 是一次真实上游模型 HTTP 请求的不可变请求快照和完成结果。
// 敏感凭证、参考图 Base64、完整上游响应体均不进入该结构或数据库。
type ModelInvocationRecord struct {
	ID                 uuid.UUID                        `json:"id"`
	TaskID             uuid.UUID                        `json:"taskId"`
	GenerationImageID  string                           `json:"generationImageId"`
	ImageNumber        int                              `json:"imageNumber"`
	UserID             uuid.UUID                        `json:"userId"`
	Username           string                           `json:"username"`
	UserEmail          string                           `json:"userEmail"`
	UserRole           string                           `json:"userRole"`
	ChannelID          uuid.UUID                        `json:"channelId"`
	ChannelName        string                           `json:"channelName"`
	APIBaseURL         string                           `json:"apiBaseUrl"`
	Protocol           string                           `json:"protocol"`
	ModelID            string                           `json:"modelId"`
	CandidateIndex     int                              `json:"candidateIndex"`
	CandidateCount     int                              `json:"candidateCount"`
	AttemptNumber      int                              `json:"attemptNumber"`
	AttemptBudget      int                              `json:"attemptBudget"`
	Status             string                           `json:"status"`
	Prompt             string                           `json:"prompt"`
	PromptHash         string                           `json:"promptHash"`
	ReferenceImages    []types.ModelInvocationReference `json:"referenceImages"`
	Size               string                           `json:"size"`
	Quality            string                           `json:"quality"`
	HTTPStatus         int                              `json:"httpStatus"`
	LatencyMs          int                              `json:"latencyMs"`
	ResponseImageCount int                              `json:"responseImageCount"`
	Error              string                           `json:"error"`
	RequestedAt        time.Time                        `json:"requestedAt"`
	CompletedAt        *time.Time                       `json:"completedAt"`
}

// ModelInvocationQuery 是管理员调用审计页的筛选条件。
type ModelInvocationQuery struct {
	TaskID    uuid.UUID
	UserID    uuid.UUID
	ChannelID uuid.UUID
	Status    string
	StartTime *time.Time
	EndTime   *time.Time
	Page      int
	PageSize  int
	Ascending bool // 单任务时间线按真实调用先后展示；后台总览仍默认倒序。
}

func (r *Repo) CreateModelInvocation(ctx context.Context, rec ModelInvocationRecord) error {
	create := r.db.GenerationModelInvocation.Create().
		SetID(rec.ID).
		SetTaskID(rec.TaskID).
		SetGenerationImageID(rec.GenerationImageID).
		SetImageNumber(rec.ImageNumber).
		SetUserID(rec.UserID).
		SetUsername(rec.Username).
		SetUserEmail(rec.UserEmail).
		SetUserRole(rec.UserRole).
		SetChannelName(rec.ChannelName).
		SetAPIBaseURL(rec.APIBaseURL).
		SetProtocol(rec.Protocol).
		SetModelID(rec.ModelID).
		SetCandidateIndex(rec.CandidateIndex).
		SetCandidateCount(rec.CandidateCount).
		SetAttemptNumber(rec.AttemptNumber).
		SetAttemptBudget(rec.AttemptBudget).
		SetStatus(rec.Status).
		SetPrompt(rec.Prompt).
		SetPromptHash(rec.PromptHash).
		SetReferenceImages(rec.ReferenceImages).
		SetSize(rec.Size).
		SetQuality(rec.Quality).
		SetRequestedAt(rec.RequestedAt)
	if rec.ChannelID != uuid.Nil {
		create.SetChannelID(rec.ChannelID)
	}
	if rec.CompletedAt != nil {
		create.SetCompletedAt(*rec.CompletedAt)
	}
	_, err := create.Save(ctx)
	return err
}

func (r *Repo) FinishModelInvocation(ctx context.Context, id uuid.UUID, status string, httpStatus, latencyMs, responseImageCount int, message string, completedAt time.Time) error {
	return r.db.GenerationModelInvocation.UpdateOneID(id).
		SetStatus(status).
		SetHTTPStatus(httpStatus).
		SetLatencyMs(latencyMs).
		SetResponseImageCount(responseImageCount).
		SetError(message).
		SetCompletedAt(completedAt).
		Exec(ctx)
}

func (r *Repo) ListModelInvocations(ctx context.Context, filter ModelInvocationQuery) ([]ModelInvocationRecord, int, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	q := r.db.GenerationModelInvocation.Query()
	if filter.TaskID != uuid.Nil {
		q = q.Where(generationmodelinvocation.TaskIDEQ(filter.TaskID))
	}
	if filter.UserID != uuid.Nil {
		q = q.Where(generationmodelinvocation.UserIDEQ(filter.UserID))
	}
	if filter.ChannelID != uuid.Nil {
		q = q.Where(generationmodelinvocation.ChannelIDEQ(filter.ChannelID))
	}
	if filter.Status != "" {
		q = q.Where(generationmodelinvocation.StatusEQ(filter.Status))
	}
	if filter.StartTime != nil {
		q = q.Where(generationmodelinvocation.RequestedAtGTE(*filter.StartTime))
	}
	if filter.EndTime != nil {
		q = q.Where(generationmodelinvocation.RequestedAtLTE(*filter.EndTime))
	}
	total, err := q.Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	if filter.Ascending {
		q = q.Order(db.Asc(generationmodelinvocation.FieldRequestedAt))
	} else {
		q = q.Order(db.Desc(generationmodelinvocation.FieldRequestedAt))
	}
	rows, err := q.Offset((page - 1) * pageSize).Limit(pageSize).All(ctx)
	if err != nil {
		return nil, 0, err
	}
	out := make([]ModelInvocationRecord, 0, len(rows))
	for _, row := range rows {
		completedAt := row.CompletedAt
		var completed *time.Time
		if !completedAt.IsZero() {
			completed = &completedAt
		}
		out = append(out, ModelInvocationRecord{
			ID: row.ID, TaskID: row.TaskID, GenerationImageID: row.GenerationImageID, ImageNumber: row.ImageNumber,
			UserID: row.UserID, Username: row.Username, UserEmail: row.UserEmail, UserRole: row.UserRole,
			ChannelID: row.ChannelID, ChannelName: row.ChannelName, APIBaseURL: row.APIBaseURL, Protocol: row.Protocol, ModelID: row.ModelID,
			CandidateIndex: row.CandidateIndex, CandidateCount: row.CandidateCount, AttemptNumber: row.AttemptNumber, AttemptBudget: row.AttemptBudget,
			Status: row.Status, Prompt: row.Prompt, PromptHash: row.PromptHash, ReferenceImages: row.ReferenceImages,
			Size: row.Size, Quality: row.Quality, HTTPStatus: row.HTTPStatus, LatencyMs: row.LatencyMs,
			ResponseImageCount: row.ResponseImageCount, Error: row.Error, RequestedAt: row.RequestedAt, CompletedAt: completed,
		})
	}
	return out, total, nil
}
