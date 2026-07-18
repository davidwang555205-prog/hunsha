package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"

	"bridal/backend/ent/types"
)

// GenerationModelInvocation 记录每一次真实发往上游模型的 HTTP 生图请求。
// 一张子图的重试和线路 fallback 均产生独立记录，供管理员排障和线路调优。
type GenerationModelInvocation struct {
	ent.Schema
}

func (GenerationModelInvocation) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("generation_model_invocations")}
}

func (GenerationModelInvocation) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("task_id", uuid.UUID{}),
		field.String("generation_image_id").Default(""),
		field.Int("image_number").Default(0),
		field.UUID("user_id", uuid.UUID{}),
		field.String("username").Default(""),
		field.String("user_email").Default(""),
		field.String("user_role").Default(""),
		field.UUID("channel_id", uuid.UUID{}).Optional(),
		field.String("channel_name").Default(""),
		field.String("api_base_url").Default(""),
		field.String("protocol").Default(""),
		field.String("model_id").Default(""),
		field.Int("candidate_index").Default(0),
		field.Int("candidate_count").Default(0),
		field.Int("attempt_number").Default(0),
		field.Int("attempt_budget").Default(0),
		field.String("status").Default("processing"),
		field.String("prompt").Default(""),
		field.String("prompt_hash").Default(""),
		field.JSON("reference_images", []types.ModelInvocationReference{}).Default([]types.ModelInvocationReference{}),
		field.String("size").Default(""),
		field.String("quality").Default(""),
		field.Int("http_status").Default(0),
		field.Int("latency_ms").Default(0),
		field.Int("response_image_count").Default(0),
		field.String("error").Default(""),
		field.Time("requested_at").Default(time.Now),
		field.Time("completed_at").Optional(),
	}
}

func (GenerationModelInvocation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("task_id", "image_number", "requested_at"),
		index.Fields("user_id", "requested_at"),
		index.Fields("channel_id", "requested_at"),
		index.Fields("status", "requested_at"),
	}
}
