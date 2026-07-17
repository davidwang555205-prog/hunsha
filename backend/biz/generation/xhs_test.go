package generation

import "testing"

func TestNormalizeXHSURL(t *testing.T) {
	valid := []string{
		"https://www.xiaohongshu.com/explore/abc",
		"https://xhslink.com/abc",
	}
	for _, raw := range valid {
		if _, err := normalizeXHSURL(raw); err != nil {
			t.Fatalf("expected valid URL %q: %v", raw, err)
		}
	}
	for _, raw := range []string{"http://www.xiaohongshu.com/explore/abc", "https://example.com/xhs", "not-a-url"} {
		if _, err := normalizeXHSURL(raw); err == nil {
			t.Fatalf("expected invalid URL %q", raw)
		}
	}
}

func TestSimilarSummary(t *testing.T) {
	if got := similarSummary(0, 0); got != "暂未匹配到相似账号。" {
		t.Fatalf("empty summary = %q", got)
	}
	if got := similarSummary(2, 3); got != "已匹配 2 个同阶对标账号和 3 个高阶标杆账号。" {
		t.Fatalf("summary = %q", got)
	}
}
