package types

// ModelInvocationReference 是一次真实模型请求携带的参考图快照。
// 只保存可展示的对象 URL 和内容指纹，绝不保存图片 Base64 原文。
type ModelInvocationReference struct {
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	MimeType string `json:"mimeType"`
	URL      string `json:"url"`
	SHA256   string `json:"sha256"`
	Size     int64  `json:"size"`
}
