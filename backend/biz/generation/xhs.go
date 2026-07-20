package generation

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
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

const (
	maxUserXHSLinkEdits = 3
)

var xhsURLPattern = regexp.MustCompile(`(?i)https?://[^\s<>"']+`)

// xhsRefreshIntervals 自动采集节奏：提交后立即首次采集，之后按 1d -> 7d -> 15d 推进，
// 第 3 次起稳定 15d 持续不停止。索引 = 当前 epoch 内 success 快照数 - 1（cap 到末位）。
var xhsRefreshIntervals = []time.Duration{
	24 * time.Hour,      // 第 1 次采后 +1d
	7 * 24 * time.Hour,  // 第 2 次采后 +7d
	15 * 24 * time.Hour, // 第 3 次采后 +15d
	15 * 24 * time.Hour, // 第 4 次及以后 +15d
}

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
	UserLinkEditCount      int                   `json:"userLinkEditCount"`
	UserLinkEditsRemaining *int                  `json:"userLinkEditsRemaining,omitempty"`
	NextRefreshAt          *time.Time            `json:"nextRefreshAt,omitempty"`
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

// Import 只存储笔记链接并设 next_refresh_at=now，提交过程不采集数据。
// 首次采集由 triggerAutoCollect 异步触发（贴合"立即首次"且不阻塞提交），后续按 1/7/15 由后台 ticker 推进。
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
		return nil, &redfox.Error{StatusCode: http.StatusConflict, Message: "该生图记录已关联小红书笔记，请使用修改链接。"}
	} else if err != nil && !db.IsNotFound(err) {
		return nil, err
	}
	tracking, err := u.db.XHSNoteTracking.Create().
		SetTaskID(taskID).
		SetUserID(task.UserID).
		SetNoteURL(noteURL).
		SetNextRefreshAt(time.Now()).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	u.triggerAutoCollect(tracking)
	return u.Get(ctx, user, taskID)
}

