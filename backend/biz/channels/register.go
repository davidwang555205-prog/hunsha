package channels

import (
	"context"

	"github.com/samber/do"
)

// ProvideChannels 注册模型线路业务依赖（Repo + Usecase + Handler）。
func ProvideChannels(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
}

// InvokeChannels 实例化 Handler（注册路由）+ 启动 seed 默认线路。
func InvokeChannels(i *do.Injector) {
	do.MustInvoke[*Handler](i)
	uc := do.MustInvoke[*Usecase](i)
	_ = uc.SeedDefault(context.Background())
}
