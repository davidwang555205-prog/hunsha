package syssetting

import (
	"github.com/samber/do"
)

// ProvideSysSetting 注册系统设置业务依赖（Repo + Usecase + Handler）。
// 注：原 bridalauth.SettingProvider 桥接随 bridalauth 移除，retention_days 由 migration seed，
// 需要后台读取的场景直接调用 syssetting.Usecase。
func ProvideSysSetting(i *do.Injector) {
	do.Provide(i, NewRepo)
	do.Provide(i, NewUsecase)
	do.Provide(i, NewHandler)
}

// InvokeSysSetting 实例化 Handler（注册路由）。默认 retention_days 由 migration seed。
func InvokeSysSetting(i *do.Injector) {
	do.MustInvoke[*Handler](i)
}
