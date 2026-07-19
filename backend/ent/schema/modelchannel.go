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

// ModelChannel 模型线路，对应前端 Channel 类型（src/types/api.ts）。
// 管理后台配 WalaAPI 线路（apiBaseUrl/apiKey/modelId），生图按 channel 配置调用。
// 公开列表（/api/channels）不返 apiKey，管理列表（/api/admin/channels）含 apiKey。
type ModelChannel struct {
	ent.Schema
}

func (ModelChannel) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("model_channels"),
	}
}

func (ModelChannel) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("name").Default(""),                              // 线路名称
		field.String("api_base_url").Default(""),                      // WalaAPI 基址
		field.String("api_key").Default(""),                           // WalaAPI 密钥（公开列表不返）
		field.String("protocol").Default("openai"),                    // 调用协议（openai 兼容，预留扩展）
		field.String("model_id").Default("gpt-image-2"),               // 生图模型
		field.JSON("supported_sizes", []string{}).Default([]string{}), // 支持的尺寸
		field.String("default_quality").Default("medium"),             // 默认质量
		field.Bool("is_enabled").Default(true),                        // 是否启用
		field.Bool("is_default").Default(false),                       // 是否默认线路（唯一）
		field.Int("sort_order").Default(0),                            // 排序
		field.Int("max_concurrency").Default(1),                       // 单次生图任务内并发段最大并发度（1=逐张串行生成）
		// RequestTimeoutMs 为该线路单次上游请求超时；0 时兼容使用 bridal.wala_image_timeout_ms。
		field.Int("request_timeout_ms").Default(0),
		// 稳定性统计（累计，原子累加）：runTask 每张图调用 wala 后 IncStats 更新
		field.Int("total_requests").Default(0),   // 累计请求次数
		field.Int("success_requests").Default(0), // 成功次数
		field.Int("failed_requests").Default(0),  // 失败次数
		field.Int("total_latency_ms").Default(0), // 累计耗时（毫秒，算平均用）
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ModelChannel) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("is_enabled", "sort_order"),
	}
}

func (ModelChannel) Edges() []ent.Edge {
	return nil
}
