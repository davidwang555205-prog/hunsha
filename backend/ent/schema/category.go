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

// Category 内容类目，对应前端 Category 类型（src/types/api.ts）。
// 按产品类目组织工具首页（目前仅婚纱类，engine=bridal）。
// engine 决定内容引擎分支，config 存类目专属配置（预留扩展）。
type Category struct {
	ent.Schema
}

func (Category) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("categories"),
	}
}

func (Category) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("name").Default(""),                        // 类目名（婚纱）
		field.String("icon").Default(""),                        // 图标（emoji 或 key）
		field.String("engine").Default("bridal"),                // 内容引擎标识
		field.String("description").Default(""),                 // 类目简介（首页卡片展示）
		field.Int("sort_order").Default(0),                      // 排序
		field.Bool("is_enabled").Default(true),                  // 是否启用
		field.JSON("config", map[string]any{}).Default(map[string]any{}), // 类目专属配置
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Category) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("is_enabled", "sort_order"),
	}
}

func (Category) Edges() []ent.Edge {
	return nil
}
