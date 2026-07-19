package generation

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"bridal/backend/biz/channels"
	"bridal/backend/biz/generation/wala"
	"bridal/backend/domain"
	"bridal/backend/ent/types"
)

// AsyncTaskResp 异步任务详情响应，对应前端 GenerationTask。
type AsyncTaskResp struct {
	ID           string        `json:"id"`
	UserID       string        `json:"userId"`
	CategoryID   *string       `json:"categoryId"`
	ChannelID    *string       `json:"channelId"`
	Status       string        `json:"status"`
	Title        string        `json:"title"`
	Body         string        `json:"body"`
	Tags         []string      `json:"tags"`
	Topic        string        `json:"topic"`
	ResultImages []ImageRecord `json:"resultImages"`
	// ReferenceImages 用户上传的参考图（scene/product），恢复任务时回显。
	ReferenceImages  []ImageRecord       `json:"referenceImages"`
	SubTaskStatus    []SubTaskStatusItem `json:"subTaskStatus"`
	Error            string              `json:"error"`
	TotalCount       int                 `json:"totalCount"`
	CompletedCount   int                 `json:"completedCount"`
	EstimatedSeconds int                 `json:"estimatedSeconds"`
	CreatedAt        string              `json:"createdAt"`
	StartedAt        *string             `json:"startedAt"`
	CompletedAt      *string             `json:"completedAt"`
}

// IsRunning 任务是否仍在运行（可取消）。
func (r TaskRecord) IsRunning() bool {
	return r.Status == "queued" || r.Status == "processing"
}

// sanitizeAsyncTask TaskRecord -> AsyncTaskResp（前端 GenerationTask 契约）。
func sanitizeAsyncTask(rec TaskRecord) AsyncTaskResp {
	resp := AsyncTaskResp{
		ID:               rec.ID.String(),
		UserID:           rec.UserID.String(),
		Status:           rec.Status,
		Title:            rec.Title,
		Body:             rec.Body,
		Tags:             rec.Tags,
		Topic:            rec.Topic,
		ResultImages:     rec.Images,
		ReferenceImages:  rec.ReferenceImages,
		SubTaskStatus:    rec.SubTaskStatus,
		Error:            rec.Error,
		TotalCount:       rec.TotalCount,
		CompletedCount:   rec.CompletedCount,
		EstimatedSeconds: rec.EstimatedSeconds,
		CreatedAt:        rec.CreatedAt.Format(time.RFC3339),
	}
	if resp.Tags == nil {
		resp.Tags = []string{}
	}
	if resp.ResultImages == nil {
		resp.ResultImages = []ImageRecord{}
	}
	if resp.ReferenceImages == nil {
		resp.ReferenceImages = []ImageRecord{}
	}
	if resp.SubTaskStatus == nil {
		resp.SubTaskStatus = []SubTaskStatusItem{}
	}
	if rec.CategoryID != uuid.Nil {
		s := rec.CategoryID.String()
		resp.CategoryID = &s
	}
	if rec.ChannelID != uuid.Nil {
		s := rec.ChannelID.String()
		resp.ChannelID = &s
	}
	if rec.StartedAt != nil {
		s := rec.StartedAt.Format(time.RFC3339)
		resp.StartedAt = &s
	}
	if rec.CompletedAt != nil {
		s := rec.CompletedAt.Format(time.RFC3339)
		resp.CompletedAt = &s
	}
	return resp
}

// SanitizeTask 对外暴露 sanitizeAsyncTask（handler 用）。
func SanitizeTask(rec TaskRecord) AsyncTaskResp {
	return sanitizeAsyncTask(rec)
}

// GetTask 查任务详情（handler 调）。
func (u *Usecase) GetTask(ctx context.Context, taskID uuid.UUID) (*TaskRecord, error) {
	return u.repo.GetTask(ctx, taskID)
}

// ListTasks 分页查任务（handler 调）。startTime/endTime 按 created_at 过滤（nil 不过滤）。
func (u *Usecase) ListTasks(ctx context.Context, userID uuid.UUID, isAdmin bool, page, pageSize int, status string, startTime, endTime *time.Time) ([]TaskRecord, int, error) {
	return u.repo.ListTasksPaged(ctx, userID, isAdmin, page, pageSize, status, startTime, endTime, uuid.Nil, uuid.Nil, uuid.Nil, false)
}

