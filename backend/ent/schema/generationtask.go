package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
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
	// 不用 ent edge：bridal 用显式 task_id 字段关联，避免 ent 自动外键列名
	// (generation_task_images) 与 migration (task_id) 不一致。查询走两步：先 task 再按 task_id 查 images。
	return nil
}
