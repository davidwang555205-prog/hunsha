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

// SystemSetting 系统设置（key-value），后台可配的运行时配置。
// 如 retention_days（数据保留天数）。替代 config.yaml 静态配置，支持运行时热更新。
// bridalauth.Summary 的 retentionDays 优先读此表，缺省回退 config 默认值。
type SystemSetting struct {
	ent.Schema
}

func (SystemSetting) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("system_settings"),
	}
}

func (SystemSetting) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("key").Unique(),                                    // 设置键（如 retention_days）
		field.JSON("value", map[string]any{}).Default(map[string]any{}), // 设置值（JSON，支持复杂结构）
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SystemSetting) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key"),
	}
}

func (SystemSetting) Edges() []ent.Edge {
	return nil
}
