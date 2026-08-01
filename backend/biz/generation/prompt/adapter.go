package prompt

import "strings"

// ModelAdapter 把 CanonicalPrompt IR 渲染成特定模型的请求描述。
// 各模型方言（prompt 风格、negative 处理、size 提示）差异在此收敛，参考图格式由 protocol 层处理。
type ModelAdapter interface {
	Name() string
	Render(ir *CanonicalPrompt) *ModelRequest
}

// ModelRequest adapter 渲染产物，供 protocol 层组装 API 请求。
type ModelRequest struct {
	Prompt   string         // 渲染后的主提示词（含 negative 处理）
	SizeHint string         // 比例 "3:4" 等，protocol 层各自换算
	Extra    map[string]any // 预留（本次三模型均空，YAGNI 不预先填）
}

// Image2Adapter 回归基准，复刻现有 GeneratePrompt 的 cleanJoin 20 段拼装。
// 验收：Image2Adapter.Render(Compile(...)) 逐字节 == 现有 GeneratePrompt(...) 输出（golden 7 样本不变）。
type Image2Adapter struct{}

func (a *Image2Adapter) Name() string { return "image2" }

// Render 复刻原 GeneratePrompt 的 lines 拼装：18 正向段 + 无条件 negative 段 + 条件 extra 段，
// cleanJoin 过滤空串。negative 段无条件生成与原逻辑一致（negativeRules 默认 14 条保证非空）。
func (a *Image2Adapter) Render(ir *CanonicalPrompt) *ModelRequest {
	lines := []string{
		ir.Category, ir.Style, ir.ImageType, ir.ProductPresence, ir.Product, ir.Reference,
		ir.Model, ir.Scene, ir.SceneLock, ir.Season, ir.Light, ir.Keyword,
		ir.PhoneMirror, ir.SeriesPhoneContinuity, ir.PhoneShot, ir.SeriesContinuity,
		ir.BrandDirection, ir.BrandVisual, ir.Composition, ir.CameraFeel,
	}
	lines = append(lines, "Negative constraints: "+strings.Join(ir.Negatives, " "))
	if ir.Extra != "" {
		lines = append(lines, ir.Extra)
	}
	return &ModelRequest{Prompt: cleanJoin(lines), SizeHint: ir.Meta.AspectRatio}
}

// BananaAdapter 第一阶段复用 Image2 渲染逻辑（banana OR 路现状即如此，negative 拼进 prompt 已验证可行）。
// 后续可在此做 negative 正向化优化（guide 4.1），本次不改。
type BananaAdapter struct{}

func (a *BananaAdapter) Name() string { return "banana" }

func (a *BananaAdapter) Render(ir *CanonicalPrompt) *ModelRequest {
	// 第一阶段：与 Image2Adapter 完全一致。
	return (&Image2Adapter{}).Render(ir)
}

// SeedreamAdapter Seedream 偏好结构化分节（仍自然语言，不强制 JSON），negative 拼进 prompt（无独立字段）。
// Reference/SeriesContinuity 提权前置（guide 4.3 命脉：Seedream 对开头 token 权重高）。
type SeedreamAdapter struct{}

func (a *SeedreamAdapter) Name() string { return "seedream" }

func (a *SeedreamAdapter) Render(ir *CanonicalPrompt) *ModelRequest {
	var b strings.Builder
	// 提权：参考图细节 + 系列连续性前置
	if ir.Reference != "" {
		b.WriteString(ir.Reference + "\n")
	}
	if ir.SeriesContinuity != "" {
		b.WriteString(ir.SeriesContinuity + "\n")
	}
	b.WriteString(ir.Category + "\n")
	b.WriteString(ir.Style + "\n")
	b.WriteString(ir.ImageType + "\n")
	b.WriteString(ir.ProductPresence + "\n")
	if ir.Product != "" {
		b.WriteString(ir.Product + "\n")
	}
	if ir.Scene != "" {
		b.WriteString(ir.Scene + "\n")
	}
	if ir.SceneLock != "" {
		b.WriteString(ir.SceneLock + "\n")
	}
	b.WriteString(ir.Season + "\n")
	b.WriteString(ir.Light + "\n")
	b.WriteString(ir.Model + "\n")
	if ir.Keyword != "" {
		b.WriteString(ir.Keyword + "\n")
	}
	if ir.PhoneMirror != "" {
		b.WriteString(ir.PhoneMirror + "\n")
	}
	if ir.SeriesPhoneContinuity != "" {
		b.WriteString(ir.SeriesPhoneContinuity + "\n")
	}
	if ir.PhoneShot != "" {
		b.WriteString(ir.PhoneShot + "\n")
	}
	b.WriteString(ir.BrandDirection + "\n")
	if ir.BrandVisual != "" {
		b.WriteString(ir.BrandVisual + "\n")
	}
	b.WriteString(ir.Composition + "\n")
	b.WriteString(ir.CameraFeel + "\n")
	b.WriteString("Negative constraints: " + strings.Join(ir.Negatives, " ") + "\n")
	if ir.Extra != "" {
		b.WriteString(ir.Extra + "\n")
	}
	// 去掉末尾多余换行，与 cleanJoin 风格一致（\n 分隔，无尾换行）
	return &ModelRequest{Prompt: strings.TrimRight(b.String(), "\n"), SizeHint: ir.Meta.AspectRatio}
}

// SelectAdapter 按线路 model_id 选 adapter。未命中回退 Image2Adapter（兜底，保证不崩，行为退化现状）。
func SelectAdapter(modelID string) ModelAdapter {
	switch {
	case strings.HasPrefix(modelID, "gemini-2.5-flash-image"):
		return &BananaAdapter{}
	case strings.HasPrefix(modelID, "doubao-seedream"):
		return &SeedreamAdapter{}
	default:
		return &Image2Adapter{}
	}
}

// defaultAdapter 兜底（未命中 model_id 时），等价 Image2Adapter。
var defaultAdapter ModelAdapter = &Image2Adapter{}
