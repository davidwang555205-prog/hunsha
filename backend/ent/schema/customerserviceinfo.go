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

// CustomerServiceInfo 客服信息，对应前端 CustomerService 类型（src/types/api.ts）。
// 管理后台系统配置里维护，对外展示在用户端顶栏客服入口。
// 支持多个客服、排序、是否生效（用户端只看生效的）。
type CustomerServiceInfo struct {
	ent.Schema
}

func (CustomerServiceInfo) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("customer_service_infos"),
	}
}

func (CustomerServiceInfo) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("nickname").Default(""),   // 客服昵称
		field.String("phone").Default(""),      // 客服电话
		field.String("wechat_id").Default(""),  // 客服微信号
		field.String("qrcode_url").Default(""), // 微信二维码图片 URL（/api/v1/generation/images/{filename}）
		field.Int("sort_order").Default(0),     // 排序（小在前）
		field.Bool("is_enabled").Default(true), // 是否生效（用户端只看 true）
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CustomerServiceInfo) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("is_enabled", "sort_order"),
	}
}

func (CustomerServiceInfo) Edges() []ent.Edge {
	return nil
}