// ListModelInvocations 返回管理员模型调用审计记录。该能力随迁移上线；旧测试 repo 不实现时明确报错。
func (u *Usecase) ListModelInvocations(ctx context.Context, filter ModelInvocationQuery) ([]ModelInvocationRecord, int, error) {
	repo, ok := u.repo.(modelInvocationRepo)
	if !ok {
		return nil, 0, fmt.Errorf("模型调用审计仓储不可用")
	}
	return repo.ListModelInvocations(ctx, filter)
}

// CancelTask 取消任务（handler 调）：置 cancelled，worker 循环检测后停止。
func (u *Usecase) CancelTask(ctx context.Context, taskID uuid.UUID, userID uuid.UUID, isAdmin bool) error {
	rec, err := u.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}
	if rec == nil {
		return wala.NewError(404, "任务不存在。")
	}
	if !isAdmin && rec.UserID != userID {
		return wala.NewError(403, "无权取消他人任务。")
	}
	if !rec.IsRunning() {
		return wala.NewError(400, "任务已结束，无法取消。")
	}
	return u.repo.CancelTask(ctx, taskID)
}

// walaCaller 抽象 wala 调用（CallWithRetries + BuildOverloadMessage），便于测试 callWithFallback 的线路切换逻辑。
// *wala.Client 实现此接口。
type walaCaller interface {
	CallWithAttempts(ctx context.Context, req wala.Request, attempts int) (status int, bodyText string, err error)
	BuildOverloadMessage(message string) string
}

// observedWalaCaller 由真实 wala.Client 实现。保留 walaCaller 的基础接口，避免既有
// worker 测试 fake 耦合审计实现；生产环境则精确记录每一次 HTTP 尝试。
type observedWalaCaller interface {
	CallWithAttemptsObserved(ctx context.Context, req wala.Request, attempts int, observer wala.AttemptObserver) (status int, bodyText string, err error)
}

// channelClient 优先级 fallback 候选链的一个节点。
// id=uuid.Nil 表示 .env 默认 client（不记线路稳定性统计）。
type channelClient struct {
	client         walaCaller
	id             uuid.UUID
	name           string
	apiBaseURL     string
	protocol       string
	modelID        string
	trackStats     bool
	maxConcurrency int // 用户级并发度（=该线路 max_concurrency），控制该用户跨任务同时生成的图片数
}

// defaultImageModelID 返回可审计的默认生图模型。线路模型留空的旧配置也必须在
// 实际请求和调用记录中落成明确值，不能传播为空字符串。
func (u *Usecase) defaultImageModelID() string {
	if u.cfg != nil {
		if modelID := strings.TrimSpace(u.cfg.Bridal.WalaImageModel); modelID != "" {
			return modelID
		}
	}
	return "gpt-image-2"
}

func (u *Usecase) normalizedImageModelID(modelID string) string {
	if modelID = strings.TrimSpace(modelID); modelID != "" {
		return modelID
	}
	return u.defaultImageModelID()
}

// userSem 用户级生图并发信号量：同一用户的所有生图任务共享，跨任务控制该用户同时生成的图片数。
// capacity = 所用主线路 max_concurrency（1=该用户所有图片跨任务逐张串行，N=最多 N 张并发）。
// cond 实现动态容量：admin 改线路 max_concurrency 后，runTask 启动时 setCapacity，新 acquire 立即生效。
type userSem struct {
	mu       sync.Mutex
	cond     *sync.Cond
	active   int // 当前在途图片数
	capacity int // 最大并发度（= 主线路 max_concurrency）
}

func newUserSem(capacity int) *userSem {
	if capacity < 1 {
		capacity = 1
	}
	s := &userSem{capacity: capacity}
	s.cond = sync.NewCond(&s.mu)
	return s
}

// acquire 获取一个并发槽（阻塞至 active < capacity）。
func (s *userSem) acquire() {
	s.mu.Lock()
	for s.active >= s.capacity {
		s.cond.Wait()
	}
	s.active++
	s.mu.Unlock()
}

// release 释放一个并发槽，唤醒一个等待者。
func (s *userSem) release() {
	s.mu.Lock()
	s.active--
	if s.active < 0 {
		s.active = 0
	}
	s.cond.Signal()
	s.mu.Unlock()
}

// setCapacity 更新最大并发度（admin 改线路配置后，runTask 启动时调，立即对新 acquire 生效）。
func (s *userSem) setCapacity(capacity int) {
	if capacity < 1 {
		capacity = 1
	}
	s.mu.Lock()
	old := s.capacity
	s.capacity = capacity
	if capacity > old {
		s.cond.Broadcast() // 容量变大，唤醒等待者重新判断
	}
	s.mu.Unlock()
}

