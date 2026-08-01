package generation

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"net/http"
	"path"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/samber/do"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"bridal/backend/biz/channels"
	"bridal/backend/biz/credits"
	"bridal/backend/biz/engines"
	"bridal/backend/biz/generation/imagestore"
	"bridal/backend/biz/generation/prompt"
	"bridal/backend/biz/generation/wala"
	"bridal/backend/biz/syssetting"
	"bridal/backend/config"
	"bridal/backend/domain"
	"bridal/backend/ent/types"
)

// Usecase 生图业务层。
type Usecase struct {
	repo       taskRepo
	store      taskStore
	wala       *wala.Client
	cfg        *config.Config
	logger     *slog.Logger
	credits    taskCredits
	channels   taskChannels
	engines    *engines.Usecase
	syssetting *syssetting.Usecase          // 系统设置（retention_days，定时清理过期历史用）
	stats      *statsAdapter                // 生图统计适配器（复用 generationtask 查询，概览页用）
	sem        chan struct{}                // 全局并发信号量：跨用户兜底，控制同时调 WalaAPI 的 goroutine 数（WalaConcurrencyLimit）
	userSems   sync.Map                     // per-user 生图并发信号量（userID -> *userSem）：跨任务控制该用户同时生成的图片数，容量 = 主线路 max_concurrency
	refLimit   int                          // 传 WalaAPI 参考图张数上限（场景图 + 连续性参考图 + 产品图按优先级截断），默认 8
	creditsMu  sync.Map                     // per-user 积分扣减锁（userID -> *sync.Mutex），并发生图时串行化同用户扣减，避免 AdjustBalance 丢更新
	newClient  func(wala.Config) walaCaller // 候选线路 client 工厂，默认 wala.NewClient，测试可注入 fake
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
		Protocol:       "openai", // .env 默认 client 走 WalaAPI/openai 协议
	})
	concurrencyLimit := cfg.Bridal.WalaConcurrencyLimit
	if concurrencyLimit <= 0 {
		concurrencyLimit = 5
	}
	refLimit := cfg.Bridal.WalaImageReferenceLimit
	if refLimit <= 0 {
		refLimit = 8
	}
	repo := do.MustInvoke[*Repo](i)
	return &Usecase{
		repo:       repo,
		store:      do.MustInvoke[*imagestore.Store](i),
		wala:       walaClient,
		cfg:        cfg,
		logger:     do.MustInvoke[*slog.Logger](i).With("module", "generation.usecase"),
		credits:    do.MustInvoke[*credits.Usecase](i),
		channels:   do.MustInvoke[*channels.Usecase](i),
		engines:    do.MustInvoke[*engines.Usecase](i),
		syssetting: do.MustInvoke[*syssetting.Usecase](i),
		stats:      NewStatsAdapter(repo),
		sem:        make(chan struct{}, concurrencyLimit),
		refLimit:   refLimit,
		newClient:  func(cfg wala.Config) walaCaller { return wala.NewClient(cfg) },
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
	PromptParamsList       []prompt.Params `json:"promptParamsList"`
	PromptParams           *prompt.Params  `json:"promptParams,omitempty"` // 兼容旧字段
	Title                  string          `json:"title"`
	Body                   string          `json:"body"`
	Tags                   []string        `json:"tags"`
	Topic                  string          `json:"topic"`
	ReferenceImages        []FileInput     `json:"referenceImages,omitempty"` // 兼容旧字段（已废弃，新版用下面两个字段）
	SceneReferenceImage    *FileInput      `json:"sceneReferenceImage"`       // 场景参考图（0~1 张，可选），传了则锁定在该场景生成
	ProductReferenceImages []FileInput     `json:"productReferenceImages"`    // 婚纱产品图（4~6 张，必传）
	Size                   string          `json:"size"`
	Quality                string          `json:"quality"`
	CategoryID             string          `json:"categoryId"` // V2 类目 id（可选，uuid 字符串）
	ChannelID              string          `json:"channelId"`  // V2 模型线路 id（可选，uuid 字符串）
}

// FileInput 参考图，前端 dataUrl。
type FileInput struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Size    int64  `json:"size"`
	DataURL string `json:"dataUrl"`
}

