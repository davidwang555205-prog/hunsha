package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"

	"bridal/backend/ent/types"
)

// GenerationTask 生图任务，对应 Node history 表。
// 字段与 Node sanitizeHistory 输出对齐（前端契约不变）：
// id/userId/username/createdAt/status/model/mode/title/body/tags/topic/error/uploadedImageCount。
// promptHash/latencyMs 存库但不返回前端（与 Node sanitizeHistory 一致）。
type GenerationTask struct {
	ent.Schema
}

func (GenerationTask) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("generation_tasks"),
	}
}

func (GenerationTask) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("user_id", uuid.UUID{}),
		field.String("username").Default(""),           // 冗余，便于展示（与 Node 一致）
		field.String("status").Default(""),              // success | failed
		field.String("model").Default(""),               // gpt-image-2
		field.String("mode").Default(""),                // image-edit | text-to-image
		field.String("title").Default(""),
		field.String("body").Default(""),
		field.JSON("tags", []string{}).Default([]string{}),
		field.String("topic").Default(""),
		field.String("error").Default(""),
		field.String("prompt_hash").Default(""),
		field.Int("uploaded_image_count").Default(0),
		field.Int("latency_ms").Default(0),
		field.Int("total_count").Default(0),
		field.Int("completed_count").Default(0),
		field.Int("estimated_seconds").Default(0),
		field.UUID("category_id", uuid.UUID{}).Optional(),
		field.UUID("channel_id", uuid.UUID{}).Optional(),
		field.Time("started_at").Optional(),
		field.Time("completed_at").Optional(),
		field.JSON("reference_images", []types.ReferenceImage{}).Optional(),
		field.JSON("prompts", []string{}).Optional(),                  // 每张图给大模型的英文提示词，管理员复盘用（用户侧不返回）
		field.JSON("feedback", types.TaskFeedback{}).Optional(),        // 小红书发布反馈：笔记链接 + 阅读/点赞/收藏/评论
		field.Bool("deleted").Default(false),                           // 逻辑删除标记（定时清理过期历史时置 true，MinIO 文件保留）
		field.Time("deleted_at").Optional(),                            // 逻辑删除时间
		field.Time("created_at").Default(time.Now),
	}
}

func (GenerationTask) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "created_at"),
		index.Fields("created_at"),
	}
}

func (GenerationTask) Edges() []ent.Edge {
	// task -> images 1:N。image 侧 edge.From("task").Ref("images").Field("task_id") 显式指定列名，
	// 复用 migration 000024 已建的 task_id 列，避免 ent 自动外键列名冲突。
	return []ent.Edge{
		edge.To("images", GenerationImage.Type),
	}
}
