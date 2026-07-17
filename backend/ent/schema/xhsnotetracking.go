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
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (XHSNoteTracking) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "updated_at")}
}