// getUserSem 取该用户的并发信号量（不存在则创建），并更新容量为当前主线路 max_concurrency。
func (u *Usecase) getUserSem(userID uuid.UUID, capacity int) *userSem {
	v, _ := u.userSems.LoadOrStore(userID, newUserSem(capacity))
	s := v.(*userSem)
	s.setCapacity(capacity)
	return s
}

// buildCandidates 构建优先级 fallback 候选线路链（按 sort_order）。
// 用户指定 channelID：该线路排链首，其余启用线路按 sort_order 跟后（去重）。
// 未指定：全部启用线路按 sort_order。无任何启用线路：回退 .env 默认 client。
func (u *Usecase) buildCandidates(ctx context.Context, channelID uuid.UUID) []channelClient {
	var candidates []channelClient
	seen := map[uuid.UUID]bool{}

	addChannel := func(ch *channels.ChannelRecord) {
		if ch == nil || seen[ch.ID] {
			return
		}
		seen[ch.ID] = true
		chQuality := ch.DefaultQuality
		if chQuality == "" {
			chQuality = u.cfg.Bridal.WalaImageQuality
		}
		chModelID := u.normalizedImageModelID(ch.ModelID)
		chTimeoutMs := ch.RequestTimeoutMs
		if chTimeoutMs <= 0 {
			chTimeoutMs = u.cfg.Bridal.WalaImageTimeoutMs
		}
		if chTimeoutMs <= 0 {
			chTimeoutMs = 180000
		}
		// 线路并发度归一化到 [1,10]（防御旧数据 0/负值；上限 10 防压垮中转 API）
		chMC := ch.MaxConcurrency
		if chMC < 1 {
			chMC = 1
		} else if chMC > 10 {
			chMC = 10
		}
		candidates = append(candidates, channelClient{
			client: u.newClient(wala.Config{
				APIKey:         ch.APIKey,
				APIBaseURL:     ch.APIBaseURL,
				ImageModel:     chModelID,
				Timeout:        time.Duration(chTimeoutMs) * time.Millisecond,
				RetryAttempts:  u.cfg.Bridal.WalaImageRetryAttempts,
				DefaultQuality: chQuality,
				Protocol:       ch.Protocol,
			}),
			id:             ch.ID,
			name:           ch.Name,
			apiBaseURL:     ch.APIBaseURL,
			protocol:       ch.Protocol,
			modelID:        chModelID,
			trackStats:     true,
			maxConcurrency: chMC,
		})
	}

	// 用户指定线路优先（排链首，须存在且启用）
	if channelID != uuid.Nil && u.channels != nil {
		if ch, err := u.channels.GetConfigByID(ctx, channelID); err == nil && ch != nil && ch.IsEnabled {
			addChannel(ch)
		}
	}
	// 其余启用线路按 sort_order 跟后
	if u.channels != nil {
		if list, err := u.channels.ListEnabledConfigs(ctx); err == nil {
			for i := range list {
				addChannel(&list[i])
			}
		}
	}

	// 无任何候选：回退 .env 默认 client
	if len(candidates) == 0 {
		apiBaseURL := u.cfg.Bridal.WalaAPIBaseURL
		if apiBaseURL == "" {
			apiBaseURL = "https://walaapi.net/v1"
		}
		modelID := u.defaultImageModelID()
		candidates = append(candidates, channelClient{
			client:         u.wala,
			id:             uuid.Nil,
			name:           "默认",
			apiBaseURL:     apiBaseURL,
			protocol:       "openai",
			modelID:        modelID,
			trackStats:     false,
			maxConcurrency: 1, // .env 默认 client 无线路配置，默认逐张串行
		})
	}
	return candidates
}

// callWithFallback 是无任务上下文调用入口，主要供测试使用。
func (u *Usecase) callWithFallback(ctx context.Context, candidates []channelClient, req wala.Request) (status int, bodyText string, used channelClient, err error) {
	return u.callWithFallbackLogged(ctx, u.logger, candidates, req, nil)
}

