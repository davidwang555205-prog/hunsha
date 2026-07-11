package biz

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/biz/agentresource"
	"bridal/backend/biz/bridalauth"
	"bridal/backend/biz/generation"
	"bridal/backend/biz/llmproxy"
	"bridal/backend/biz/notify"
	"bridal/backend/biz/public"
	"bridal/backend/biz/server"
	"bridal/backend/biz/setting"
	"bridal/backend/biz/static"
	"bridal/backend/biz/subscription"
	"bridal/backend/biz/team"
	"bridal/backend/biz/uploader"
	"bridal/backend/biz/user"
	"bridal/backend/domain"
)

// RegisterBridal 注册 bridal 后端需要的 biz 模块（fork 自 MonkeyCode，裁剪编码任务相关）。
// 保留：user/public/team/setting/subscription/uploader/llmproxy/notify/server/static/agentresource
//       + bridal 专属 bridalauth（认证）/ generation（生图）
// 剥离：host/vmidle/git/project/task/skill/plugin/mcphub/file（编码任务执行链路，M6 已物理删除）
//
// 注：agentresource 虽属"资源解析"栈，但 biz/team 依赖其 ObjectStore（团队 skill 上传），
// 且其 infra 依赖极轻（仅 db/oss/config），故保留。
func RegisterBridal(i *do.Injector) error {
	// team 模块的 TeamGroupUserHandler/OIDC usecase 硬依赖 domain.MemberManager
	// （MonKeyCode 原靠 bridge option 注入，裸 main 无提供者）。bridal 单租户，用 noop 占位
	// 保证启动链构造通过；bridal 账号管理走 bridalauth /api/admin/users，不依赖 MemberManager。
	do.ProvideValue[domain.MemberManager](i, &noopMemberManager{})

	notify.ProvideNotify(i)
	public.ProvidePublic(i)
	user.ProvideUser(i)
	setting.ProvideSetting(i)
	team.ProvideTeam(i)
	agentresource.ProvideAgentResource(i)
	subscription.ProvideSubscription(i)
	uploader.ProvideUploader(i)
	llmproxy.ProvideLLMProxy(i)
	server.ProvideServer(i)
	static.ProviderStatic(i)

	// bridal 专属认证层（HMAC token + scrypt + Bearer，独立于 MonkeyCode cookie session）。
	bridalauth.ProvideBridalAuth(i)
	do.Provide(i, bridalauth.NewHandler)

	// bridal 生图核心（prompt + WalaAPI + 图组连续性 + MinIO 存储 + history）。
	generation.ProvideGeneration(i)
	return nil
}

// InvokeBridal 实例化 bridal 保留模块并挂载路由。
func InvokeBridal(i *do.Injector) {
	notify.InvokeNotify(i)
	public.InvokePublic(i)
	user.InvokeUser(i)
	setting.InvokeSetting(i)
	team.InvokeTeam(i)
	subscription.InvokeSubscription(i)
	uploader.InvokeUploader(i)
	llmproxy.InvokeLLMProxy(i)
	server.InvokeServer(i)
	static.InvokeStatic(i)

	// bridal 认证层先实例化（含账号初始化 + 路由挂载）。
	bridalauth.InvokeBridalAuth(i)

	// bridal 生图核心在认证层之后实例化（依赖 bridalauth.Handler 的鉴权中间件 + Repo）。
	generation.InvokeGeneration(i)
}

// noopMemberManager 是 domain.MemberManager 的占位实现。
// bridal 单租户，团队成员管理（添加成员/管理员、OIDC 自动建号）不启用，
// 所有写操作返回 ErrNotImplemented；构造期注入仅为打通 team 模块启动链。
type noopMemberManager struct{}

var errMemberManagerNotImpl = errors.New("member manager not implemented in bridal")

func (*noopMemberManager) AddUser(context.Context, *domain.TeamUser, *domain.AddTeamUserReq) (*domain.AddTeamUserResp, error) {
	return nil, errMemberManagerNotImpl
}

func (*noopMemberManager) AddUserWithPassword(context.Context, *domain.TeamUser, *domain.AddTeamUserReq) (*domain.AddTeamUserWithPasswordResp, error) {
	return nil, errMemberManagerNotImpl
}

func (*noopMemberManager) AddAdmin(context.Context, *domain.TeamUser, *domain.AddTeamAdminReq) (*domain.AddTeamAdminResp, error) {
	return nil, errMemberManagerNotImpl
}

func (*noopMemberManager) AutoCreateOIDCMember(context.Context, uuid.UUID, *domain.OIDCExternalUser) (*domain.User, error) {
	return nil, errMemberManagerNotImpl
}

var _ domain.MemberManager = (*noopMemberManager)(nil)
