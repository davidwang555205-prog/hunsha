package prompt

import (
	_ "embed"
	"encoding/json"
	"testing"
)

//go:embed testdata/golden_prompts.json
var goldenData []byte

// goldenCase 单个 golden 用例（与 Node 生成脚本输出结构一致）。
type goldenCase struct {
	ID     string        `json:"id"`
	Params Params        `json:"params"`
	Ctx    SeriesContext `json:"ctx"`
	Prompt string        `json:"prompt"`
}

// TestGeneratePromptGolden 与 Node generatePrompt 输出逐字节比对，确保 1:1 迁移。
// golden_prompts.json 由 server/prompt.mjs 的 generatePrompt 生成，覆盖：
//   - 单图基础 / 多图系列 / 手机自拍系列（lead + 后续帧）/ 裙装材质 / 生活场景多图 /
//     自动场景轮转 / 含 CJK 的 extraRequirement 被丢弃
func TestGeneratePromptGolden(t *testing.T) {
	var cases []goldenCase
	if err := json.Unmarshal(goldenData, &cases); err != nil {
		t.Fatalf("unmarshal golden data: %v", err)
	}
	if len(cases) == 0 {
		t.Fatal("golden 用例为空")
	}

	for _, c := range cases {
		t.Run(c.ID, func(t *testing.T) {
			got := GeneratePrompt(c.Params, c.Ctx)
			if got != c.Prompt {
				t.Errorf("GeneratePrompt 与 Node golden 输出不一致\n用例: %s\n期望长度: %d\n实际长度: %d\n---期望---\n%s\n---实际---\n%s",
					c.ID, len(c.Prompt), len(got), c.Prompt, got)
			}
		})
	}
}
