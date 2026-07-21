package biz

import (
	"github.com/samber/do"

	"bridal/backend/biz/agentresource"
	"bridal/backend/biz/categories"
	"bridal/backend/biz/channels"
	"bridal/backend/biz/credits"
	"bridal/backend/biz/customerservice"
	"bridal/backend/biz/engines"
	"bridal/backend/biz/generation"
	"bridal/backend/biz/llmproxy"
	"bridal/backend/biz/member"
	"bridal/backend/biz/notify"
	"bridal/backend/biz/public"
	"bridal/backend/biz/server"
	"bridal/backend/biz/setting"
	"bridal/backend/biz/static"
	"bridal/backend/biz/subscription"
	"bridal/backend/biz/syssetting"
	"bridal/backend/biz/team"
	"bridal/backend/biz/uploader"
	"bridal/backend/biz/user"
)

// RegisterBridal 注册 bridal 后端需要的 biz 模块（fork 自 MonkeyCode，裁剪编码任务相关）。
// 保留：user/public/team/setting/subscription/uploader/llmproxy/notify/server/static/agentresource
//       + bridal 专属 generation（生图）
// 剥离：host/vmidle/git/project/task/skill/plugin/mcphub/file（编码任务执行链路，M6 已物理删除）
//
// 注：agentresource 虽属"资源解析"栈，但 biz/team 依赖其 ObjectStore（团队 skill 上传），
// 且其 infra 依赖极轻（仅 db/oss/config），故保留。
// 认证统一走 MonkeyCode team 模块（cookie session），初始账号由 team.initTeam 异步建
// （读 config.InitTeam.Email/Password，env MCAI_INIT_TEAM_EMAIL/MCAI_INIT_TEAM_PASSWORD）。
func RegisterBridal(i *do.Injector) error {
	// team 模块的 TeamGroupUserHandler/OIDC usecase 硬依赖 domain.MemberManager。
	// bridal 单租户，用 member.Manager 真实实现：管理员经 /api/v1/teams/users 增删成员。
	member.ProvideMemberManager(i)

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

	// 系统设置（retention_days 等后台可配项）。
	syssetting.ProvideSysSetting(i)

	// bridal 生图核心（prompt + WalaAPI + 图组连续性 + MinIO 存储 + history）。
	generation.ProvideGeneration(i)

	// bridal 积分系统（credit_transactions + users.credits，右上角积分弹窗数据源）。
	credits.ProvideCredits(i)

	// bridal 模型线路 / 内容类目 / 内容引擎（管理后台配置，生图按 channel 调用，工具首页按类目展示）。
	channels.ProvideChannels(i)
	categories.ProvideCategories(i)
	customerservice.ProvideCustomerService(i)
	engines.ProvideEngines(i)
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

	// 系统设置路由挂载。
	syssetting.InvokeSysSetting(i)

	// bridal 生图核心实例化（含启动崩溃恢复：未完成任务标 failed）。
	generation.InvokeGeneration(i)

	// 积分模块路由挂载。
	credits.InvokeCredits(i)

	// 模型线路 / 类目 / 内容引擎模块路由挂载 + seed 默认数据。
	channels.InvokeChannels(i)
	categories.InvokeCategories(i)
	customerservice.InvokeCustomerService(i)
	engines.InvokeEngines(i)
}
