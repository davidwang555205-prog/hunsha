package prompt

// CanonicalPrompt 是 GeneratePrompt 的结构化中间产物（IR），各 ModelAdapter 据此渲染成模型方言。
// IR 只描述"要什么"（各语义段文本 + 负面约束 + 元信息），不含任何模型方言。
// Compile 产出后自包含：异步阶段只需 IR + 线路 ModelID 即可 Render，无需重新加载 Params/Assets。
type CanonicalPrompt struct {
	// 正向语义段（按现有 GeneratePrompt 的 cleanJoin 顺序）
	Category              string
	Style                 string
	ImageType             string
	ProductPresence       string
	Product               string // P2-03 产品语义段（受控英文：promptLabel + value，按 promptOrder；legacy 为空）
	Reference             string
	Model                 string
	Scene                 string
	SceneLock             string
	Season                string
	Light                 string
	Keyword               string
	PhoneMirror           string
	SeriesPhoneContinuity string
	PhoneShot             string
	SeriesContinuity      string
	BrandDirection        string
	BrandVisual           string // P3-02 品牌视觉段（mood/tone/studio set；scene lock 时省略 studio set）
	Composition           string
	CameraFeel            string
	// Extra 已含 "Additional visual requirement: " 前缀（与 GeneratePrompt 原逻辑一致），空则无。
	Extra string
	// Negatives 负面约束条目（不含 "Negative constraints: " 前缀，adapter 决定如何消化）。
	Negatives []string
	// Meta 元信息，adapter 据此做能力决策（如 aspect ratio、是否人物图）。
	Meta PromptMeta
}

// PromptMeta IR 元信息。
type PromptMeta struct {
	SceneLocked          bool
	HasPerson            bool
	IsPhoneMirror        bool
	SeriesIndex          int
	SeriesTotal          int
	LeadPersonIndex      int
	LeadPhoneIndex       int
	NonProductAtmosphere bool   // 产品图仅作色彩/材质依据，不得把产品或人物作为主体
	AspectRatio          string // "3:4" 等，来自生图请求 Size，adapter 据此给模型比例提示
	KeywordProfileID     string
}
