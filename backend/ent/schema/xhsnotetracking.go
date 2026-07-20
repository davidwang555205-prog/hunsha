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

// XHSNoteTracking 是一条生图任务关联的小红书笔记。一个任务只允许关联一条笔记。
type XHSNoteTracking struct{ ent.Schema }

func (XHSNoteTracking) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("generation_task_xhs_notes")}
}

func (XHSNoteTracking) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("task_id", uuid.UUID{}).Unique(),
		field.UUID("user_id", uuid.UUID{}),
		field.String("note_url"),
		field.String("canonical_url").Default(""),
		field.String("work_id").Default(""),
		field.String("account_user_id").Default(""),
		field.String("account_id").Default(""),
		field.String("title").Default(""),
		field.String("body").Default(""),
		field.String("cover_url").Default(""),
		field.String("work_type").Default(""),
		field.String("published_at").Default(""),
		field.Int("user_refresh_count").Default(0),
		field.Int("user_link_edit_count").Default(0),
		// next_refresh_at：后台自动采集调度依据。NULL 表示不再自动采（历史数据）。
		// Import/UpdateLink 时设为 now 触发首次采集，采集成功后按 1/7/15 节奏推进。
		field.Time("next_refresh_at").Optional().Nillable(),
		// link_epoch：链接版本号，改链接 +1。快照按 epoch 区分新旧链接，旧快照保留入库。
		field.Int("link_epoch").Default(1),
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (XHSNoteTracking) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "updated_at")}
}
