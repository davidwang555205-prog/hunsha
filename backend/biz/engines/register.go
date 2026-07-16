package engines

import (
	"context"

	"github.com/samber/do"
)

// ProvideEngines 注册内容引擎业务依赖（Repo + Usecase + Handler）。
func ProvideEngines(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
}

// InvokeEngines 实例化 Handler（注册路由）+ seed 默认婚纱引擎。
func InvokeEngines(i *do.Injector) {
	do.MustInvoke[*Handler](i)
	uc := do.MustInvoke[*Usecase](i)
	_ = uc.SeedDefault(context.Background())
}
