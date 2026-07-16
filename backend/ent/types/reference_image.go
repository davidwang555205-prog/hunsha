package types

// ReferenceImage 参考图（存 generation_tasks.reference_images jsonb）。
// Go 存 MinIO 代理 URL（{url,name,kind}），保留 Go 现有 MinIO 存储逻辑；
// 与 Node 原始 FileInput（{name,type,size,dataUrl}）结构不同（按用户决策保留 Go 设计）。
// Kind 区分场景图/产品图：scene=场景参考图, product=婚纱产品图, 空=旧记录兼容（前端兜底当产品图）。
type ReferenceImage struct {
	URL  string `json:"url"`
	Name string `json:"name"`
	Kind string `json:"kind,omitempty"`
}

// TaskFeedback 小红书发布反馈（存 generation_tasks.feedback jsonb）。
// 用户发布笔记后回填：笔记链接 + 5 个核心数值指标（阅读/点赞/收藏/评论/转发，互动率前端算，不单独存）。
// SubmittedAt 为空表示未反馈。
type TaskFeedback struct {
	NoteURL     string `json:"noteUrl"`
	Views       int    `json:"views"`
	Likes       int    `json:"likes"`
	Collects    int    `json:"collects"`
	Comments    int    `json:"comments"`
	Shares      int    `json:"shares"`                // 转发数
	SubmittedAt string `json:"submittedAt,omitempty"` // ISO 时间，空=未反馈
}
