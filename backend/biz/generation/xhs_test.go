package generation

import "testing"

func TestNormalizeXHSURL(t *testing.T) {
	valid := []struct {
		raw  string
		want string
	}{
		{"https://www.xiaohongshu.com/explore/abc", "https://www.xiaohongshu.com/explore/abc"},
		{"https://xhslink.com/abc", "https://xhslink.com/abc"},
		{"21 【路边偶遇一家花店 - Aura | 小红书】 😆 4tzTA1pnbriejrZ 😆 https://www.xiaohongshu.com/discovery/item/6a58a62d000000001303c6d0?source=webshare&xsec_token=token；", "https://www.xiaohongshu.com/discovery/item/6a58a62d000000001303c6d0?source=webshare&xsec_token=token"},
		{"如果再来一次，松下 S9 我一定买全黑 http://xhslink.com/o/AcuG6weWEcv\n复制一下，然后打开【小红书】就能看到啦！", "http://xhslink.com/o/AcuG6weWEcv"},
	}
	for _, tt := range valid {
		got, err := normalizeXHSURL(tt.raw)
		if err != nil {
			t.Fatalf("expected valid URL %q: %v", tt.raw, err)
		}
		if got != tt.want {
			t.Errorf("normalizeXHSURL(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
	for _, raw := range []string{"https://example.com/xhs", "not-a-url", "复制一下，然后打开【小红书】就能看到啦！"} {
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
