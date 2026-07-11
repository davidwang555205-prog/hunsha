package generation

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/biz/bridalauth"
	"bridal/backend/biz/generation/imagestore"
	"bridal/backend/biz/generation/prompt"
	"bridal/backend/biz/generation/wala"
	"bridal/backend/config"
)

// Usecase 生图业务层。
type Usecase struct {
	repo      *Repo
	store     *imagestore.Store
	wala      *wala.Client
	cfg       *config.Config
	logger    *slog.Logger
	authRepo  *bridalauth.Repo
}

func NewUsecase(i *do.Injector) (*Usecase, error) {
	cfg := do.MustInvoke[*config.Config](i)
	walaClient := wala.NewClient(wala.Config{
		APIKey:         cfg.Bridal.WalaAPIKey,
		APIBaseURL:     cfg.Bridal.WalaAPIBaseURL,
		ImageModel:     cfg.Bridal.WalaImageModel,
		Timeout:        time.Duration(cfg.Bridal.WalaImageTimeoutMs) * time.Millisecond,
		RetryAttempts:  cfg.Bridal.WalaImageRetryAttempts,
		DefaultQuality: cfg.Bridal.WalaImageQuality,
	})
	return &Usecase{
		repo:     do.MustInvoke[*Repo](i),
		store:    do.MustInvoke[*imagestore.Store](i),
		wala:     walaClient,
		cfg:      cfg,
		logger:   do.MustInvoke[*slog.Logger](i).With("module", "generation.usecase"),
		authRepo: do.MustInvoke[*bridalauth.Repo](i),
	}, nil
}

// 人员图片类型（含人物），与 Node personImageTypes 一致。
var personImageTypes = map[string]bool{
	"产品上身图": true,
	"对镜穿搭图": true,
	"生活场景图": true,
}

// GenerateReq /api/v1/generation 请求体，与 Node /api/generate 一致。
type GenerateReq struct {
	PromptParamsList []prompt.Params `json:"promptParamsList"`
	PromptParams     *prompt.Params  `json:"promptParams,omitempty"` // 兼容旧字段
	Title            string          `json:"title"`
	Body             string          `json:"body"`
	Tags             []string        `json:"tags"`
	Topic            string          `json:"topic"`
	ReferenceImages  []FileInput     `json:"referenceImages"`
	Size             string          `json:"size"`
	Quality          string          `json:"quality"`
}

// FileInput 参考图，前端 dataUrl。
type FileInput struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Size   int64  `json:"size"`
	DataURL string `json:"dataUrl"`
}

// SanitizedTask 对外暴露的 history 记录，与 Node sanitizeHistory 字段一致
// （不含 promptHash/latencyMs）。
type SanitizedTask struct {
	ID                 string        `json:"id"`
	UserID             string        `json:"userId"`
	Username           string        `json:"username"`
	CreatedAt          time.Time     `json:"createdAt"`
	Status             string        `json:"status"`
	Model              string        `json:"model"`
	Mode               string        `json:"mode"`
	Title              string        `json:"title"`
	Body               string        `json:"body"`
	Tags               []string      `json:"tags"`
	Topic              string        `json:"topic"`
	Images             []ImageRecord `json:"images"`
	Error              string        `json:"error"`
	UploadedImageCount int           `json:"uploadedImageCount"`
}

// sanitize 与 Node sanitizeHistory 一致：丢弃 promptHash/latencyMs，images 空时返回空数组。
func sanitize(rec TaskRecord) SanitizedTask {
	images := rec.Images
	if images == nil {
		images = []ImageRecord{}
	}
	tags := rec.Tags
	if tags == nil {
		tags = []string{}
	}
	return SanitizedTask{
		ID:                 rec.ID.String(),
		UserID:             rec.UserID.String(),
		Username:           rec.Username,
		CreatedAt:          rec.CreatedAt,
		Status:             rec.Status,
		Model:              rec.Model,
		Mode:               rec.Mode,
		Title:              rec.Title,
		Body:               rec.Body,
		Tags:               tags,
		Topic:              rec.Topic,
		Images:             images,
		Error:              rec.Error,
		UploadedImageCount: rec.UploadedImageCount,
	}
}

