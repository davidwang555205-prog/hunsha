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

// ContentEngine 内容引擎配置，对应前端 ContentEngine 类型。
// key 唯一标识（如 bridal），config 存可编辑素材（如主题覆盖文案 xiaohongshuTopicOverrides）。
// categories.engine 引用 content_engines.key（软关联）。运行时拉 config 覆盖代码默认素材（带降级）。
type ContentEngine struct {
	ent.Schema
}

func (ContentEngine) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("content_engines"),
	}
}

func (ContentEngine) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("key").Unique(),                                    // 引擎标识（如 bridal）
		field.String("name").Default(""),                                // 引擎名称
		field.String("description").Default(""),                         // 引擎简介
		field.JSON("config", map[string]any{}).Default(map[string]any{}), // 可编辑素材（主题覆盖等）
		field.Bool("is_enabled").Default(true),
		field.Int("sort_order").Default(0),
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ContentEngine) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("is_enabled", "sort_order"),
	}
}

func (ContentEngine) Edges() []ent.Edge {
	return nil
}
