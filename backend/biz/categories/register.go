package categories

import (
	"context"

	"github.com/samber/do"
)

// ProvideCategories 注册内容类目业务依赖（Repo + Usecase + Handler）。
func ProvideCategories(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
}

// InvokeCategories 实例化 Handler（注册路由）+ 启动 seed 默认婚纱类目。
func InvokeCategories(i *do.Injector) {
	do.MustInvoke[*Handler](i)
	uc := do.MustInvoke[*Usecase](i)
	_ = uc.SeedDefault(context.Background())
}
