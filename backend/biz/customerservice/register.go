package customerservice

import (
	"github.com/samber/do"
)

// ProvideCustomerService 注册客服信息业务依赖（Repo + Usecase + Handler）。
func ProvideCustomerService(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
}

// InvokeCustomerService 实例化 Handler（注册路由）。
func InvokeCustomerService(i *do.Injector) {
	do.MustInvoke[*Handler](i)
}