// callWithFallbackLogged 按候选线路链顺序调用。重试预算由整个候选链共享：
// 每个非末尾线路只拿一次机会，最后线路拿剩余预算；因此可重试失败会尽早切换，
// 但整个任务仍保留 WalaImageRetryAttempts 次恢复机会。
// 不可重试错误（如普通 400 参数错误）直接返回，不切线路。每个线路尝试均记统计和结构化日志。
func (u *Usecase) callWithFallbackLogged(ctx context.Context, logger *slog.Logger, candidates []channelClient, req wala.Request, meta *invocationMeta) (status int, bodyText string, used channelClient, err error) {
	var lastErr error
	var lastStatus int
	var lastBody string
	var lastUsed channelClient
	attemptBudget := u.retryBudget(len(candidates))
	remainingAttempts := attemptBudget

	for i := range candidates {
		c := candidates[i]
		attempts := 1
		if i == len(candidates)-1 {
			attempts = remainingAttempts
		}
		remainingAttempts -= attempts
		if logger != nil {
			logger.InfoContext(ctx, "image upstream attempt started",
				"channel", c.name,
				"channel_index", i+1,
				"channel_count", len(candidates),
				"attempt_budget", attempts,
			)
		}
		start := time.Now()
		observer := u.modelInvocationObserver(logger, c, i+1, len(candidates), attempts, req, meta)
		if observed, ok := c.client.(observedWalaCaller); ok {
			status, bodyText, err = observed.CallWithAttemptsObserved(ctx, req, attempts, observer)
		} else {
			status, bodyText, err = c.client.CallWithAttempts(ctx, req, attempts)
		}
		latency := int(time.Since(start).Milliseconds())

		// 成功（2xx）：记该线路成功统计，返回
		if err == nil && status < 400 {
			if c.trackStats && u.channels != nil {
				u.channels.IncStats(ctx, c.id, true, latency)
			}
			if logger != nil {
				logger.InfoContext(ctx, "image upstream attempt succeeded",
					"channel", c.name,
					"channel_index", i+1,
					"attempt_budget", attempts,
					"status", status,
					"latency_ms", latency,
				)
			}
			return status, bodyText, c, nil
		}

		// 失败：判断是否应切下一线路。404 只做跨线路降级，不在单条线路内重复请求。
		fallbackable := false
		if err != nil {
			if we, ok := err.(*wala.Error); ok {
				fallbackable = wala.IsFallbackable(we.StatusCode, we.Message)
			}
		} else {
			fallbackable = wala.IsFallbackable(status, bodyText)
		}
		if c.trackStats && u.channels != nil {
			u.channels.IncStats(ctx, c.id, false, latency)
		}
		if logger != nil {
			logger.WarnContext(ctx, "image upstream attempt failed",
				"channel", c.name,
				"channel_index", i+1,
				"attempt_budget", attempts,
				"status", status,
				"latency_ms", latency,
				"fallbackable", fallbackable,
				"error", compactUpstreamError(status, bodyText, err),
			)
		}
		lastErr = err
		lastStatus = status
		lastBody = bodyText
		lastUsed = c

		if !fallbackable {
			// 不可重试错误（如 400 参数错误）：直接返回，不切线路
			return status, bodyText, c, err
		}
		// 可重试：切下一线路继续
	}

	// 全部线路可重试失败 -> 返回最后线路的负载饱和提示
	finalMsg := ""
	if lastErr != nil {
		if we, ok := lastErr.(*wala.Error); ok {
			finalMsg = we.Message
		} else {
			finalMsg = lastErr.Error()
		}
	} else if lastBody != "" {
		finalMsg = lastBody
	}
	if logger != nil {
		logger.ErrorContext(ctx, "image upstream candidates exhausted",
			"channel_count", len(candidates),
			"last_channel", lastUsed.name,
			"last_status", lastStatus,
			"error", compactUpstreamError(lastStatus, lastBody, lastErr),
		)
	}
	message := fmt.Sprintf("生图候选线路均不可用，已按总尝试预算 %d 次仍未成功。最后线路 %s", attemptBudget, lastUsed.name)
	if finalMsg != "" {
		message += "：" + finalMsg
	}
	return lastStatus, lastBody, lastUsed, wala.NewError(503, message)
}

// invocationMeta 补齐请求本身无法表达的任务、用户和子图上下文。
type invocationMeta struct {
	taskID            uuid.UUID
	generationImageID string
	imageNumber       int
	user              *domain.User
}

