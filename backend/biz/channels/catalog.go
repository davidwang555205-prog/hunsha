package channels

// ModelSpec 模型清单条目：前端「模型线路」下拉的模型元数据（展示名 + 默认 protocol 联动）。
// 仅元数据，不含 base_url/api_key——线路实例由 admin 填表创建存 DB（catalog ≠ channel）。
type ModelSpec struct {
	ID              string `json:"id"`              // model_id 值
	Name            string `json:"name"`            // 展示名
	DefaultProtocol string `json:"defaultProtocol"` // 配该模型时的默认 protocol
	Description     string `json:"description"`     // 简述
}

// ModelCatalog 后端硬编码的模型清单（前端「模型线路」下拉数据源）。新增模型只需在此注册 +
// wala/client.go 对应 protocol 分支 + prompt/adapter.go SelectAdapter 注册。后端不 seed 线路、不存 config。
var ModelCatalog = []ModelSpec{
	{
		ID:              "gpt-image-2",
		Name:            "Image2 (GPT Image-2)",
		DefaultProtocol: "openai",
		Description:     "OpenAI Images API 兼容（官方 / WalaAPI），主线路默认。",
	},
	{
		ID:              "gemini-2.5-flash-image-preview",
		Name:            "Banana (Nano Banana / Gemini)",
		DefaultProtocol: "gemini",
		Description:     "Google Gemini generateContent 官方协议（x-goog-api-key 鉴权）。",
	},
	{
		ID:              "doubao-seedream-4-0-250828",
		Name:            "Seedream 4.0 (豆包)",
		DefaultProtocol: "seedream",
		Description:     "字节方舟 ark /images/generations 官方协议（OpenAI 兼容）。",
	},
	{
		ID:              "doubao-seedream-5-0-pro-260628",
		Name:            "Seedream 5.0 Pro (豆包)",
		DefaultProtocol: "seedream",
		Description:     "字节方舟豆包 5.0 Pro（response_format=url/size 档位/watermark=true，callSeedream5 适配）。",
	},
}
