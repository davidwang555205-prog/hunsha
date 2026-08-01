package prompt

// PersonImageTypes 含人物的图片类型（与 Node personImageTypes 一致）。
// 作为 generation 包判断"是否人物图"的单一事实源之一：产品上身图/对镜穿搭图/生活场景图。
// 抽取自 dev-dao prompt/validation.go（bridal-dev 不搬 validation 链路，仅取此纯数据）。
var PersonImageTypes = map[string]bool{
	"产品上身图": true,
	"对镜穿搭图": true,
	"生活场景图": true,
}