// modelInvocationObserver 把一次模型调用拆成“请求已发出”和“请求已结束”两次持久化。
// 审计写入故障仅记录告警，绝不阻塞或改变用户的生图结果。
func (u *Usecase) modelInvocationObserver(logger *slog.Logger, channel channelClient, candidateIndex, candidateCount, attemptBudget int, req wala.Request, meta *invocationMeta) wala.AttemptObserver {
	repo, ok := u.repo.(modelInvocationRepo)
	if !ok || meta == nil || meta.user == nil {
		return nil
	}
	ids := map[int]uuid.UUID{}
	return func(event wala.AttemptEvent) {
		auditCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if !event.Finished {
			id := uuid.New()
			ids[event.Attempt] = id
			hash := sha256.Sum256([]byte(req.Prompt))
			rec := ModelInvocationRecord{
				ID: id, TaskID: meta.taskID, GenerationImageID: meta.generationImageID, ImageNumber: meta.imageNumber,
				UserID: meta.user.ID, Username: meta.user.Username, UserEmail: meta.user.Email, UserRole: string(meta.user.Role),
				ChannelID: channel.id, ChannelName: channel.name, APIBaseURL: channel.apiBaseURL, Protocol: channel.protocol, ModelID: channel.modelID,
				CandidateIndex: candidateIndex, CandidateCount: candidateCount, AttemptNumber: event.Attempt, AttemptBudget: attemptBudget,
				Status: "processing", Prompt: req.Prompt, PromptHash: hex.EncodeToString(hash[:]), ReferenceImages: modelInvocationReferences(req.Files),
				Size: req.Size, Quality: req.Quality, RequestedAt: event.StartedAt,
			}
			if err := repo.CreateModelInvocation(auditCtx, rec); err != nil && logger != nil {
				logger.WarnContext(auditCtx, "create model invocation audit failed", "error", err, "channel", channel.name, "attempt", event.Attempt)
			}
			return
		}
		id, exists := ids[event.Attempt]
		if !exists {
			return
		}
		status := "success"
		message := ""
		responseCount := 0
		if event.Err != nil || event.Status >= 400 {
			status = "failed"
			message = compactUpstreamError(event.Status, event.BodyText, event.Err)
		} else {
			responseCount = len(wala.ExtractGeneratedImages(wala.ParseJSONBody(event.BodyText)))
		}
		latency := int(event.CompletedAt.Sub(event.StartedAt).Milliseconds())
		if err := repo.FinishModelInvocation(auditCtx, id, status, event.Status, latency, responseCount, message, event.CompletedAt); err != nil && logger != nil {
			logger.WarnContext(auditCtx, "finish model invocation audit failed", "error", err, "channel", channel.name, "attempt", event.Attempt)
		}
	}
}

func modelInvocationReferences(files []wala.FileInput) []types.ModelInvocationReference {
	refs := make([]types.ModelInvocationReference, 0, len(files))
	for _, f := range files {
		hash := sha256.Sum256(f.Data)
		kind := f.ReferenceKind
		if kind == "" {
			kind = "reference"
		}
		refs = append(refs, types.ModelInvocationReference{
			Kind: kind, Name: f.Name, MimeType: f.Type, URL: f.SourceURL, SHA256: hex.EncodeToString(hash[:]), Size: f.Size,
		})
	}
	return refs
}

// retryBudget 返回整个候选链的总尝试次数。预算至少覆盖每个候选线路一次。
func (u *Usecase) retryBudget(candidateCount int) int {
	budget := 3
	if u.cfg != nil && u.cfg.Bridal.WalaImageRetryAttempts > 0 {
		budget = u.cfg.Bridal.WalaImageRetryAttempts
	}
	if budget < candidateCount {
		return candidateCount
	}
	return budget
}

// compactUpstreamError 控制日志字段大小，避免上游返回的大 body 污染 journal。
func compactUpstreamError(status int, bodyText string, err error) string {
	message := bodyText
	if err != nil {
		message = err.Error()
	}
	message = strings.TrimSpace(message)
	if len(message) > 500 {
		message = message[:500] + "…"
	}
	if message == "" && status > 0 {
		return fmt.Sprintf("HTTP %d", status)
	}
	return message
}

// generateOneResult 单张生成结果。
type generateOneResult struct {
	index     int
	success   bool
	image     *ImageRecord        // 成功时的图
	generated wala.GeneratedImage // 成功时的原图（首张建 sceneRef/identityRef 用）
	latencyMs int
	errMsg    string
	cancelled bool
}

