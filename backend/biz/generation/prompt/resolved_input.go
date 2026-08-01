package prompt

// 本文件定义 ResolvedPromptInput 编译边界（§3.2/§11.4 P0-04 Gate）。
//
// Usecase 在完成授权、查库、runtime/schema 校验后构建 ResolvedPromptInput，再交给纯函数 Compile。
// Compile 只消费 resolved 结果 + assets，不接收 repo/DB/context/raw 三对象（ProductSpec/ModelSelection/BrandVisualPick）。
//
// P0 过渡：ResolvedModel/Product/BrandVisual 语义段为空（P1/P2/P3 填充）；Base 含 legacy Params 字段，
// Compile 内部经 toLegacyParams 还原为 Params 调既有 20 段拼装 helper，保证婚纱 golden 逐字节不变。
// P1 起 helper 逐步改读 resolved 段，toLegacyParams 届时移除。

// ResolvedPromptBase 旧 Params 的 legacy 字段（§11.4 P0-04）。
// 不得包含 raw ProductSpec/ModelSelection/BrandVisualPick；三对象在 resolver 中解析为下方语义段。
type ResolvedPromptBase struct {
	ProductCategory        string
	BridalStyle            string
	DressStyle             string
	ShoeStyle              string
	GarmentStyle           string
	CustomProductName      string
	ImageType              string
	ModelChoice            string
	Season                 string
	ScenePreference        string
	LightPreference        string
	ExtraRequirement       string
	GenerationNonce        int
	BridalKeywordProfileID string
	GeneratedImageName     string
	SceneLocked            bool
}

// ResolvedModel 解析后的模特语义（§3.2/§11.4 P0-04）。
// P0 仅 LegacyModelChoice 有值；HasPerson/PromptLine/NegativePhrases/IdentityRefAssetID/IdentityLock 在 P1 填充。
type ResolvedModel struct {
	LegacyModelChoice  string
	HasPerson          *bool
	PromptLine         string
	NegativePhrases    []string
	IdentityRefAssetID string // P1 前必须为空
	IdentityLock       string  // P1 前必须为空
}

// ResolvedProductSpec 解析后的产品语义（§3.2/§11.4 P0-04）。
// P0 全部为空；ProductLine/ReferenceRules/AccuracyGuards/Negatives 在 P2 编译。
// P2-05：ReferenceScope 由已校验 garment role 推导（complete_look/single_item/uncertain）；
//        PairingLine 为 single_item 按稳定 seed 选择的搭配 + series lock 指令（complete_look/uncertain 为空）。
type ResolvedProductSpec struct {
	ProductTypeKey string
	ProductLine    string
	ReferenceScope string // P2-05: complete_look | single_item | uncertain
	PairingLine    string // P2-05: single_item 稳定 seed 搭配 + series lock 指令
	ReferenceRules []string
	AccuracyGuards []string
	Negatives      []string
}

// ResolvedBrandVisual 解析后的品牌视觉语义（§3.2/§11.4 P0-04）。
// P0 全部为空；MoodLine/ToneLine/StudioSetLine/Negatives 在 P3 填充。
type ResolvedBrandVisual struct {
	BackgroundID  string
	PropID        string
	MoodLine      string
	ToneLine      string
	StudioSetLine string
	Negatives     []string
}

// ResolvedPromptInput Compile 的唯一生产输入（§11.4 P0-04）。
type ResolvedPromptInput struct {
	Base        ResolvedPromptBase
	Model       ResolvedModel
	Product     ResolvedProductSpec
	BrandVisual ResolvedBrandVisual
}

// ResolvePromptInput 把旧 Params 映射为 ResolvedPromptInput（legacy resolver，§11.4 P0-04）。
// 未选择 modelSelection/productSpec/brandVisualPick 时，三对象语义段为空，仅 legacy 字段透传到 Base；
// Model.LegacyModelChoice 保留旧 ModelChoice，确保婚纱 golden 逐字节不变。
// P1/P2/P3 的 resolver 在此扩展，分别填充 Model/Product/BrandVisual 语义段。
func ResolvePromptInput(p Params) ResolvedPromptInput {
	return ResolvedPromptInput{
		Base: ResolvedPromptBase{
			ProductCategory:        p.ProductCategory,
			BridalStyle:            p.BridalStyle,
			DressStyle:             p.DressStyle,
			ShoeStyle:              p.ShoeStyle,
			GarmentStyle:           p.GarmentStyle,
			CustomProductName:      p.CustomProductName,
			ImageType:              p.ImageType,
			ModelChoice:            p.ModelChoice,
			Season:                 p.Season,
			ScenePreference:        p.ScenePreference,
			LightPreference:        p.LightPreference,
			ExtraRequirement:       p.ExtraRequirement,
			GenerationNonce:        p.GenerationNonce,
			BridalKeywordProfileID: p.BridalKeywordProfileID,
			GeneratedImageName:     p.GeneratedImageName,
			SceneLocked:            p.SceneLocked,
		},
		Model: ResolvedModel{LegacyModelChoice: p.ModelChoice},
	}
}

// toLegacyParams 把 ResolvedPromptBase 还原为 legacy Params（三对象 nil），供 Compile 内部调既有 helper。
// P0 过渡专用：Compile 签名已切到 ResolvedPromptInput，但 20 段拼装 helper 仍读 Params；
// 此方法只在 Compile 内部使用，不导出，确保生产调用点不传 raw Params。P1 起 helper 改读 resolved 段后移除。
func (b ResolvedPromptBase) toLegacyParams() Params {
	return Params{
		ProductCategory:        b.ProductCategory,
		BridalStyle:            b.BridalStyle,
		DressStyle:             b.DressStyle,
		ShoeStyle:              b.ShoeStyle,
		GarmentStyle:           b.GarmentStyle,
		CustomProductName:      b.CustomProductName,
		ImageType:              b.ImageType,
		ModelChoice:            b.ModelChoice,
		Season:                 b.Season,
		ScenePreference:        b.ScenePreference,
		LightPreference:        b.LightPreference,
		ExtraRequirement:       b.ExtraRequirement,
		GenerationNonce:        b.GenerationNonce,
		BridalKeywordProfileID: b.BridalKeywordProfileID,
		GeneratedImageName:     b.GeneratedImageName,
		SceneLocked:            b.SceneLocked,
	}
}
