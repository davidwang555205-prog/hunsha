package seeding

// 文案引擎类型定义（1:1 对应 TS src/utils/generateFashionSeedingContent.ts :81-164
// + src/data/xiaohongshuBridalContentProfiles.ts :20-53）。
// JSON tag 对应 assets.json 字段名（TS 导出），go:embed 加载。

// CopyVariationBank 变体银行（TS :99-110）
type CopyVariationBank struct {
	Audiences []string `json:"audiences"`
	Focuses   []string `json:"focuses"`
	Concerns  []string `json:"concerns"`
	Proofs    []string `json:"proofs"`
	Scenes    []string `json:"scenes"`
	Materials []string `json:"materials"`
	Services  []string `json:"services"`
	Takeaways []string `json:"takeaways"`
	Tones     []string `json:"tones"`
	TagExtras []string `json:"tagExtras"`
}

// TopicCopyKit 主题文案套件（TS :81-89）
type TopicCopyKit struct {
	Titles       []string `json:"titles"`
	Openings     []string `json:"openings"`
	Observations []string `json:"observations"`
	Scenes       []string `json:"scenes"`
	Closings     []string `json:"closings"`
	Tags         []string `json:"tags"`
	Note         string   `json:"note"`
}

// VisualRecipe 视觉配方（TS :112-116）
type VisualRecipe struct {
	Camera   string
	Evidence string
	Detail   string
}

// VisualRecipes 视觉配方集合（TS bridalVisualRecipes/dressVisualRecipes :2009-2086）
type VisualRecipes struct {
	Cameras  []string `json:"cameras"`
	Evidence []string `json:"evidence"`
	Details  []string `json:"details"`
}

// CopyAlignmentContext 文案对齐上下文（TS :137-149）
type CopyAlignmentContext struct {
	Topic        string
	Audience     string
	Focus        string
	Concern      string
	Proof        string
	Scene        string
	Material     string
	Service      string
	Takeaway     string
	Tone         string
	VisualRecipe VisualRecipe
}

// NarrativeTemplateContext 叙事模板上下文（TS :151-160）
type NarrativeTemplateContext struct {
	CopyAlignmentContext
	AudienceCue string
	FocusCue    string
	ConcernCue  string
	ProofCue    string
	SceneCue    string
	MaterialCue string
	ServiceCue  string
	TakeawayCue string
}

// NarrativeTemplate 叙事模板函数（TS :162）
type NarrativeTemplate func(ctx NarrativeTemplateContext) string

// XhsCopyDraft 小红书文案草稿（src/data :30-35）。Tags/Note 可选，nil=未设。
type XhsCopyDraft struct {
	Titles     []string `json:"titles"`
	Paragraphs []string `json:"paragraphs"`
	Tags       []string `json:"tags"`
	Note       string   `json:"note"`
}

// XhsImageBlueprint 小红书配图蓝图（src/data :37-45）
type XhsImageBlueprint struct {
	Name             string `json:"name"`
	Purpose          string `json:"purpose"`
	Description      string `json:"description"`
	ImageType        string `json:"imageType"`
	ScenePreference  string `json:"scenePreference"`
	KeywordProfileID string `json:"keywordProfileId"`
	ExtraRequirement string `json:"extraRequirement"`
	// Action macro 蓝图的动作元数据（可选）：macroActionDiversity 策略的抽样依据，
	// 普通蓝图省略。线上 macro JSON 契约见 2026-09 婚纱四主题 MACRO-* 蓝图。
	Action *BlueprintAction `json:"action,omitempty"`
}

// BlueprintAction macro 蓝图动作元数据（线上 macro JSON "action" 字段契约，字段均可选）。
// 四维度 movement / orientation / armSilhouette / garmentSilhouette 是动作差异度量依据；
// standing=false 或非站姿的蓝图不进入 macroActionDiversity 候选池。
type BlueprintAction struct {
	Family            string `json:"family,omitempty"`
	Movement          string `json:"movement,omitempty"`
	Standing          bool   `json:"standing,omitempty"`
	PhoneSafe         bool   `json:"phoneSafe,omitempty"`
	ProofSafe         bool   `json:"proofSafe,omitempty"`
	Orientation       string `json:"orientation,omitempty"`
	ArmSilhouette     string `json:"armSilhouette,omitempty"`
	GarmentSilhouette string `json:"garmentSilhouette,omitempty"`
}

// XhsContentProfile 小红书内容档案（src/data :47-53）
type XhsContentProfile struct {
	Topic           string              `json:"topic"`
	Intent          string              `json:"intent"`
	SourcePattern   string              `json:"sourcePattern"`
	CopyKit         TopicCopyKit        `json:"copyKit"`
	ImageBlueprints []XhsImageBlueprint `json:"imageBlueprints"`
}

