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
