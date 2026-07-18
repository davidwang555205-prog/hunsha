package generation

import (
	"context"
	"time"

	"github.com/google/uuid"

	"bridal/backend/biz/channels"
	"bridal/backend/ent/types"
)

// 本文件定义 Usecase 对四个依赖（repo/store/credits/channels）的接口抽象，
// 使 runTask/generateOne 可脱离真实 DB/MinIO 测试。具体实现（*Repo / *imagestore.Store /
// *credits.Usecase / *channels.Usecase）隐式实现这些接口（Go duck typing）。

// taskRepo 抽象生图任务数据访问（*Repo 实现）。
type taskRepo interface {
	CreateTask(ctx context.Context, rec TaskRecord, names []string) error
	GetTask(ctx context.Context, taskID uuid.UUID) (*TaskRecord, error)
	SetTaskStarted(ctx context.Context, taskID uuid.UUID) error
	SetTaskDone(ctx context.Context, taskID uuid.UUID, status, errMsg string) error
	UpdateSubTaskImage(ctx context.Context, imageID, status, url, thumbURL, errMsg string, latencyMs int) error
	IncCompletedCount(ctx context.Context, taskID uuid.UUID) error
	IsTaskCancelled(ctx context.Context, taskID uuid.UUID) (bool, error)
	CancelTask(ctx context.Context, taskID uuid.UUID) error
	CountActiveTasks(ctx context.Context, userID uuid.UUID) (int, error)
	CountImagesForDate(ctx context.Context, userID uuid.UUID, shanghaiDate string) (int, error)
	ListTasksPaged(ctx context.Context, userID uuid.UUID, isAdmin bool, page, pageSize int, status string, startTime, endTime *time.Time, taskID, filterUserID uuid.UUID) ([]TaskRecord, int, error)
	UpdateTaskFeedback(ctx context.Context, taskID uuid.UUID, fb types.TaskFeedback) error
	CleanupExpired(ctx context.Context, cutoff time.Time) (nTask, nImage int, err error)
	GetCategoryEngine(ctx context.Context, categoryID uuid.UUID) (*CategoryEngine, error)
}

// modelInvocationRepo 为调用审计提供可选能力。保持其与 taskRepo 分离，让既有 worker
// 单测无需耦合数据库审计；生产 Repo 同时实现两者。
type modelInvocationRepo interface {
	CreateModelInvocation(ctx context.Context, rec ModelInvocationRecord) error
	FinishModelInvocation(ctx context.Context, id uuid.UUID, status string, httpStatus, latencyMs, responseImageCount int, message string, completedAt time.Time) error
	ListModelInvocations(ctx context.Context, filter ModelInvocationQuery) ([]ModelInvocationRecord, int, error)
}

// CategoryEngine 是生图阶段所需的类目路由信息。类目配置 content_engines.key，
// 由 generation Repo 直接读取，避免 generation 与 categories 业务包形成循环依赖。
type CategoryEngine struct {
	Engine    string
	IsEnabled bool
}

// taskStore 抽象图片存储（*imagestore.Store 实现）。
type taskStore interface {
	PutImage(ctx context.Context, filename string, data []byte, contentType string) (string, error)
	PutThumbnail(ctx context.Context, origFilename string, data []byte) (string, error)
	PublicURL(filename string) string
	ThumbURL(filename string) string
}

// taskCredits 抽象积分扣减（*credits.Usecase 实现）。
type taskCredits interface {
	Consume(ctx context.Context, userID uuid.UUID, amount int, taskID uuid.UUID, desc string) error
}

// taskChannels 抽象模型线路（*channels.Usecase 实现）。
type taskChannels interface {
	GetConfigByID(ctx context.Context, id uuid.UUID) (*channels.ChannelRecord, error)
	GetDefaultConfig(ctx context.Context) (*channels.ChannelRecord, error)
	ListEnabledConfigs(ctx context.Context) ([]channels.ChannelRecord, error)
	ListAdmin(ctx context.Context) ([]channels.ChannelResp, error)
	IncStats(ctx context.Context, channelID uuid.UUID, success bool, latencyMs int)
}
