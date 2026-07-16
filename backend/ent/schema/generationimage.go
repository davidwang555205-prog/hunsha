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
)

// GenerationImage 生图任务产生的图片，对应 Node history.images 数组元素。
// 字段 {id, name, url, downloadUrl, source} 与 Node image 对象一致：
//   - url/downloadUrl：local 图为后端代理路径 /api/v1/generation/images/<key>，
//     remote 图为 WalaAPI 原始 URL
//   - source：local | remote
type GenerationImage struct {
	ent.Schema
}

func (GenerationImage) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("generation_images"),
	}
}

func (GenerationImage) Fields() []ent.Field {
	return []ent.Field{
		// id 用 text 风格的 "${recordId}-${imageNumber}"（与 Node 一致），存为 string 主键。
		field.String("id").Unique(),
		field.UUID("task_id", uuid.UUID{}),
		field.String("name").Default(""),
		field.String("url").Default(""),
		field.String("download_url").Default(""),
		// thumb_url 缩略图访问路径（生图时生成缩略图对象存储，列表/详情页用；历史图空值兜底 imageMogr2 实时/原图）
		field.String("thumb_url").Default(""),
		field.String("source").Default("local"), // local | remote
		field.Int("image_number").Default(0),
		field.String("status").Default("pending"),
		field.String("error").Default(""),
		field.Int("latency_ms").Default(0),
		field.Bool("deleted").Default(false),                           // 逻辑删除标记（定时清理过期历史时置 true，MinIO 文件保留）
		field.Time("deleted_at").Optional(),                            // 逻辑删除时间
		field.Time("created_at").Default(time.Now),
	}
}

func (GenerationImage) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("task_id"),
	}
}

func (GenerationImage) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("task", GenerationTask.Type).Ref("images").Field("task_id").Unique().Required(),
	}
}
