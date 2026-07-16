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

// CreditTransaction 积分变动记录，对应前端 CreditTransaction 类型。
// type: recharge（充值）| consume（消耗）| adjust（调整）
// amount: 正数充值/调整增加，负数消耗/调整扣减
// balance_after: 变动后余额（便于审计）
// related_task_id: 关联生图任务（消耗场景）
type CreditTransaction struct {
	ent.Schema
}

func (CreditTransaction) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("credit_transactions"),
	}
}

func (CreditTransaction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("user_id", uuid.UUID{}),
		field.String("type").Default("consume"),            // recharge|consume|adjust
		field.Int("amount").Default(0),                     // 正数增加，负数扣减
		field.Int("balance_after").Default(0),              // 变动后余额
		field.String("description").Default(""),            // 描述
		field.UUID("related_task_id", uuid.UUID{}).Optional(), // 关联生图任务（消耗场景）
		field.Time("created_at").Default(time.Now),
	}
}

func (CreditTransaction) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "created_at"),
		index.Fields("related_task_id"),
	}
}

func (CreditTransaction) Edges() []ent.Edge {
	return nil
}