// GenerateResp /api/v1/generation 成功响应。
type GenerateResp struct {
	Record SanitizedTask `json:"record"`
}

// shanghaiDateKey 与 Node shanghaiDateKey 一致：UTC +8h 后取 YYYY-MM-DD。
func shanghaiDateKey(t time.Time) string {
	return t.UTC().Add(8 * time.Hour).Format("2006-01-02")
}

var dataURLRegex = regexp.MustCompile(`^data:([^;]+);base64,(.+)$`)

// parseDataURL 解析 dataUrl 为 {type, data}，与 Node parseDataUrl 一致。
func parseDataURL(dataURL string) (contentType string, data []byte, err error) {
	m := dataURLRegex.FindStringSubmatch(dataURL)
	if m == nil {
		// 非 dataUrl，按纯 base64 处理（默认 png）
		b, e := base64.StdEncoding.DecodeString(dataURL)
		return "image/png", b, e
	}
	b, e := base64.StdEncoding.DecodeString(m[2])
	return m[1], b, e
}

// extensionFromMime 与 Node extensionFromMime 一致。
func extensionFromMime(mime string) string {
	switch mime {
	case "image/jpeg":
		return "jpg"
	case "image/webp":
		return "webp"
	default:
		return "png"
	}
}

// toWalaFile 把 bridal FileInput 转 wala.FileInput（解码 dataUrl）。
func toWalaFile(f FileInput) (wala.FileInput, error) {
	contentType, data, err := parseDataURL(f.DataURL)
	if err != nil {
		return wala.FileInput{}, fmt.Errorf("解析参考图失败: %w", err)
	}
	name := f.Name
	if name == "" {
		name = "reference." + extensionFromMime(contentType)
	}
	return wala.FileInput{Name: name, Type: contentType, Size: int64(len(data)), Data: data}, nil
}

// generatedImageToReferenceFile 与 Node generatedImageToReferenceFile 一致：
// 把首张成功图转后续参考图（b64 或 url），限 20MB。
func (u *Usecase) generatedImageToReferenceFile(img wala.GeneratedImage, recordID string, referenceKind string) (wala.FileInput, error) {
	contentType := "image/png"
	var buffer []byte

	if img.B64 != "" {
		m := dataURLRegex.FindStringSubmatch(img.B64)
		if m != nil {
			contentType = m[1]
			b, err := base64.StdEncoding.DecodeString(m[2])
			if err != nil {
				return wala.FileInput{}, err
			}
			buffer = b
		} else {
			b, err := base64.StdEncoding.DecodeString(img.B64)
			if err != nil {
				return wala.FileInput{}, err
			}
			buffer = b
		}
	} else if img.URL != "" {
		resp, err := http.Get(img.URL)
		if err != nil {
			return wala.FileInput{}, wala.NewError(502, fmt.Sprintf("无法读取首张%s参考图，图组连续性生成已停止。", referenceKind))
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return wala.FileInput{}, wala.NewError(502, fmt.Sprintf("无法读取首张%s参考图，图组连续性生成已停止。", referenceKind))
		}
		ct := resp.Header.Get("Content-Type")
		if i := strings.Index(ct, ";"); i >= 0 {
			ct = ct[:i]
		}
		if ct != "" {
			contentType = ct
		}
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			return wala.FileInput{}, err
		}
		buffer = b
	}

	if len(buffer) == 0 || len(buffer) > wala.MaxContinuityReferenceBytes {
		return wala.FileInput{}, wala.NewError(502, fmt.Sprintf("首张%s参考图无效或超过 20MB，图组连续性生成已停止。", referenceKind))
	}

	name := recordID + "-"
	if referenceKind == "人物" {
		name += "identity"
	} else {
		name += "scene"
	}
	name += "." + extensionFromMime(contentType)

	return wala.FileInput{Name: name, Type: contentType, Size: int64(len(buffer)), Data: buffer}, nil
}

