package member

import "github.com/samber/do"

// ProvideMemberManager 注册 bridal MemberManager（domain.MemberManager 真实实现）。
func ProvideMemberManager(i *do.Injector) {
	do.Provide(i, NewManager)
}