// SubmitFeedbackReq POST /api/v1/generation/tasks/:id/feedback 请求体（小红书发布反馈）。
type SubmitFeedbackReq struct {
	NoteURL  string `json:"noteUrl"`  // 小红书笔记链接（必填）
	Views    int    `json:"views"`    // 阅读量
	Likes    int    `json:"likes"`    // 点赞数
	Collects int    `json:"collects"` // 收藏数
	Comments int    `json:"comments"` // 评论数
	Shares   int    `json:"shares"`   // 转发数
}

// SanitizedTask 对外暴露的 history 记录，与 Node sanitizeHistory 字段一致
// （不含 promptHash/latencyMs）。
type SanitizedTask struct {
	ID                 string              `json:"id"`
	UserID             string              `json:"userId"`
	Username           string              `json:"username"`
	CreatedAt          time.Time           `json:"createdAt"`
	Status             string              `json:"status"`
	Model              string              `json:"model"`
	Mode               string              `json:"mode"`
	Title              string              `json:"title"`
	Body               string              `json:"body"`
	Tags               []string            `json:"tags"`
	Topic              string              `json:"topic"`
	Images             []ImageRecord       `json:"images"`
	ReferenceImages    []ImageRecord       `json:"referenceImages"`
	Prompts            []string            `json:"prompts"`  // 给大模型的提示词（仅管理员侧展示，用户侧忽略）
	Feedback           *types.TaskFeedback `json:"feedback"` // 小红书发布反馈，null=未反馈
	Error              string              `json:"error"`
	UploadedImageCount int                 `json:"uploadedImageCount"`
	CategoryID         *string             `json:"categoryId"`
	ChannelID          *string             `json:"channelId"`
	ChannelName        string              `json:"channelName"`
	DurationMs         int                 `json:"durationMs"`
}

// dbStatusToHistory DB 任务状态 -> 前端历史状态（completed -> success，对齐 HistoryRecord 契约）。
func dbStatusToHistory(s string) string {
	if s == "completed" {
		return "success"
	}
	return s
}

// historyStatusToDB 前端历史状态 -> DB 任务状态（success -> completed，用于筛选）。
func historyStatusToDB(s string) string {
	if s == "success" {
		return "completed"
	}
	return s
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
	refImages := rec.ReferenceImages
	if refImages == nil {
		refImages = []ImageRecord{}
	}
	prompts := rec.Prompts
	if prompts == nil {
		prompts = []string{}
	}
	out := SanitizedTask{
		ID:                 rec.ID.String(),
		UserID:             rec.UserID.String(),
		Username:           rec.Username,
		CreatedAt:          rec.CreatedAt,
		Status:             dbStatusToHistory(rec.Status),
		Model:              rec.Model,
		Mode:               rec.Mode,
		Title:              rec.Title,
		Body:               rec.Body,
		Tags:               tags,
		Topic:              rec.Topic,
		Images:             images,
		ReferenceImages:    refImages,
		Prompts:            prompts,
		Feedback:           rec.Feedback,
		Error:              rec.Error,
		UploadedImageCount: rec.UploadedImageCount,
		ChannelName:        rec.ChannelName,
	}
	if rec.StartedAt != nil && rec.CompletedAt != nil && rec.CompletedAt.After(*rec.StartedAt) {
		out.DurationMs = int(rec.CompletedAt.Sub(*rec.StartedAt).Milliseconds())
	}
	if rec.ChannelID != uuid.Nil {
		s := rec.ChannelID.String()
		out.ChannelID = &s
	}
	if rec.CategoryID != uuid.Nil {
		s := rec.CategoryID.String()
		out.CategoryID = &s
	}
	return out
}

// imageBasename 从代理路径 /api/v1/generation/images/{filename} 提取 filename。
// 已是 http 公开 URL 或空则返回空串（remote/已转换图不重复转换）。
func imageBasename(url string) string {
	if url == "" || strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		return ""
	}
	const proxyPrefix = "/api/v1/generation/images/"
	if !strings.HasPrefix(url, proxyPrefix) {
		return ""
	}
	return strings.TrimPrefix(url, proxyPrefix)
}

