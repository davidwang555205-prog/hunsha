package generation

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/biz/generation/redfox"
	"bridal/backend/biz/syssetting"
	"bridal/backend/config"
	"bridal/backend/db"
	"bridal/backend/db/xhsnotesnapshot"
	"bridal/backend/db/xhsnotetracking"
	"bridal/backend/domain"
	"bridal/backend/ent/types"
)

const maxUserXHSRefreshes = 7

// XHSUsecase owns note tracking separately from the legacy feedback JSON field.
// Snapshot rows are append-only so numerical deltas always have a real baseline.
type XHSUsecase struct {
	db           *db.Client
	tasks        *Repo
	settings     *syssetting.Usecase
	redfoxConfig redfox.Config
	logger       *slog.Logger
	locks        sync.Map // task UUID -> *sync.Mutex; stops duplicate local clicks from spending twice
}

func NewXHSUsecase(i *do.Injector) (*XHSUsecase, error) {
	cfg := do.MustInvoke[*config.Config](i)
	return &XHSUsecase{
		db:       do.MustInvoke[*db.Client](i),
		tasks:    do.MustInvoke[*Repo](i),
		settings: do.MustInvoke[*syssetting.Usecase](i),
		redfoxConfig: redfox.Config{
			APIBaseURL: cfg.Bridal.RedfoxAPIBaseURL,
			Timeout:    time.Duration(cfg.Bridal.RedfoxTimeoutMs) * time.Millisecond,
		},
		logger: do.MustInvoke[*slog.Logger](i).With("module", "generation.xhs"),
	}, nil
}

type XHSNoteImportReq struct {
	NoteURL string `json:"noteUrl"`
}

type XHSNoteResponse struct {
	ID                     string                `json:"id"`
	TaskID                 string                `json:"taskId"`
	NoteURL                string                `json:"noteUrl"`
	CanonicalURL           string                `json:"canonicalUrl"`
	WorkID                 string                `json:"workId"`
	Title                  string                `json:"title"`
	Body                   string                `json:"body"`
	CoverURL               string                `json:"coverUrl"`
	WorkType               string                `json:"workType"`
	PublishedAt            string                `json:"publishedAt"`
	UserRefreshCount       int                   `json:"userRefreshCount"`
	UserRefreshesRemaining *int                  `json:"userRefreshesRemaining,omitempty"`
	Snapshots              []XHSNoteSnapshotResp `json:"snapshots"`
}

type XHSNoteSnapshotResp struct {
	ID              string                    `json:"id"`
	Sequence        int                       `json:"sequence"`
	Trigger         string                    `json:"trigger"`
	Status          string                    `json:"status"`
	Error           string                    `json:"error,omitempty"`
	CapturedAt      time.Time                 `json:"capturedAt"`
	WorkUpdatedAt   string                    `json:"workUpdatedAt"`
	Views           int                       `json:"views"`
	Likes           int                       `json:"likes"`
	Collects        int                       `json:"collects"`
	Comments        int                       `json:"comments"`
	Shares          int                       `json:"shares"`
	Account         XHSAccountResp            `json:"account"`
	SimilarAccounts []types.XHSSimilarAccount `json:"similarAccounts"`
	SimilarSummary  string                    `json:"similarSummary"`
}

type XHSAccountResp struct {
	Name        string `json:"name"`
	Avatar      string `json:"avatar"`
	DisplayID   string `json:"displayId"`
	UserID      string `json:"userId"`
	Description string `json:"description"`
	Fans        int    `json:"fans"`
	TotalWorks  int    `json:"totalWorks"`
	Likes       int    `json:"likes"`
	Collects    int    `json:"collects"`
	Follows     int    `json:"follows"`
	UpdatedAt   string `json:"updatedAt"`
}