// generateOne 生成单张图全流程：组装参考图 -> 取得通道槽位 -> 调 wala(带线路 fallback) -> 存图 -> 更新子图 -> 扣积分。
// sceneRef/identityRef 只读传入（串行段建立，并发段复用）。失败/取消由调用方据 result 决策。
func (u *Usecase) generateOne(
	ctx context.Context,
	taskID uuid.UUID,
	taskIDStr string,
	user *domain.User,
	pl promptPlan,
	promptIndex int,
	sceneFile *wala.FileInput,
	productFiles []wala.FileInput,
	sceneRef *wala.FileInput,
	identityRef *wala.FileInput,
	candidates []channelClient,
	size, quality string,
	userSem *userSem,
) generateOneResult {
	imageID := fmt.Sprintf("%s-%d", taskIDStr, promptIndex+1)

	// 检测取消
	if cancelled, _ := u.repo.IsTaskCancelled(ctx, taskID); cancelled {
		_ = u.repo.UpdateSubTaskImage(ctx, imageID, "cancelled", "", "", "任务已取消。", 0)
		return generateOneResult{index: promptIndex, cancelled: true, errMsg: "任务已取消。"}
	}

	// 组装本次生图参考图（按 refLimit 截断，优先级：场景图 > 连续性参考图 > 产品图）：
	// - 传了场景图：[场景图, identityRef?, ...产品图] -- 场景图锁定环境，不用 sceneRef 避免双场景权威
	// - 没传场景图：首张用产品图；后续 [identityRef?, sceneRef?(去重), ...产品图] -- 上限放开到 refLimit
	limit := u.refLimit
	if limit <= 0 {
		limit = 8
	}
	var requestFiles []wala.FileInput
	if sceneFile != nil {
		requestFiles = append(requestFiles, *sceneFile)
		if identityRef != nil {
			requestFiles = append(requestFiles, *identityRef)
		}
		remain := limit - len(requestFiles)
		if remain > len(productFiles) {
			remain = len(productFiles)
		}
		if remain > 0 {
			requestFiles = append(requestFiles, productFiles[:remain]...)
		}
	} else {
		var continuityRefs []wala.FileInput
		if identityRef != nil {
			continuityRefs = append(continuityRefs, *identityRef)
		}
		if sceneRef != nil && (identityRef == nil || sceneRef != identityRef) {
			continuityRefs = append(continuityRefs, *sceneRef)
		}
		if promptIndex == 0 {
			requestFiles = append(requestFiles, productFiles...)
		} else {
			requestFiles = append(requestFiles, continuityRefs...)
			remain := limit - len(continuityRefs)
			if remain > 0 {
				if remain > len(productFiles) {
					remain = len(productFiles)
				}
				requestFiles = append(requestFiles, productFiles[:remain]...)
			}
		}
	}
	if len(requestFiles) > limit {
		requestFiles = requestFiles[:limit]
	}

	// 调 wala（用户级并发信号量 max_concurrency 跨任务共享 + 全局 WalaAPI 并发兜底 + 线路优先级 fallback）。
	// 取得两个槽位之前保持 pending，前端据此展示“排队中”，不能把等待槽位误报为“生成中”。
	userSem.acquire()
	u.sem <- struct{}{}
	defer func() {
		<-u.sem
		userSem.release()
	}()
	if cancelled, _ := u.repo.IsTaskCancelled(ctx, taskID); cancelled {
		_ = u.repo.UpdateSubTaskImage(ctx, imageID, "cancelled", "", "", "任务已取消。", 0)
		return generateOneResult{index: promptIndex, cancelled: true, errMsg: "任务已取消。"}
	}

	imgStart := time.Now()
	_ = u.repo.UpdateSubTaskImage(ctx, imageID, "processing", "", "", "", 0)
	imageLogger := u.logger.With("task", taskID, "image_number", promptIndex+1)
	status, bodyText, _, err := u.callWithFallbackLogged(ctx, imageLogger, candidates, wala.Request{
		Prompt:  pl.prompt,
		Files:   requestFiles,
		Size:    size,
		Quality: quality,
	}, &invocationMeta{taskID: taskID, generationImageID: imageID, imageNumber: promptIndex + 1, user: user})
	latency := int(time.Since(imgStart).Milliseconds())

	if err != nil {
		msg := err.Error()
		if we, ok := err.(*wala.Error); ok {
			msg = we.Message
		}
		_ = u.repo.UpdateSubTaskImage(ctx, imageID, "failed", "", "", msg, latency)
		_ = u.repo.IncCompletedCount(ctx, taskID)
		return generateOneResult{index: promptIndex, success: false, latencyMs: latency, errMsg: msg}
	}

	payload := wala.ParseJSONBody(bodyText)
	if status >= 400 {
		// 到这里是不可重试错误（可重试的已在 callWithFallback 内部切线路重试过）
		message := wala.ExtractErrorMessage(payload, bodyText)
		_ = u.repo.UpdateSubTaskImage(ctx, imageID, "failed", "", "", message, latency)
		_ = u.repo.IncCompletedCount(ctx, taskID)
		return generateOneResult{index: promptIndex, success: false, latencyMs: latency, errMsg: message}
	}

	generated := wala.ExtractGeneratedImages(payload)
	if len(generated) == 0 {
		msg := fmt.Sprintf("第 %d 张图未返回图片。", promptIndex+1)
		_ = u.repo.UpdateSubTaskImage(ctx, imageID, "failed", "", "", msg, latency)
		_ = u.repo.IncCompletedCount(ctx, taskID)
		return generateOneResult{index: promptIndex, success: false, latencyMs: latency, errMsg: msg}
	}

	// 存图（MinIO/remote）+ 更新子图 success
	saved, err := u.saveGeneratedImages(ctx, taskIDStr, generated, promptIndex, pl.name)
	if err != nil || len(saved) == 0 {
		msg := "保存生成图片失败。"
		if err != nil {
			msg = err.Error()
		}
		_ = u.repo.UpdateSubTaskImage(ctx, imageID, "failed", "", "", msg, latency)
		_ = u.repo.IncCompletedCount(ctx, taskID)
		return generateOneResult{index: promptIndex, success: false, latencyMs: latency, errMsg: msg}
	}
	_ = u.repo.UpdateSubTaskImage(ctx, imageID, "success", saved[0].URL, saved[0].ThumbURL, "", latency)
	_ = u.repo.IncCompletedCount(ctx, taskID)

	// 扣积分（per-user 锁串行化，避免并发 AdjustBalance 丢更新）。每张成功扣 1，失败不扣。
	if u.credits != nil {
		mu, _ := u.creditsMu.LoadOrStore(user.ID, &sync.Mutex{})
		mu.(*sync.Mutex).Lock()
		if err := u.credits.Consume(ctx, user.ID, -1, taskID, "生图消耗（1 张）"); err != nil {
			u.logger.WarnContext(ctx, "consume credits failed", "error", err)
		}
		mu.(*sync.Mutex).Unlock()
	}

	return generateOneResult{index: promptIndex, success: true, image: &saved[0], generated: generated[0], latencyMs: latency}
}

