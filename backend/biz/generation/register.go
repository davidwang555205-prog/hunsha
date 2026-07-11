package generation

import (
	"github.com/samber/do"

	"bridal/backend/biz/bridalauth"
	"bridal/backend/biz/generation/imagestore"
)

// ProvideGeneration 注册生图业务依赖（Repo + Store + Usecase + Handler + 历史统计适配器）。
func ProvideGeneration(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, imagestore.NewStore)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
	// 历史统计适配器：实现 bridalauth.HistoryStats，供 bridalauth.Usecase 可选注入。
	do.Provide(i, func(i *do.Injector) (bridalauth.HistoryStats, error) {
		return NewStatsAdapter(do.MustInvoke[*Repo](i)), nil
	})
}

// InvokeGeneration 实例化 Handler（注册路由）。
func InvokeGeneration(i *do.Injector) {
	do.MustInvoke[*Handler](i)
}