// rewriteOne 把单条 ImageRecord 的代理 URL 转成 COS 公开直连 URL + 缩略图。
//   - local/reference：URL->公开原图，ThumbURL->公开缩略图(imageMogr2)；DownloadURL 保留代理（下载同源无 CORS）。
//   - remote（wala 外链）：URL 不动，ThumbURL 兜底为 URL。
//   - 代理/私有桶模式（PublicURL 回退代理）：URL 保持代理，ThumbURL 留空，前端兜底用 URL。
func rewriteOne(store taskStore, img *ImageRecord) {
	if img == nil {
		return
	}
	if img.Source == "remote" {
		if img.ThumbURL == "" {
			img.ThumbURL = img.URL
		}
		return
	}
	// 原图 URL 转公开/代理
	origFile := imageBasename(img.URL)
	if origFile != "" {
		img.URL = store.PublicURL(origFile)
	}
	// 缩略图 ThumbURL：新生成图有存储缩略图对象（转公开/代理）；历史图空值兜底 imageMogr2（生产）/ 空（dev 前端用原图）
	if img.ThumbURL != "" {
		if thumbFile := imageBasename(img.ThumbURL); thumbFile != "" {
			img.ThumbURL = store.PublicURL(thumbFile)
		}
	} else if origFile != "" {
		img.ThumbURL = store.ThumbURL(origFile)
	}
}

func rewriteImageURLs(store taskStore, imgs []ImageRecord) {
	for i := range imgs {
		rewriteOne(store, &imgs[i])
	}
}

// SanitizeHistory 序列化历史记录 + 图片 URL 转换（ListHistory/SubmitFeedback 用）。
func (u *Usecase) SanitizeHistory(rec TaskRecord) SanitizedTask {
	s := sanitize(rec)
	rewriteImageURLs(u.store, s.Images)
	rewriteImageURLs(u.store, s.ReferenceImages)
	return s
}

// SanitizeAsyncTask 序列化异步任务 + 图片 URL 转换（GetTask/ListTasks 用，含子图进度图）。
func (u *Usecase) SanitizeAsyncTask(rec TaskRecord) AsyncTaskResp {
	resp := sanitizeAsyncTask(rec)
	rewriteImageURLs(u.store, resp.ResultImages)
	rewriteImageURLs(u.store, resp.ReferenceImages)
	for i := range resp.SubTaskStatus {
		rewriteOne(u.store, resp.SubTaskStatus[i].Image)
	}
	return resp
}

// GenerateResp /api/v1/generation 成功响应（V2 异步任务：返回 taskId，结果走轮询）。
type GenerateResp struct {
	TaskID           uuid.UUID `json:"taskId"`
	Status           string    `json:"status"`
	TotalCount       int       `json:"totalCount"`
	EstimatedSeconds int       `json:"estimatedSeconds"`
}

// shanghaiDateKey 与 Node shanghaiDateKey 一致：UTC +8h 后取 YYYY-MM-DD。
func shanghaiDateKey(t time.Time) string {
	return t.UTC().Add(8 * time.Hour).Format("2006-01-02")
}

var dataURLRegex = regexp.MustCompile(`^data:([^;]+);base64,(.+)$`)

const maxReferenceImageBytes = 10 * 1024 * 1024

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
		return ".jpg"
	case "image/webp":
		return ".webp"
	default:
		return ".png"
	}
}

// maxReferenceImageEdge 参考图长边像素上限。超过则等比缩小，规避 gpt-image-2 "Invalid image
// file or mode for image"（实测 5712x4284 iPhone 原图触发；官方输出 size 约束最大边≤3840，
// 输入参考图尺寸/模式上限未文档化，以此为兜底阈值）。
const maxReferenceImageEdge = 3840

// normalizeReferenceImage 规范化参考图：长边超过 maxEdge 时等比缩小，画到白底后转 JPEG
// （JPEG 天然 RGB，顺带去掉 alpha/索引/灰度等非 RGB 模式）。小图（长边≤maxEdge）原样返回，
// 零额外损耗。解码失败不阻塞（原样返回，交由上游拒绝并给出明确错误）。
func normalizeReferenceImage(data []byte, contentType string, maxEdge int) ([]byte, string) {
	// 先用轻量 DecodeConfig 判尺寸，小图直接原样返回，避免全量解码占内存（生图并发时尤其重要）
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return data, contentType
	}
	if cfg.Width <= maxEdge && cfg.Height <= maxEdge {
		return data, contentType
	}
	srcImg, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data, contentType
	}
	bounds := srcImg.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w >= h {
		h = h * maxEdge / w
		w = maxEdge
	} else {
		w = w * maxEdge / h
		h = maxEdge
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	// 先铺白底，避免 RGBA 透明区域在去 alpha 后变黑
	draw.Draw(dst, dst.Rect, &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Rect, srcImg, bounds, draw.Over, nil)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 90}); err != nil {
		return data, contentType
	}
	return buf.Bytes(), "image/jpeg"
}