// runTask worker goroutine：首张串行建连续性参考图 + 后续并发，更新子图状态。
// 独立 context（不绑请求），取消靠 IsTaskCancelled 检测。线路按优先级 fallback。
//
// 串行段 0..splitIdx（splitIdx=leadPersonIndex，第一个含人物图；无人物图则 0）：
//
//	逐张串行生成，建立 sceneRef（首张）+ identityRef（第一个含人物张），保证图组连续性。
//
// 并发段 splitIdx+1..N-1：复用串行段建立的参考图并发生成。
// leadPersonIndex 通常=0（首张含人物），串行段仅首张，性能最优。
func (u *Usecase) runTask(
	taskID uuid.UUID,
	user *domain.User,
	plans []promptPlan,
	sceneFile *wala.FileInput,
	productFiles []wala.FileInput,
	size, quality string,
	channelID uuid.UUID,
) {
	ctx := context.Background()
	logger := u.logger.With("task", taskID, "user", user.Username)
	taskIDStr := taskID.String()

	// 构建优先级 fallback 候选线路链（用户指定线路优先，其余按 sort_order 降级）
	candidates := u.buildCandidates(ctx, channelID)
	candidateNames := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		candidateNames = append(candidateNames, candidate.name)
	}
	logger.InfoContext(ctx, "task candidates built", "count", len(candidates), "candidates", candidateNames, "first", candidates[0].name)

	// 用户级并发信号量：容量 = 主线路 max_concurrency，跨任务控制该用户同时生成的图片数（1=跨任务逐张串行）
	userSem := u.getUserSem(user.ID, candidates[0].maxConcurrency)

	if err := u.repo.SetTaskStarted(ctx, taskID); err != nil {
		logger.ErrorContext(ctx, "set task started failed", "error", err)
		_ = u.repo.SetTaskDone(ctx, taskID, "failed", "任务启动失败。")
		return
	}

	// splitIdx：串行段终点 = 第一个含人物图 index（建立 identityRef 用）；无人物图则仅首张串行（建 sceneRef）
	splitIdx := -1
	for i, p := range plans {
		if p.includesPerson {
			splitIdx = i
			break
		}
	}
	if splitIdx < 0 {
		splitIdx = 0
	}

	var sceneRef, identityRef *wala.FileInput
	finalStatus := "completed"
	finalErr := ""
	breakIndex := -1

	// 串行段：0..splitIdx，逐张生成并建立 sceneRef/identityRef
	for i := 0; i <= splitIdx; i++ {
		r := u.generateOne(ctx, taskID, taskIDStr, user, plans[i], i, sceneFile, productFiles, sceneRef, identityRef, candidates, size, quality, userSem)
		if r.cancelled {
			finalStatus = "cancelled"
			finalErr = "任务已取消。"
			breakIndex = i
			break
		}
		if !r.success {
			finalStatus = "failed"
			finalErr = r.errMsg
			breakIndex = i
			break
		}
		// 建立连续性参考图（仅多图）
		if len(plans) > 1 {
			// 场景参考图：首张成功图回传（未传场景图时，避免双场景权威）
			if sceneFile == nil && sceneRef == nil {
				ref, err := u.generatedImageToReferenceFile(r.generated, taskIDStr, "场景")
				if err != nil {
					msg := err.Error()
					if we, ok := err.(*wala.Error); ok {
						msg = we.Message
					}
					finalStatus = "failed"
					finalErr = msg
					breakIndex = i
					break
				}
				ref.SourceURL = r.image.URL
				ref.ReferenceKind = "continuity_scene"
				sceneRef = &ref
			}
			// 人物参考图：第一个含人物张建立（复用 sceneRef 避免重复下载）
			if plans[i].includesPerson && identityRef == nil {
				if sceneRef != nil {
					identityRef = sceneRef
				} else {
					ref, err := u.generatedImageToReferenceFile(r.generated, taskIDStr, "人物")
					if err != nil {
						msg := err.Error()
						if we, ok := err.(*wala.Error); ok {
							msg = we.Message
						}
						finalStatus = "failed"
						finalErr = msg
						breakIndex = i
						break
					}
					ref.SourceURL = r.image.URL
					ref.ReferenceKind = "continuity_identity"
					identityRef = &ref
				}
			}
		}
	}

	// 并发段：splitIdx+1..N-1，复用串行段建立的 sceneRef/identityRef。
	// 按图片编号有序入队，最多启动主线路 max_concurrency 个 worker：
	// 1=图 2、图 3…严格串行；N=前 N 张并发，任一完成后再取下一张。
	// generateOne 取得实际通道槽位后才把子图更新为 processing，等待中的图保持 pending。
	if finalStatus == "completed" && splitIdx+1 < len(plans) {
		results := make([]generateOneResult, len(plans))
		workerCount := candidates[0].maxConcurrency
		remaining := len(plans) - (splitIdx + 1)
		if workerCount > remaining {
			workerCount = remaining
		}
		if workerCount < 1 {
			workerCount = 1
		}
		jobs := make(chan int)
		var wg sync.WaitGroup
		for worker := 0; worker < workerCount; worker++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for idx := range jobs {
					results[idx] = u.generateOne(ctx, taskID, taskIDStr, user, plans[idx], idx, sceneFile, productFiles, sceneRef, identityRef, candidates, size, quality, userSem)
				}
			}()
		}
		for i := splitIdx + 1; i < len(plans); i++ {
			jobs <- i
		}
		close(jobs)
		wg.Wait()
		// 收集失败/取消（任一失败则任务标记 failed，已成功图保留）
		for i := splitIdx + 1; i < len(plans); i++ {
			if results[i].cancelled {
				finalStatus = "cancelled"
				finalErr = "任务已取消。"
				if breakIndex < 0 {
					breakIndex = i
				}
				break
			}
			if !results[i].success {
				finalStatus = "failed"
				finalErr = results[i].errMsg
				if breakIndex < 0 {
					breakIndex = i
				}
				break
			}
		}
	}

	// 清理未执行子图（仅串行段失败/取消时，并发段未启动；并发段失败时各子图已由 generateOne 更新状态）
	if breakIndex >= 0 && breakIndex <= splitIdx && finalStatus != "completed" {
		cleanupStatus := "failed"
		cleanupMsg := "前序失败，未执行。"
		if finalStatus == "cancelled" {
			cleanupStatus = "cancelled"
			cleanupMsg = "任务已取消。"
		}
		for j := breakIndex + 1; j < len(plans); j++ {
			_ = u.repo.UpdateSubTaskImage(ctx, fmt.Sprintf("%s-%d", taskIDStr, j+1), cleanupStatus, "", "", cleanupMsg, 0)
			_ = u.repo.IncCompletedCount(ctx, taskID)
		}
	}

	_ = u.repo.SetTaskDone(ctx, taskID, finalStatus, finalErr)
	logger.InfoContext(ctx, "task done", "status", finalStatus, "error", finalErr)
}
