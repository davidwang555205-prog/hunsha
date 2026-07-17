package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"

	"bridal/backend/consts"
	"bridal/backend/pkg/entx"
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

func (User) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Table("users"),
	}
}

func (User) Mixin() []ent.Mixin {
	return []ent.Mixin{
		entx.SoftDeleteMixin2{},
	}
}

// Fields of the User.
// bridal 在 MonkeyCode 原字段基础上追加 bridal 专属认证字段：
// username/display_name/daily_image_limit/password_salt/password_hash。
// bridal 认证层（biz/bridalauth）用 scrypt + HMAC token，独立于 MonkeyCode 的 bcrypt + cookie session。
// 原 password 字段保留（MonkeyCode team 链路 M4 复用），bridal 认证不使用它。
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Unique(),
		field.String("name").NotEmpty(),
		field.String("email").Optional(),
		field.String("avatar_url").Optional(),
		field.String("password").Optional(),
		field.String("role").GoType(consts.UserRole("")),
		field.String("status").GoType(consts.UserStatus("")),
		field.Bool("is_blocked").Default(false),
		field.JSON("default_configs", map[consts.DefaultConfigType]uuid.UUID{}).Optional(),
		// bridal 专属字段
		field.String("username").Unique().Optional(),              // 登录账号名（小写），bridal 认证用
		field.String("display_name").Optional(),                   // 展示名
		field.Int("daily_image_limit").Default(20).Range(0, 1000), // 每日生图额度，admin 不受限
		field.Int("credits").Default(0),                           // 积分余额（V2 credits）
		// 空数组表示可见全部启用类目；非空时仅展示列出的类目。
		field.JSON("visible_category_ids", []uuid.UUID{}).Optional(),
		field.String("password_salt").Optional(), // scrypt salt hex（bridal 认证）
		field.String("password_hash").Optional(), // scrypt hash hex（bridal 认证）
		field.Time("created_at").Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("identities", UserIdentity.Type),
		edge.To("audits", Audit.Type),
		edge.To("teams", Team.Type).Through("team_members", TeamMember.Type),
		edge.To("groups", TeamGroup.Type).Through("team_group_members", TeamGroupMember.Type),
		edge.To("models", Model.Type),
		edge.To("images", Image.Type),
		edge.To("hosts", Host.Type),
		edge.To("vms", VirtualMachine.Type),
		edge.To("tasks", Task.Type),
		edge.To("task_model_switches", TaskModelSwitch.Type),
		edge.To("git_identities", GitIdentity.Type),
		edge.To("projects", Project.Type),
		edge.To("project_issues", ProjectIssue.Type),
		edge.To("assigned_issues", ProjectIssue.Type),
		edge.To("project_collaborators", ProjectCollaborator.Type),
		edge.To("project_issue_comments", ProjectIssueComment.Type),
		edge.To("git_bots", GitBot.Type).Through("git_bot_users", GitBotUser.Type),
		edge.To("mcp_upstreams", MCPUpstream.Type),
	}
}