// saveGeneratedImages 与 Node saveGeneratedImages 一致：
// remote 图直接存 url；local 图存 MinIO，url 为代理路径。
func (u *Usecase) saveGeneratedImages(ctx context.Context, recordID string, images []wala.GeneratedImage, startIndex int, imageName string) ([]ImageRecord, error) {
	saved := make([]ImageRecord, 0, len(images))
	for i, img := range images {
		imageNumber := startIndex + i + 1
		name := imageName
		if name == "" {
			name = fmt.Sprintf("图片 %d", imageNumber)
		}
		if img.URL != "" {
			saved = append(saved, ImageRecord{
				ID:          fmt.Sprintf("%s-%d", recordID, imageNumber),
				Name:        name,
				URL:         img.URL,
				DownloadURL: img.URL,
				Source:      "remote",
			})
			continue
		}
		// b64 本地图
		b64 := img.B64
		b64 = regexp.MustCompile(`^data:[^;]+;base64,`).ReplaceAllString(b64, "")
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return nil, err
		}
		filename := fmt.Sprintf("%s-%d.png", recordID, imageNumber)
		proxyURL, err := u.store.PutImage(ctx, filename, data, "image/png")
		if err != nil {
			return nil, err
		}
		saved = append(saved, ImageRecord{
			ID:          fmt.Sprintf("%s-%d", recordID, imageNumber),
			Name:        name,
			URL:         proxyURL,
			DownloadURL: proxyURL,
			Source:      "local",
		})
	}
	return saved, nil
}

// promptPlan 单张图的 prompt 计划。
type promptPlan struct {
	prompt         string
	includesPerson bool
	name           string
}