func (u *XHSUsecase) Import(ctx context.Context, user *domain.User, taskID uuid.UUID, req XHSNoteImportReq) (*XHSNoteResponse, error) {
	noteURL, err := normalizeXHSURL(req.NoteURL)
	if err != nil {
		return nil, redfoxURLInputError(err)
	}
	task, err := u.authorizeTask(ctx, user, taskID)
	if err != nil {
		return nil, err
	}
	lock := u.taskLock(taskID)
	lock.Lock()
	defer lock.Unlock()
	if existing, err := u.db.XHSNoteTracking.Query().Where(xhsnotetracking.TaskIDEQ(taskID)).Only(ctx); err == nil && existing != nil {
		return nil, &redfox.Error{StatusCode: http.StatusConflict, Message: "该生图记录已关联小红书笔记，请使用刷新数据。"}
	} else if err != nil && !db.IsNotFound(err) {
		return nil, err
	}
	work, account, similar, warn, err := u.collect(ctx, noteURL, "")
	if err != nil {
		return nil, err
	}
	tracking, err := u.db.XHSNoteTracking.Create().
		SetTaskID(taskID).
		SetUserID(task.UserID).
		SetNoteURL(noteURL).
		SetCanonicalURL(firstNonEmpty(work.WorkURL, noteURL)).
		SetWorkID(work.WorkID).
		SetAccountUserID(firstNonEmpty(account.UserID, work.AccountUserID)).
		SetAccountID(account.AccountID).
		SetTitle(work.WorkTitle).
		SetBody(work.WorkDesc).
		SetCoverURL(work.CoverURL).
		SetWorkType(work.WorkType).
		SetPublishedAt(work.WorkPublishTime).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := u.createSnapshot(ctx, tracking, 1, "initial", work, account, similar, warn); err != nil {
		return nil, err
	}
	return u.Get(ctx, user, taskID)
}