// toWalaFile 把 bridal FileInput 转 wala.FileInput（解码 dataUrl）。
func toWalaFile(f FileInput) (wala.FileInput, error) {
	_, data, err := parseDataURL(f.DataURL)
	if err != nil {
		return wala.FileInput{}, fmt.Errorf("解析参考图失败: %w", err)
	}
	if len(data) == 0 {
		return wala.FileInput{}, fmt.Errorf("图片文件为空")
	}
	if len(data) > maxReferenceImageBytes {
		return wala.FileInput{}, fmt.Errorf("单张图片不能超过 10MB")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 {
		return wala.FileInput{}, fmt.Errorf("图片无法解析")
	}
	contentType, ok := map[string]string{
		"jpeg": "image/jpeg",
		"png":  "image/png",
		"webp": "image/webp",
	}[format]
	if !ok {
		return wala.FileInput{}, fmt.Errorf("仅支持 JPG、PNG 或 WebP 图片")
	}
	// 规范化：长边超阈值等比缩小并转 RGB JPEG（白底去 alpha），规避 gpt-image-2 对大图/非 RGB 模式的拒绝。
	data, contentType = normalizeReferenceImage(data, contentType, maxReferenceImageEdge)
	name := f.Name
	if name == "" {
		name = "reference" + extensionFromMime(contentType)
	} else if ext := path.Ext(name); !strings.EqualFold(ext, extensionFromMime(contentType)) {
		name = strings.TrimSuffix(name, ext) + extensionFromMime(contentType)
	}
	return wala.FileInput{Name: name, Type: contentType, Size: int64(len(data)), Data: data}, nil
}

// urlToWalaFile 把已存储图片 URL（MinIO 代理路径或完整 URL）转 wala.FileInput，
// 供单张重试重建参考图/连续性参考用。复用 toWalaFile 的校验与规范化（长边缩小 + 转 RGB JPEG）。
func (u *Usecase) urlToWalaFile(ctx context.Context, url, name string) (wala.FileInput, error) {
	if url == "" {
		return wala.FileInput{}, fmt.Errorf("图片 URL 为空")
	}
	var data []byte
	if strings.HasPrefix(url, "/api/v1/generation/images/") {
		// MinIO 代理路径：提取 filename 直接读对象存储，避免后端 HTTP 自调
		filename := strings.TrimPrefix(url, "/api/v1/generation/images/")
		rc, err := u.store.GetImage(ctx, filename)
		if err != nil {
			return wala.FileInput{}, fmt.Errorf("读取参考图失败: %w", err)
		}
		defer rc.Close()
		data, err = io.ReadAll(rc)
		if err != nil {
			return wala.FileInput{}, err
		}
	} else {
		// 完整 URL（remote 生成图或公有读 COS）：HTTP 下载
		resp, err := http.Get(url)
		if err != nil {
			return wala.FileInput{}, fmt.Errorf("下载参考图失败: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return wala.FileInput{}, fmt.Errorf("参考图下载失败: HTTP %d", resp.StatusCode)
		}
		data, err = io.ReadAll(resp.Body)
		if err != nil {
			return wala.FileInput{}, err
		}
	}
	if len(data) == 0 {
		return wala.FileInput{}, fmt.Errorf("图片数据为空")
	}
	// 嗅探内容类型，构造 dataUrl 复用 toWalaFile 的校验 + 规范化
	contentType := http.DetectContentType(data)
	dataURL := "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(data)
	return toWalaFile(FileInput{Name: name, DataURL: dataURL})
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
		// 生成缩略图（480 宽 JPEG），失败不阻塞生图（ThumbURL 留空，序列化兜底 imageMogr2/原图）
		thumbURL, thumbErr := u.store.PutThumbnail(ctx, filename, data)
		if thumbErr != nil {
			u.logger.WarnContext(ctx, "generate thumbnail failed", "file", filename, "error", thumbErr)
		}
		saved = append(saved, ImageRecord{
			ID:          fmt.Sprintf("%s-%d", recordID, imageNumber),
			Name:        name,
			URL:         proxyURL,
			DownloadURL: proxyURL,
			ThumbURL:    thumbURL,
			Source:      "local",
		})
	}
	return saved, nil
}

// promptPlan 单张图的 prompt 计划。
// ir 为模型无关的 CanonicalPrompt，降级时 callWithFallbackLogged 按各线路 modelID 重新 Render 方言；
// prompt 为 image2 渲染结果（兜底 + promptHash 用），与旧 GeneratePrompt 逐字节一致。
type promptPlan struct {
	ir             *prompt.CanonicalPrompt
	prompt         string
	includesPerson bool
	name           string
}

// Generate 执行生图，1:1 对应 Node handleGenerate。
func (u *Usecase) Generate(ctx context.Context, user *domain.User, req GenerateReq) (*GenerateResp, error) {
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

	// categoryId 是内容生成和生图共同的引擎路由键。存量客户端未传时兼容默认 bridal；
	// 新工作台必须按已选类目的 engine 读取 imagePrompt，不能硬编码默认引擎。
	var categoryID uuid.UUID
	if req.CategoryID != "" {
		id, err := uuid.Parse(req.CategoryID)
		if err != nil {
			return nil, wala.NewError(400, "类目 ID 格式不正确。")
		}
		categoryID = id
	}
	engineKey, err := u.resolveImagePromptEngine(ctx, categoryID)
	if err != nil {
		return nil, wala.NewError(400, err.Error())
	}
	copyEnabled := true
	if u.engines != nil {
		copyEnabled, err = u.engines.CopyEnabled(ctx, engineKey)
		if err != nil {
			return nil, wala.NewError(400, err.Error())
		}
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
	if copyEnabled && (title == "" || textBody == "" || len(tags) == 0) {
		return nil, wala.NewError(400, "缺少标题、正文或标签。")
	}

	// 3. 解析参考图：场景图（0~1 张，可选）+ 产品图（4~6 张，必传）
	var sceneFile *wala.FileInput
	if req.SceneReferenceImage != nil {
		wf, err := toWalaFile(*req.SceneReferenceImage)
		if err != nil {
			return nil, wala.NewError(400, "场景参考图不符合要求："+err.Error()+"。")
		}
		sceneFile = &wf
	}
	productFiles := make([]wala.FileInput, 0, len(req.ProductReferenceImages))
	for _, rf := range req.ProductReferenceImages {
		wf, err := toWalaFile(rf)
		if err != nil {
			return nil, wala.NewError(400, fmt.Sprintf("第 %d 张产品图不符合要求：%s。", len(productFiles)+1, err.Error()))
		}
		productFiles = append(productFiles, wf)
	}
	if len(productFiles) < 4 {
		return nil, wala.NewError(400, "请上传至少 4 张婚纱产品图。")
	}
	if len(productFiles) > 6 {
		productFiles = productFiles[:6]
	}
	sceneLocked := sceneFile != nil

	// 积分校验（非管理员需 credits >= 请求数，与 Node index.mjs:784 一致）
	if !user.HasUnlimitedImageGeneration() {
		if user.Credits < len(paramsList) {
			return nil, wala.NewError(402, fmt.Sprintf("积分余额不足。当前余额 %d，本次需要 %d 积分。请联系管理员充值。", user.Credits, len(paramsList)))
		}
	}

	// 用户级并发由 per-user 信号量控制（容量 = 主线路 max_concurrency，跨任务共享），不再限任务数。
	// 同一用户可提交多个任务，但同时在生成的图片数受 max_concurrency 限制（1=跨任务逐张串行）。

	// 4. 每日额度校验（上海时区，admin 不限量）
	if !user.HasUnlimitedImageGeneration() {
		dateKey := shanghaiDateKey(time.Now())
		generatedToday, err := u.repo.CountImagesForDate(ctx, user.ID, dateKey)
		if err != nil {
			u.logger.ErrorContext(ctx, "count images for date failed", "error", err)
		} else {
			limit := domain.NormalizeDailyImageLimit(user.DailyImageLimit, domain.DefaultDailyImageLimit)
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

	// normalizedParamsList：全组统一场景；人物图统一模特；场景图锁定整组共享
	normalized := make([]prompt.Params, len(paramsList))
	for i, p := range paramsList {
		p.ScenePreference = sharedScenePreference
		p.SceneLocked = sceneLocked
		if personTypes[p.ImageType] {
			p.ModelChoice = sharedModelChoice
		}
		normalized[i] = p
	}

	// 6. 生成 promptPlans。imagePrompt 与内容生成使用同一个 category.engine。
	imageAssets, err := u.loadImagePromptAssets(ctx, engineKey)
	if err != nil {
		return nil, wala.NewError(400, err.Error())
	}
	plans := make([]promptPlan, len(normalized))
	for i, p := range normalized {
		sctx := prompt.SeriesContext{
			Index:           i,
			Total:           len(normalized),
			LeadPersonIndex: leadPersonIndex,
			LeadPhoneIndex:  leadPhoneIndex,
		}
		input := prompt.ResolvePromptInput(p)
		ir := prompt.Compile(input, sctx, imageAssets)
		pr := (&prompt.Image2Adapter{}).Render(ir).Prompt
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
			ir:             ir,
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

	mode := "text-to-image"
	if len(productFiles) > 0 || sceneFile != nil {
		mode = "image-edit"
	}
	model := u.defaultImageModelID()
	// 8. 解析 categoryId/channelId
	var channelID uuid.UUID
	var selectedChannel *channels.ChannelRecord
	if req.ChannelID != "" {
		if id, err := uuid.Parse(req.ChannelID); err == nil {
			channelID = id
		}
	}
	// 模型线路校验（与 Node index.mjs:794 一致）：用户指定线路须存在且启用
	if channelID != uuid.Nil && u.channels != nil {
		ch, err := u.channels.GetConfigByID(ctx, channelID)
		if err != nil || ch == nil || !ch.IsEnabled {
			return nil, wala.NewError(400, "所选模型线路不可用。")
		}
		selectedChannel = ch
	}
	// 前端未指定线路时回退数据库默认线路（admin 后台可配），仍无则留空走 .env 默认 client
	if channelID == uuid.Nil && u.channels != nil {
		if ch, err := u.channels.GetDefaultConfig(ctx); err == nil && ch != nil {
			channelID = ch.ID
			selectedChannel = ch
		}
	}
	if selectedChannel != nil {
		model = u.normalizedImageModelID(selectedChannel.ModelID)
	}

	// 9. 入库 queued + 预写 N 条 pending 子图占位
	recordID := uuid.New()
	estimatedSeconds := len(plans) * 90 // 粗估每张 90s（与 Node tasks.mjs:829 一致）
	uploadedCount := len(productFiles)
	if sceneFile != nil {
		uploadedCount++
	}
	rec := TaskRecord{
		ID:                 recordID,
		UserID:             user.ID,
		Username:           user.Username,
		Model:              model,
		Mode:               mode,
		Title:              title,
		Body:               textBody,
		Tags:               tags,
		Topic:              req.Topic,
		PromptHash:         promptHash,
		UploadedImageCount: uploadedCount,
		EstimatedSeconds:   estimatedSeconds,
		ImageSize:          req.Size,
		ImageQuality:       req.Quality,
		CategoryID:         categoryID,
		ChannelID:          channelID,
	}
	// 存参考图到 MinIO（复用 imagestore），失败不阻塞生图（仅 Warn）。场景图 Kind=scene 在前，产品图 Kind=product。
	refImages := make([]ImageRecord, 0, len(productFiles)+1)
	if sceneFile != nil {
		filename := fmt.Sprintf("%s-ref-scene%s", recordID, extensionFromMime(sceneFile.Type))
		proxyURL, err := u.store.PutImage(ctx, filename, sceneFile.Data, sceneFile.Type)
		if err != nil {
			u.logger.WarnContext(ctx, "save scene reference image failed", "error", err)
		} else {
			thumbURL, _ := u.store.PutThumbnail(ctx, filename, sceneFile.Data)
			sceneFile.SourceURL = proxyURL
			sceneFile.ReferenceKind = "scene"
			refImages = append(refImages, ImageRecord{
				ID:          fmt.Sprintf("%s-ref-scene", recordID),
				Name:        sceneFile.Name,
				URL:         proxyURL,
				DownloadURL: proxyURL,
				ThumbURL:    thumbURL,
				Source:      "reference",
				Kind:        "scene",
			})
		}
	}
	for i, f := range productFiles {
		filename := fmt.Sprintf("%s-ref-product-%d%s", recordID, i+1, extensionFromMime(f.Type))
		proxyURL, err := u.store.PutImage(ctx, filename, f.Data, f.Type)
		if err != nil {
			u.logger.WarnContext(ctx, "save product reference image failed", "index", i, "error", err)
			continue
		}
		thumbURL, _ := u.store.PutThumbnail(ctx, filename, f.Data)
		productFiles[i].SourceURL = proxyURL
		productFiles[i].ReferenceKind = "product"
		refImages = append(refImages, ImageRecord{
			ID:          fmt.Sprintf("%s-ref-product-%d", recordID, i+1),
			Name:        f.Name,
			URL:         proxyURL,
			DownloadURL: proxyURL,
			ThumbURL:    thumbURL,
			Source:      "reference",
			Kind:        "product",
		})
	}
	rec.ReferenceImages = refImages
	rec.Prompts = promptStrings
	// 子图 name 用计划里的标准名（图N｜类型｜描述），预创建时直接写入，避免占位"图片 N"未回填。
	imageNames := make([]string, len(plans))
	for i, pl := range plans {
		imageNames[i] = pl.name
	}
	if err := u.repo.CreateTask(ctx, rec, imageNames); err != nil {
		u.logger.ErrorContext(ctx, "create task failed", "error", err)
		return nil, wala.NewError(500, "创建任务失败。")
	}

	// 10. 启 worker（独立 context 不绑请求；取消靠 IsTaskCancelled 检测）
	go u.runTask(recordID, user, plans, sceneFile, productFiles, req.Size, req.Quality, channelID)

	u.logger.InfoContext(ctx, "task created", "id", recordID, "user", user.Username, "mode", mode, "sceneRef", sceneFile != nil, "productFiles", len(productFiles), "prompts", len(plans), "model", model)

	return &GenerateResp{
		TaskID:           recordID,
		Status:           "queued",
		TotalCount:       len(plans),
		EstimatedSeconds: estimatedSeconds,
	}, nil
}

// ListHistory /api/v1/generation/history，支持分页 + 状态/时间筛选。
// 复用 ListTasksPaged（查 generation_tasks），结果序列化为 SanitizedTask（HistoryRecord 契约）。
func (u *Usecase) ListHistory(ctx context.Context, user *domain.User, page, pageSize int, status string, startTime, endTime *time.Time, taskID, filterUserID, categoryID uuid.UUID) ([]SanitizedTask, int, error) {
	recs, total, err := u.repo.ListTasksPaged(ctx, user.ID, user.HasUnlimitedImageGeneration(), page, pageSize, historyStatusToDB(status), startTime, endTime, taskID, filterUserID, categoryID, true)
	if err != nil {
		return nil, 0, err
	}
	isAdmin := user.HasUnlimitedImageGeneration()
	out := make([]SanitizedTask, 0, len(recs))
	for _, r := range recs {
		s := u.SanitizeHistory(r)
		if !isAdmin {
			s.Prompts = []string{} // 提示词仅管理员可见，用户侧清空
		}
		out = append(out, s)
	}
	return out, total, nil
}

// SubmitFeedback 用户回填小红书发布反馈（笔记链接 + 数据指标）。只能反馈自己的任务。
func (u *Usecase) SubmitFeedback(ctx context.Context, user *domain.User, taskID uuid.UUID, req SubmitFeedbackReq) (*TaskRecord, error) {
	rec, err := u.repo.GetTask(ctx, taskID)
	if err != nil || rec == nil {
		return nil, wala.NewError(404, "任务不存在。")
	}
	if rec.UserID != user.ID {
		return nil, wala.NewError(403, "无权反馈他人任务。")
	}
	noteURL := strings.TrimSpace(req.NoteURL)
	if noteURL == "" {
		return nil, wala.NewError(400, "请填写小红书笔记链接。")
	}
	fb := types.TaskFeedback{
		NoteURL:     noteURL,
		Views:       req.Views,
		Likes:       req.Likes,
		Collects:    req.Collects,
		Comments:    req.Comments,
		Shares:      req.Shares,
		SubmittedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := u.repo.UpdateTaskFeedback(ctx, taskID, fb); err != nil {
		return nil, err
	}
	rec.Feedback = &fb
	return rec, nil
}
