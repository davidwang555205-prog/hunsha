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

// XHSNoteSnapshot 保存一次外部采集结果；趋势严格以快照时间序列计算，绝不覆盖旧值。
type XHSNoteSnapshot struct{ ent.Schema }

func (XHSNoteSnapshot) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("generation_task_xhs_snapshots")}
}

func (XHSNoteSnapshot) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("tracking_id", uuid.UUID{}),
		field.Int("sequence"),
		field.String("trigger"), // initial | user_refresh | admin_refresh
		field.String("status").Default("success"),
		field.String("error").Default(""),
		field.Time("captured_at").Default(time.Now),
		field.String("work_updated_at").Default(""),
		field.Int("views").Default(0),
		field.Int("likes").Default(0),
		field.Int("collects").Default(0),
		field.Int("comments").Default(0),
		field.Int("shares").Default(0),
		field.String("account_name").Default(""),
		field.String("account_avatar").Default(""),
		field.String("account_display_id").Default(""),
		field.String("account_user_id").Default(""),
		field.String("account_description").Default(""),
		field.Int("account_fans").Default(0),
		field.Int("account_total_works").Default(0),
		field.Int("account_likes").Default(0),
		field.Int("account_collects").Default(0),
		field.Int("account_follows").Default(0),
		field.String("account_updated_at").Default(""),
		field.JSON("similar_accounts", []types.XHSSimilarAccount{}).Default([]types.XHSSimilarAccount{}),
		field.String("similar_summary").Default(""),
		field.Time("created_at").Default(time.Now),
	}
}

func (XHSNoteSnapshot) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("tracking_id", "sequence").Unique(),
		index.Fields("tracking_id", "captured_at"),
	}
}