func (u *XHSUsecase) Refresh(ctx context.Context, user *domain.User, taskID uuid.UUID) (*XHSNoteResponse, error) {
	if _, err := u.authorizeTask(ctx, user, taskID); err != nil {
		return nil, err
	}
	lock := u.taskLock(taskID)
	lock.Lock()
	defer lock.Unlock()
	tracking, err := u.db.XHSNoteTracking.Query().Where(xhsnotetracking.TaskIDEQ(taskID)).Only(ctx)
	if db.IsNotFound(err) {
		return nil, redfoxURLInputError(fmt.Errorf("请先填写小红书笔记链接"))
	}
	if err != nil {
		return nil, err
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	if !isAdmin && tracking.UserRefreshCount >= maxUserXHSRefreshes {
		return nil, redfoxURLInputError(fmt.Errorf("本笔记已用完 %d 次刷新机会", maxUserXHSRefreshes))
	}
	work, account, similar, warn, err := u.collect(ctx, tracking.NoteURL, tracking.AccountUserID)
	if err != nil {
		return nil, err
	}
	sequence, err := u.db.XHSNoteSnapshot.Query().Where(xhsnotesnapshot.TrackingIDEQ(tracking.ID)).Count(ctx)
	if err != nil {
		return nil, err
	}
	trigger := "user_refresh"
	if isAdmin {
		trigger = "admin_refresh"
	}
	if _, err := u.createSnapshot(ctx, tracking, sequence+1, trigger, work, account, similar, warn); err != nil {
		return nil, err
	}
	update := u.db.XHSNoteTracking.UpdateOneID(tracking.ID).
		SetCanonicalURL(firstNonEmpty(work.WorkURL, tracking.CanonicalURL)).
		SetWorkID(firstNonEmpty(work.WorkID, tracking.WorkID)).
		SetAccountUserID(firstNonEmpty(account.UserID, work.AccountUserID, tracking.AccountUserID)).
		SetAccountID(firstNonEmpty(account.AccountID, tracking.AccountID)).
		SetTitle(firstNonEmpty(work.WorkTitle, tracking.Title)).
		SetBody(firstNonEmpty(work.WorkDesc, tracking.Body)).
		SetCoverURL(firstNonEmpty(work.CoverURL, tracking.CoverURL)).
		SetWorkType(firstNonEmpty(work.WorkType, tracking.WorkType)).
		SetPublishedAt(firstNonEmpty(work.WorkPublishTime, tracking.PublishedAt))
	if !isAdmin {
		update = update.AddUserRefreshCount(1)
	}
	if err := update.Exec(ctx); err != nil {
		return nil, err
	}
	return u.Get(ctx, user, taskID)
}

func (u *XHSUsecase) Get(ctx context.Context, user *domain.User, taskID uuid.UUID) (*XHSNoteResponse, error) {
	if _, err := u.authorizeTask(ctx, user, taskID); err != nil {
		return nil, err
	}
	tracking, err := u.db.XHSNoteTracking.Query().Where(xhsnotetracking.TaskIDEQ(taskID)).Only(ctx)
	if db.IsNotFound(err) {
		return nil, redfoxURLInputError(fmt.Errorf("尚未关联小红书笔记"))
	}
	if err != nil {
		return nil, err
	}
	snapshots, err := u.db.XHSNoteSnapshot.Query().
		Where(xhsnotesnapshot.TrackingIDEQ(tracking.ID)).
		Order(db.Asc(xhsnotesnapshot.FieldSequence)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	resp := &XHSNoteResponse{
		ID:               tracking.ID.String(),
		TaskID:           tracking.TaskID.String(),
		NoteURL:          tracking.NoteURL,
		CanonicalURL:     tracking.CanonicalURL,
		WorkID:           tracking.WorkID,
		Title:            tracking.Title,
		Body:             tracking.Body,
		CoverURL:         tracking.CoverURL,
		WorkType:         tracking.WorkType,
		PublishedAt:      tracking.PublishedAt,
		UserRefreshCount: tracking.UserRefreshCount,
		Snapshots:        make([]XHSNoteSnapshotResp, 0, len(snapshots)),
	}
	if !user.HasUnlimitedImageGeneration() {
		remaining := max(0, maxUserXHSRefreshes-tracking.UserRefreshCount)
		resp.UserRefreshesRemaining = &remaining
	}
	for _, snapshot := range snapshots {
		resp.Snapshots = append(resp.Snapshots, snapshotResponse(snapshot))
	}
	return resp, nil
}

func (u *XHSUsecase) authorizeTask(ctx context.Context, user *domain.User, taskID uuid.UUID) (*TaskRecord, error) {
	task, err := u.tasks.GetTask(ctx, taskID)
	if err != nil || task == nil {
		return nil, &redfox.Error{StatusCode: http.StatusNotFound, Message: "任务不存在。"}
	}
	if !user.HasUnlimitedImageGeneration() && task.UserID != user.ID {
		return nil, &redfox.Error{StatusCode: http.StatusForbidden, Message: "无权查看或更新他人的小红书数据。"}
	}
	return task, nil
}

func (u *XHSUsecase) collect(ctx context.Context, noteURL, fallbackAccountUserID string) (redfox.Work, redfox.Account, redfox.SimilarResult, string, error) {
	client, err := u.redfoxClient(ctx)
	if err != nil {
		return redfox.Work{}, redfox.Account{}, redfox.SimilarResult{}, "", err
	}
	work, err := client.QueryWork(ctx, noteURL)
	if err != nil {
		return redfox.Work{}, redfox.Account{}, redfox.SimilarResult{}, "", err
	}
	accountUserID := firstNonEmpty(work.AccountUserID, fallbackAccountUserID)
	if accountUserID == "" {
		return work, redfox.Account{}, redfox.SimilarResult{}, "账号标识未返回，暂时无法采集账号和相似账号数据。", nil
	}
	account, accountErr := client.QueryAccount(ctx, accountUserID)
	similar, similarErr := client.QuerySimilarAccounts(ctx, accountUserID)
	warnings := make([]string, 0, 2)
	if accountErr != nil {
		warnings = append(warnings, "账号基础数据未获取："+safeProviderMessage(accountErr))
	}
	if similarErr != nil {
		warnings = append(warnings, "相似账号未获取："+safeProviderMessage(similarErr))
	}
	return work, account, similar, strings.Join(warnings, "；"), nil
}

// redfoxClient reads the key for every collection. Replacing the key from the
// administrator settings page therefore takes effect immediately, without an
// application restart or an environment-file change.
func (u *XHSUsecase) redfoxClient(ctx context.Context) (*redfox.Client, error) {
	apiKey, err := u.settings.GetRedfoxAPIKey(ctx)
	if err != nil {
		u.logger.ErrorContext(ctx, "read Redfox API key failed", "error", err)
		return nil, &redfox.Error{StatusCode: http.StatusServiceUnavailable, Message: "数据获取繁忙，请稍后再试。"}
	}
	if strings.TrimSpace(apiKey) == "" {
		return nil, &redfox.Error{StatusCode: http.StatusServiceUnavailable, Message: "数据获取繁忙，请稍后再试。"}
	}
	cfg := u.redfoxConfig
	cfg.APIKey = apiKey
	return redfox.NewClient(cfg), nil
}

func (u *XHSUsecase) createSnapshot(ctx context.Context, tracking *db.XHSNoteTracking, sequence int, trigger string, work redfox.Work, account redfox.Account, similar redfox.SimilarResult, warning string) (*db.XHSNoteSnapshot, error) {
	items := make([]types.XHSSimilarAccount, 0, len(similar.SameLevelAccounts)+len(similar.HighLevelAccounts))
	for i, item := range similar.SameLevelAccounts {
		items = append(items, similarAccount(item, i+1, "same_level"))
	}
	for i, item := range similar.HighLevelAccounts {
		items = append(items, similarAccount(item, i+1, "high_level"))
	}
	return u.db.XHSNoteSnapshot.Create().
		SetTrackingID(tracking.ID).
		SetSequence(sequence).
		SetTrigger(trigger).
		SetStatus("success").
		SetError(warning).
		SetWorkUpdatedAt(work.WorkUpdateTime).
		SetViews(work.WorkReadedCount).
		SetLikes(work.WorkLikedCount).
		SetCollects(work.WorkCollectedCount).
		SetComments(work.WorkCommentsCount).
		SetShares(work.WorkSharedCount).
		SetAccountName(firstNonEmpty(account.AccountName, work.AccountNickname)).
		SetAccountAvatar(account.AccountAvatar).
		SetAccountDisplayID(account.AccountID).
		SetAccountUserID(firstNonEmpty(account.UserID, work.AccountUserID)).
		SetAccountDescription(account.AccountDesc).
		SetAccountFans(account.AccountFans).
		SetAccountTotalWorks(account.AccountTotalWorks).
		SetAccountLikes(account.AccountLikes).
		SetAccountCollects(account.AccountCollects).
		SetAccountFollows(account.AccountFollows).
		SetAccountUpdatedAt(account.AccountUpdateTime).
		SetSimilarAccounts(items).
		SetSimilarSummary(similarSummary(len(similar.SameLevelAccounts), len(similar.HighLevelAccounts))).
		Save(ctx)
}

func snapshotResponse(snapshot *db.XHSNoteSnapshot) XHSNoteSnapshotResp {
	items := snapshot.SimilarAccounts
	if items == nil {
		items = []types.XHSSimilarAccount{}
	}
	return XHSNoteSnapshotResp{
		ID:            snapshot.ID.String(),
		Sequence:      snapshot.Sequence,
		Trigger:       snapshot.Trigger,
		Status:        snapshot.Status,
		Error:         snapshot.Error,
		CapturedAt:    snapshot.CapturedAt,
		WorkUpdatedAt: snapshot.WorkUpdatedAt,
		Views:         snapshot.Views,
		Likes:         snapshot.Likes,
		Collects:      snapshot.Collects,
		Comments:      snapshot.Comments,
		Shares:        snapshot.Shares,
		Account: XHSAccountResp{
			Name: snapshot.AccountName, Avatar: snapshot.AccountAvatar, DisplayID: snapshot.AccountDisplayID,
			UserID: snapshot.AccountUserID, Description: snapshot.AccountDescription, Fans: snapshot.AccountFans,
			TotalWorks: snapshot.AccountTotalWorks, Likes: snapshot.AccountLikes, Collects: snapshot.AccountCollects,
			Follows: snapshot.AccountFollows, UpdatedAt: snapshot.AccountUpdatedAt,
		},
		SimilarAccounts: items,
		SimilarSummary:  snapshot.SimilarSummary,
	}
}

func similarAccount(item redfox.SimilarAccount, rank int, tier string) types.XHSSimilarAccount {
	return types.XHSSimilarAccount{
		Rank: rank, Tier: tier, AccountID: firstNonEmpty(item.AccountID, item.RedID), Nickname: item.Nickname,
		Avatar: item.Avatar, URL: item.URL, Fans: item.Fans, Level: item.Level, Collected: item.Collected,
		Liked: item.Liked, TotalWork: item.TotalWork, NoteCountSeven: item.NoteCountSeven,
		InteractiveCountSeven: item.InteractiveCountSeven, InteractiveCountThirty: item.InteractiveCountThirty,
	}
}

func normalizeXHSURL(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", fmt.Errorf("请填写有效的小红书 HTTPS 笔记链接")
	}
	host := strings.ToLower(parsed.Hostname())
	switch host {
	case "xiaohongshu.com", "www.xiaohongshu.com", "xhslink.com", "www.xhslink.com":
		return parsed.String(), nil
	default:
		return "", fmt.Errorf("仅支持小红书笔记链接")
	}
}

func (u *XHSUsecase) taskLock(taskID uuid.UUID) *sync.Mutex {
	lock, _ := u.locks.LoadOrStore(taskID, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

func redfoxURLInputError(err error) error {
	if providerErr, ok := err.(*redfox.Error); ok {
		return providerErr
	}
	return &redfox.Error{StatusCode: http.StatusBadRequest, Message: err.Error()}
}

func safeProviderMessage(err error) string {
	if providerErr, ok := err.(*redfox.Error); ok {
		return providerErr.Message
	}
	return "服务暂时不可用"
}

func similarSummary(sameCount, highCount int) string {
	if sameCount == 0 && highCount == 0 {
		return "暂未匹配到相似账号。"
	}
	return fmt.Sprintf("已匹配 %d 个同阶对标账号和 %d 个高阶标杆账号。", sameCount, highCount)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
