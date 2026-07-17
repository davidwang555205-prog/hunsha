package types

// XHSSimilarAccount 是红狐相似账号接口返回的一条对标账号快照。
// 只存用于历史展示和趋势复盘的字段，不保存上游原始响应。
type XHSSimilarAccount struct {
	Rank                   int    `json:"rank"`
	Tier                   string `json:"tier"` // same_level | high_level
	AccountID              string `json:"accountId"`
	Nickname               string `json:"nickname"`
	Avatar                 string `json:"avatar"`
	URL                    string `json:"url"`
	Fans                   int    `json:"fans"`
	Level                  string `json:"level"`
	Collected              int    `json:"collected"`
	Liked                  int    `json:"liked"`
	TotalWork              int    `json:"totalWork"`
	NoteCountSeven         int    `json:"noteCountSeven"`
	InteractiveCountSeven  int    `json:"interactiveCountSeven"`
	InteractiveCountThirty int    `json:"interactiveCountThirty"`
}