// BlueprintSelectionRule 由内容 JSON 声明，平台按通用策略选择图组蓝图。
// 未配置时保持固定顺序，避免业务类目缺省时被婚纱规则污染。
type BlueprintSelectionRule struct {
	Strategy           string `json:"strategy"`
	RequiredNamePrefix string `json:"requiredNamePrefix"`
	// AllowedActionFamilies macroActionDiversity 候选动作族白名单（默认空 = 不限制）。
	// 非空时仅 family 命中白名单且带 action 元数据的蓝图进入候选池。
	AllowedActionFamilies []string `json:"allowedActionFamilies,omitempty"`
	// BackReferenceSafe 对齐 mjs v3.11.0 selector 的 options.backReferenceSafe（默认 false）：
	// false 时三图第三张注入 SIDE SAFE 角色文本（禁止虚构未验证背部结构）；
	// true 时注入 VERIFIED BACK-SAFE（允许基于可信参考展示经验证的侧后/背部结构）。
	// 平台当前不自行分析参考图，业务 JSON 不显式配置时保持 false。
	BackReferenceSafe bool `json:"backReferenceSafe,omitempty"`
}

// TopicCopyDraft 主题文案草稿输出（TS :91-97）
type TopicCopyDraft struct {
	Titles        []string
	Body          string
	Tags          []string
	Note          string
	PromptContext CopyAlignmentContext
}

// PromptParams 提示词参数（1:1 对应 src/types.ts :81-96）。JSON tag 驼峰对齐前端契约。
type PromptParams struct {
	ProductCategory        string `json:"productCategory"`
	BridalStyle            string `json:"bridalStyle"`
	DressStyle             string `json:"dressStyle"`
	CustomProductName      string `json:"customProductName"`
	ImageType              string `json:"imageType"`
	ModelChoice            string `json:"modelChoice"`
	Season                 string `json:"season"`
	ScenePreference        string `json:"scenePreference"`
	LightPreference        string `json:"lightPreference"`
	ExtraRequirement       string `json:"extraRequirement"`
	GenerationNonce        int    `json:"generationNonce"`
	BridalKeywordProfileID string `json:"bridalKeywordProfileId"`
	GeneratedImageName     string `json:"generatedImageName"`
}

// ImageDraft 配图草稿（TS :71-79）
type ImageDraft struct {
	Name                   string
	Purpose                string
	Description            string
	ImageType              string
	ScenePreference        string
	ExtraRequirement       string
	BridalKeywordProfileID string
}

// FashionSeedingImagePlan 配图方案（TS :40-45）。JSON tag 对齐前端契约。
type FashionSeedingImagePlan struct {
	Name        string       `json:"name"`
	Purpose     string       `json:"purpose"`
	Description string       `json:"description"`
	Params      PromptParams `json:"params"`
}

// FashionSeedingContent 内容生成结果（TS :47-59）。JSON tag 对齐前端契约。
type FashionSeedingContent struct {
	Topic        string                    `json:"topic"`
	DateKey      string                    `json:"dateKey"`
	DailySlot    int                       `json:"dailySlot"`
	VariantIndex int                       `json:"variantIndex"`
	VariantCount int                       `json:"variantCount"`
	VariantLabel string                    `json:"variantLabel"`
	Titles       []string                  `json:"titles"`
	Body         string                    `json:"body"`
	Images       []FashionSeedingImagePlan `json:"images"`
	Tags         []string                  `json:"tags"`
	Note         string                    `json:"note"`
}

// Assets 素材集合，对应 assets.json（TS 导出）。配置化阶段从 DB 覆盖。
type Assets struct {
	BridalVariationBank           CopyVariationBank            `json:"bridalVariationBank"`
	DressVariationBank            CopyVariationBank            `json:"dressVariationBank"`
	XiaohongshuTopicOverrides     map[string]CopyVariationBank `json:"xiaohongshuTopicOverrides"`
	TopicCopyKits                 map[string]TopicCopyKit      `json:"topicCopyKits"`
	XiaohongshuBridalCopyDrafts   map[string][]XhsCopyDraft    `json:"xiaohongshuBridalCopyDrafts"`
	TitleStarters                 []string                     `json:"titleStarters"`
	TitleAngles                   []string                     `json:"titleAngles"`
	TitleClosers                  []string                     `json:"titleClosers"`
	BridalVisualRecipes           VisualRecipes                `json:"bridalVisualRecipes"`
	DressVisualRecipes            VisualRecipes                `json:"dressVisualRecipes"`
	EnglishVisualAlignmentByTopic map[string]string            `json:"englishVisualAlignmentByTopic"`
	PersonImageTypes              []string                     `json:"personImageTypes"`
	BridalMainSceneByTopic        map[string]string            `json:"bridalMainSceneByTopic"`
	DressMainSceneByTopic         map[string]string            `json:"dressMainSceneByTopic"`
	// BridalTopics / DressTopics 是内容引擎的主题单一事实源；数组顺序即工作台展示顺序。
	BridalTopics []string `json:"bridalTopics"`
	DressTopics  []string `json:"dressTopics"`
	// Visible*Topics 仅兼容已保存的旧白名单配置，新配置请使用对应的 *Topics 字段。
	VisibleBridalTopics              []string                          `json:"visibleBridalTopics"`
	VisibleDressTopics               []string                          `json:"visibleDressTopics"`
	XiaohongshuBridalContentProfiles map[string]XhsContentProfile      `json:"xiaohongshuBridalContentProfiles"`
	BlueprintSelection               map[string]BlueprintSelectionRule `json:"blueprintSelection"`
	BridalScenesByImageType          map[string][]string               `json:"bridalScenesByImageType"`
	DressScenesByImageType           map[string][]string               `json:"dressScenesByImageType"`
}
