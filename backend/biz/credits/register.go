package credits

import "github.com/samber/do"

// ProvideCredits 注册积分业务依赖（Repo + Usecase + Handler）。
func ProvideCredits(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
}

// InvokeCredits 实例化 Handler（注册路由）。
func InvokeCredits(i *do.Injector) {
	do.MustInvoke[*Handler](i)
}