// UpdateLink 只存储新链接并重置采集节奏（link_epoch+1、next_refresh_at=now），不立即采集。
// 旧 epoch 快照保留入库，前端只展示当前 epoch；新链接首次采集由 triggerAutoCollect 异步触发。
func (u *XHSUsecase) UpdateLink(ctx context.Context, user *domain.User, taskID uuid.UUID, req XHSNoteImportReq) (*XHSNoteResponse, error) {
	noteURL, err := normalizeXHSURL(req.NoteURL)
	if err != nil {
		return nil, redfoxURLInputError(err)
	}
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
	if noteURL == tracking.NoteURL {
		return nil, redfoxURLInputError(fmt.Errorf("小红书笔记链接未变化"))
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	if !isAdmin && tracking.UserLinkEditCount >= maxUserXHSLinkEdits {
		return nil, redfoxURLInputError(fmt.Errorf("本笔记链接已用完 %d 次修改机会", maxUserXHSLinkEdits))
	}
	// 旧链接回填字段清空，等新链接采集后由 collectOnce 回填。
	update := u.db.XHSNoteTracking.UpdateOneID(tracking.ID).
		SetNoteURL(noteURL).
		SetCanonicalURL("").
		SetWorkID("").
		SetAccountUserID("").
		SetAccountID("").
		SetTitle("").
		SetBody("").
		SetCoverURL("").
		SetWorkType("").
		SetPublishedAt("").
		AddLinkEpoch(1).
		SetNextRefreshAt(time.Now())
	if !isAdmin {
		update = update.AddUserLinkEditCount(1)
	}
	updated, err := update.Save(ctx)
	if err != nil {
		return nil, err
	}
	u.triggerAutoCollect(updated)
	return u.Get(ctx, user, taskID)
}

// Refresh 仅管理员可用：立即采一次（trigger=admin_refresh），不推进 next_refresh_at，不影响自动节奏。
func (u *XHSUsecase) Refresh(ctx context.Context, user *domain.User, taskID uuid.UUID) (*XHSNoteResponse, error) {
	if _, err := u.authorizeTask(ctx, user, taskID); err != nil {
		return nil, err
	}
	if !user.HasUnlimitedImageGeneration() {
		return nil, &redfox.Error{StatusCode: http.StatusForbidden, Message: "数据由系统自动采集，无需手动刷新。"}
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
	if _, err := u.collectOnce(ctx, tracking, "admin_refresh", false); err != nil {
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
	// 只返回当前 link_epoch 的快照，旧链接快照保留入库但不展示，避免趋势混淆。
	snapshots, err := u.db.XHSNoteSnapshot.Query().
		Where(xhsnotesnapshot.TrackingIDEQ(tracking.ID), xhsnotesnapshot.LinkEpochEQ(tracking.LinkEpoch)).
		Order(db.Asc(xhsnotesnapshot.FieldSequence)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	resp := &XHSNoteResponse{
		ID:                tracking.ID.String(),
		TaskID:            tracking.TaskID.String(),
		NoteURL:           tracking.NoteURL,
		CanonicalURL:      tracking.CanonicalURL,
		WorkID:            tracking.WorkID,
		Title:             tracking.Title,
		Body:              tracking.Body,
		CoverURL:          tracking.CoverURL,
		WorkType:          tracking.WorkType,
		PublishedAt:       tracking.PublishedAt,
		UserRefreshCount:  tracking.UserRefreshCount,
		UserLinkEditCount: tracking.UserLinkEditCount,
		NextRefreshAt:     tracking.NextRefreshAt,
		Snapshots:         make([]XHSNoteSnapshotResp, 0, len(snapshots)),
	}
	if !user.HasUnlimitedImageGeneration() {
		linkEditsRemaining := max(0, maxUserXHSLinkEdits-tracking.UserLinkEditCount)
		resp.UserLinkEditsRemaining = &linkEditsRemaining
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

// collectOnce 采集一次并追加快照、回填 tracking 基础字段。
// advanceSchedule=true 时按 1/7/15 节奏推进 next_refresh_at（后台自动采集用）；
// false 时不动 next_refresh_at（admin 手动刷新用，不影响自动节奏）。
// 采集失败落一条 status=failed 快照（保留入库），advanceSchedule=true 时短重试 1h。
func (u *XHSUsecase) collectOnce(ctx context.Context, tracking *db.XHSNoteTracking, trigger string, advanceSchedule bool) (*db.XHSNoteSnapshot, error) {
	work, account, similar, warn, err := u.collect(ctx, tracking.NoteURL, tracking.AccountUserID)
	sequence, seqErr := u.db.XHSNoteSnapshot.Query().Where(xhsnotesnapshot.TrackingIDEQ(tracking.ID)).Count(ctx)
	if seqErr != nil {
		return nil, seqErr
	}
	if err != nil {
		// QueryWork 失败：落 failed 快照，不推进节奏、短重试。
		snap, snapErr := u.createSnapshot(ctx, tracking, sequence+1, trigger, "failed", safeProviderMessage(err), work, account, similar)
		if advanceSchedule {
			u.db.XHSNoteTracking.UpdateOneID(tracking.ID).SetNextRefreshAt(time.Now().Add(time.Hour)).Exec(ctx)
		}
		if snapErr != nil {
			return nil, snapErr
		}
		return snap, err
	}
	snap, err := u.createSnapshot(ctx, tracking, sequence+1, trigger, "success", warn, work, account, similar)
	if err != nil {
		return nil, err
	}
	update := u.db.XHSNoteTracking.UpdateOneID(tracking.ID).
		SetCanonicalURL(firstNonEmpty(work.WorkURL, tracking.NoteURL)).
		SetWorkID(firstNonEmpty(work.WorkID, tracking.WorkID)).
		SetAccountUserID(firstNonEmpty(account.UserID, work.AccountUserID, tracking.AccountUserID)).
		SetAccountID(firstNonEmpty(account.AccountID, tracking.AccountID)).
		SetTitle(firstNonEmpty(work.WorkTitle, tracking.Title)).
		SetBody(firstNonEmpty(work.WorkDesc, tracking.Body)).
		SetCoverURL(firstNonEmpty(work.CoverURL, tracking.CoverURL)).
		SetWorkType(firstNonEmpty(work.WorkType, tracking.WorkType)).
		SetPublishedAt(firstNonEmpty(work.WorkPublishTime, tracking.PublishedAt))
	if advanceSchedule {
		successCount, _ := u.db.XHSNoteSnapshot.Query().
			Where(xhsnotesnapshot.TrackingIDEQ(tracking.ID), xhsnotesnapshot.LinkEpochEQ(tracking.LinkEpoch), xhsnotesnapshot.StatusEQ("success")).Count(ctx)
		update = update.SetNextRefreshAt(time.Now().Add(nextRefreshAfter(successCount)))
	}
	if err := update.Exec(ctx); err != nil {
		return nil, err
	}
	return snap, nil
}

// triggerAutoCollect 后台异步触发首次采集，提交过程不阻塞；采集落库后前端 Get 可见。
func (u *XHSUsecase) triggerAutoCollect(tracking *db.XHSNoteTracking) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				u.logger.Error("async xhs collect panicked", "trackingId", tracking.ID, "panic", r)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if _, err := u.collectOnce(ctx, tracking, "auto", true); err != nil {
			u.logger.Warn("async xhs collect failed", "trackingId", tracking.ID, "error", err)
		}
	}()
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
		return work, redfox.Account{}, redfox.SimilarResult{}, "账号标识未返回，暂时无法采集账号数据。", nil
	}
	account, accountErr := client.QueryAccount(ctx, accountUserID)
	// 对标账号数据不再获取（需求4）：注释掉 QuerySimilarAccounts，similar 留空，字段保留以便未来恢复。
	// similar, similarErr := client.QuerySimilarAccounts(ctx, accountUserID)
	warnings := make([]string, 0, 1)
	if accountErr != nil {
		warnings = append(warnings, "账号基础数据未获取："+safeProviderMessage(accountErr))
	}
	// if similarErr != nil { warnings = append(warnings, "相似账号未获取："+safeProviderMessage(similarErr)) }
	return work, account, redfox.SimilarResult{}, strings.Join(warnings, "；"), nil
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

func (u *XHSUsecase) createSnapshot(ctx context.Context, tracking *db.XHSNoteTracking, sequence int, trigger, status, errMsg string, work redfox.Work, account redfox.Account, similar redfox.SimilarResult) (*db.XHSNoteSnapshot, error) {
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
		SetStatus(status).
		SetError(errMsg).
		SetLinkEpoch(tracking.LinkEpoch).
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
	candidate := strings.TrimRight(strings.TrimSpace(xhsURLPattern.FindString(raw)), ".,;!?，。；！？、)]}）】》〉」』\"'")
	if candidate == "" {
		return "", fmt.Errorf("请粘贴包含小红书笔记链接的分享内容")
	}
	parsed, err := url.Parse(candidate)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return "", fmt.Errorf("请填写有效的小红书笔记链接")
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

// nextRefreshAfter 根据当前 epoch 内 success 快照数返回距下次采集的间隔。
func nextRefreshAfter(successCount int) time.Duration {
	idx := successCount - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(xhsRefreshIntervals) {
		idx = len(xhsRefreshIntervals) - 1
	}
	return xhsRefreshIntervals[idx]
}