// Generate 执行生图，1:1 对应 Node handleGenerate。
func (u *Usecase) Generate(ctx context.Context, user *bridalauth.User, req GenerateReq) (*GenerateResp, error) {
	// 1. 解析 promptParamsList（最多 5 组，兼容旧 promptParams 字段）
	var paramsList []prompt.Params
	if len(req.PromptParamsList) > 0 {
		paramsList = make([]prompt.Params, 0, len(req.PromptParamsList))
		for _, p := range req.PromptParamsList {
			paramsList = append(paramsList, p)
		}
		if len(paramsList) > 5 {
			paramsList = paramsList[:5]
		}
	} else if req.PromptParams != nil {
		paramsList = []prompt.Params{*req.PromptParams}
	}
	if len(paramsList) == 0 {
		return nil, wala.NewError(400, "缺少生图参数。")
	}

	// 2. 校验 title/body/tags
	title := strings.TrimSpace(req.Title)
	textBody := strings.TrimSpace(req.Body)
	tags := make([]string, 0, len(req.Tags))
	for _, t := range req.Tags {
		s := strings.TrimSpace(fmt.Sprintf("%v", t))
		if s != "" {
			tags = append(tags, s)
		}
	}
	if len(tags) > 20 {
		tags = tags[:20]
	}
	if title == "" || textBody == "" || len(tags) == 0 {
		return nil, wala.NewError(400, "缺少标题、正文或标签。")
	}

	// 3. 解析参考图（最多 4 张）
	files := make([]wala.FileInput, 0, len(req.ReferenceImages))
	for _, rf := range req.ReferenceImages {
		wf, err := toWalaFile(rf)
		if err != nil {
			return nil, wala.NewError(400, "参考图解析失败。")
		}
		files = append(files, wf)
	}
	if len(files) > 4 {
		files = files[:4]
	}

	// 4. 每日额度校验（上海时区，admin 不限量）
	if !user.HasUnlimitedImageGeneration() {
		dateKey := shanghaiDateKey(time.Now())
		generatedToday, err := u.repo.CountImagesForDate(ctx, user.ID, dateKey)
		if err != nil {
			u.logger.ErrorContext(ctx, "count images for date failed", "error", err)
		} else {
			limit := bridalauth.NormalizeDailyImageLimit(user.DailyImageLimit, bridalauth.DefaultDailyImageLimit)
			requested := len(paramsList)
			if generatedToday+requested > limit {
				remaining := limit - generatedToday
				if remaining < 0 {
					remaining = 0
				}
				return nil, wala.NewError(429, fmt.Sprintf(
					"今日生成图片额度不足。每日上限：%d 张，今日已生成：%d 张，剩余：%d 张，本次请求：%d 张。",
					limit, generatedToday, remaining, requested))
			}
		}
	}

	// 5. 前置计算：leadPersonIndex / leadPhoneIndex / 共享场景/模特
	recordID := uuid.New()
	personTypes := map[string]bool{"产品上身图": true, "对镜穿搭图": true, "生活场景图": true}
	leadPersonIndex := -1
	leadPhoneIndex := -1
	for i, p := range paramsList {
		if leadPersonIndex < 0 && personTypes[p.ImageType] {
			leadPersonIndex = i
		}
		if leadPhoneIndex < 0 && p.BridalKeywordProfileID == "phoneMirrorSelfieFitting" {
			leadPhoneIndex = i
		}
	}
	leadIdx := 0
	if leadPersonIndex >= 0 {
		leadIdx = leadPersonIndex
	}
	sharedScenePreference := paramsList[leadIdx].ScenePreference
	if sharedScenePreference == "" {
		sharedScenePreference = "自动匹配"
	}
	sharedModelChoice := paramsList[leadIdx].ModelChoice

	// normalizedParamsList：全组统一场景；人物图统一模特
	normalized := make([]prompt.Params, len(paramsList))
	for i, p := range paramsList {
		p.ScenePreference = sharedScenePreference
		if personTypes[p.ImageType] {
			p.ModelChoice = sharedModelChoice
		}
		normalized[i] = p
	}

	// 6. 生成 promptPlans
	plans := make([]promptPlan, len(normalized))
	for i, p := range normalized {
		sctx := prompt.SeriesContext{
			Index:           i,
			Total:           len(normalized),
			LeadPersonIndex: leadPersonIndex,
			LeadPhoneIndex:  leadPhoneIndex,
		}
		pr := prompt.GeneratePrompt(p, sctx)
		name := strings.TrimSpace(p.GeneratedImageName)
		if name == "" {
			name = fmt.Sprintf("图片 %d", i+1)
		}
		if len([]rune(name)) > 60 {
			name = string([]rune(name)[:60])
		}
		if name == "" {
			name = fmt.Sprintf("图片 %d", i+1)
		}
		plans[i] = promptPlan{
			prompt:         pr,
			includesPerson: personTypes[p.ImageType] && p.ModelChoice != "不指定人物，仅产品静物",
			name:           name,
		}
	}

	// 7. promptHash
	promptStrings := make([]string, len(plans))
	for i, pl := range plans {
		promptStrings[i] = pl.prompt
	}
	hashBytes := sha256.Sum256([]byte(strings.Join(promptStrings, "\n---\n")))
	promptHash := hex.EncodeToString(hashBytes[:])

	startedAt := time.Now()
	mode := "text-to-image"
	if len(files) > 0 {
		mode = "image-edit"
	}
	model := u.cfg.Bridal.WalaImageModel
	if model == "" {
		model = "gpt-image-2"
	}
	savedImages := make([]ImageRecord, 0)
	var sceneRef, identityRef *wala.FileInput

	u.logger.InfoContext(ctx, "generate start", "id", recordID, "user", user.Username, "mode", mode, "files", len(files), "prompts", len(plans), "model", model)

	// 8. 串行循环
	var genErr *wala.Error
	for promptIndex, pl := range plans {
		// 组装连续性参考图（去重）
		var continuityRefs []wala.FileInput
		if identityRef != nil {
			continuityRefs = append(continuityRefs, *identityRef)
		}
		if sceneRef != nil && (identityRef == nil || sceneRef != identityRef) {
			continuityRefs = append(continuityRefs, *sceneRef)
		}
		// requestFiles
		var requestFiles []wala.FileInput
		if promptIndex == 0 {
			requestFiles = files
		} else {
			requestFiles = append([]wala.FileInput{}, continuityRefs...)
			remain := 4 - len(continuityRefs)
			if remain > 0 {
				if remain > len(files) {
					remain = len(files)
				}
				requestFiles = append(requestFiles, files[:remain]...)
			}
			if len(requestFiles) > 4 {
				requestFiles = requestFiles[:4]
			}
		}

		status, bodyText, err := u.wala.CallWithRetries(ctx, wala.Request{
			Prompt:  pl.prompt,
			Files:   requestFiles,
			Size:    req.Size,
			Quality: req.Quality,
		})
		if err != nil {
			if we, ok := err.(*wala.Error); ok {
				genErr = we
			} else {
				genErr = wala.NewError(500, err.Error())
			}
			break
		}

		payload := wala.ParseJSONBody(bodyText)
		if status >= 400 {
			message := wala.ExtractErrorMessage(payload, bodyText)
			friendly := message
			if wala.IsRetryable(status, message) {
				friendly = u.wala.BuildOverloadMessage(message)
			}
			genErr = wala.NewError(status, friendly)
			break
		}

		generated := wala.ExtractGeneratedImages(payload)
		if len(generated) == 0 {
			genErr = wala.NewError(502, fmt.Sprintf("第 %d 张图未返回图片。", promptIndex+1))
			break
		}

		// 图组连续性（仅多图）
		if len(plans) > 1 && sceneRef == nil {
			ref, err := u.generatedImageToReferenceFile(generated[0], recordID.String(), "场景")
			if err != nil {
				if we, ok := err.(*wala.Error); ok {
					genErr = we
				} else {
					genErr = wala.NewError(502, err.Error())
				}
				break
			}
			sceneRef = &ref
		}
		if len(plans) > 1 && pl.includesPerson && identityRef == nil {
			if promptIndex == 0 {
				identityRef = sceneRef
			} else {
				ref, err := u.generatedImageToReferenceFile(generated[0], recordID.String(), "人物")
				if err != nil {
					if we, ok := err.(*wala.Error); ok {
						genErr = we
					} else {
						genErr = wala.NewError(502, err.Error())
					}
					break
				}
				identityRef = &ref
			}
		}

		nextImages, err := u.saveGeneratedImages(ctx, recordID.String(), generated, len(savedImages), pl.name)
		if err != nil {
			genErr = wala.NewError(500, "保存生成图片失败。")
			break
		}
		savedImages = append(savedImages, nextImages...)
	}

	latencyMs := int(time.Since(startedAt).Milliseconds())

	// 9. 写 history（成功或失败都写）
	now := time.Now()
	rec := TaskRecord{
		ID:                 recordID,
		UserID:             user.ID,
		Username:           user.Username,
		CreatedAt:          now,
		Model:              model,
		Mode:               mode,
		Title:              title,
		Body:               textBody,
		Tags:               tags,
		Topic:              req.Topic,
		Images:             savedImages,
		PromptHash:         promptHash,
		UploadedImageCount: len(files),
		LatencyMs:          latencyMs,
	}
	if genErr != nil {
		rec.Status = "failed"
		rec.Error = genErr.Message
		if rec.Error == "" {
			rec.Error = "生图失败。"
		}
	} else {
		rec.Status = "success"
		rec.Error = ""
	}

	if err := u.repo.InsertTask(ctx, rec); err != nil {
		u.logger.ErrorContext(ctx, "insert task failed", "error", err)
	}
	if err := u.repo.PurgeExpired(ctx, u.cfg.Bridal.HistoryRetentionDays); err != nil {
		u.logger.WarnContext(ctx, "purge expired failed", "error", err)
	}

	if genErr != nil {
		u.logger.InfoContext(ctx, "generate failed", "id", recordID, "status", genErr.StatusCode, "latencyMs", latencyMs, "error", rec.Error)
		return nil, genErr
	}
	u.logger.InfoContext(ctx, "generate success", "id", recordID, "images", len(savedImages), "latencyMs", latencyMs)

	// 10. 返回
	return &GenerateResp{Record: sanitize(rec)}, nil
}

// ListHistory /api/v1/generation/history，对应 Node handleHistory。
func (u *Usecase) ListHistory(ctx context.Context, user *bridalauth.User) ([]SanitizedTask, error) {
	recs, err := u.repo.ListForUser(ctx, user.ID, user.Role == bridalauth.RoleAdmin, 100)
	if err != nil {
		return nil, err
	}
	out := make([]SanitizedTask, 0, len(recs))
	for _, r := range recs {
		out = append(out, sanitize(r))
	}
	return out, nil
}
