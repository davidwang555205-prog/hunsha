package seeding

import (
	"testing"
)

// buildDisplayImageName 输出用户可见命名 "图N-类型简称"，半角连字符分隔。
// 完全脱钩蓝图 rawName，避免 PMS-族前缀 + F01/S01/U01/V01/E01 等内部代号泄露到前端。
// purpose 不再拼入名字（名字过长是用户痛点），仅在 brief 缺失时降级为裸序号。
func TestBuildDisplayImageName(t *testing.T) {
	cases := []struct {
		name      string
		index     int
		imageType string
		purpose   string
		want      string
	}{
		{"产品上身图→主图", 0, "产品上身图", "用真实顾客视角呈现完整上身状态", "图1-主图"},
		{"对镜穿搭图→对镜", 1, "对镜穿搭图", "补充真实穿搭视角", "图2-对镜"},
		{"生活场景图→生活", 2, "生活场景图", "把裙子放进真实日常或约会场景", "图3-生活"},
		{"材质图→细节", 3, "拍摄花絮 / 材质图", "展示蕾丝、缎面、珠绣、裙摆或头纱细节", "图4-细节"},
		{"氛围图→氛围", 4, "非产品氛围图", "建立婚纱馆或婚礼场景情绪", "图5-氛围"},
		{"静物图→静物", 0, "产品静物图", "展示婚纱静物、衣架、头纱或配件", "图1-静物"},
		{"purpose 为空仍按 brief 输出", 0, "产品上身图", "", "图1-主图"},
		{"purpose 为空格仍按 brief 输出", 1, "对镜穿搭图", "   ", "图2-对镜"},
		{"未识别 imageType 降级为裸序号", 2, "未知类型", "随便", "图3"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := buildDisplayImageName(tc.index, tc.imageType, tc.purpose)
			if got != tc.want {
				t.Errorf("buildDisplayImageName(%d, %q, %q) = %q, want %q", tc.index, tc.imageType, tc.purpose, got, tc.want)
			}
		})
	}
}

// getBridalImageDrafts 走自定义 blueprint 分支时，draft.Name 必须是 buildDisplayImageName 产物。
// 不允许 rawName（PMS-xxx｜F01-...）的内部代号漏到展示字段。
func TestGetBridalImageDraftsStripsInternalCodes(t *testing.T) {
	assets := DefaultAssets()
	assets.XiaohongshuBridalContentProfiles = map[string]XhsContentProfile{
		"测试主题": {
			Topic: "测试主题",
			ImageBlueprints: []XhsImageBlueprint{
				{Name: "PMS-001｜F01-正面｜A01-站立｜E01-笑", Purpose: "封面主图呈现完整状态", Description: "d1", ImageType: "产品上身图", ScenePreference: "试纱间", KeywordProfileID: "realCustomerFitting"},
				{Name: "PMS-002｜F02-侧面｜A02-走｜E02-停", Purpose: "对镜确认比例", Description: "d2", ImageType: "对镜穿搭图", ScenePreference: "试纱间", KeywordProfileID: "realCustomerFitting"},
			},
		},
	}
	drafts := getBridalImageDrafts(assets, "测试主题", 3, "seed")
	if len(drafts) != 2 {
		t.Fatalf("getBridalImageDrafts got %d drafts, want 2", len(drafts))
	}
	if drafts[0].Name != "图1-主图" {
		t.Errorf("drafts[0].Name = %q, want %q", drafts[0].Name, "图1-主图")
	}
	if drafts[1].Name != "图2-对镜" {
		t.Errorf("drafts[1].Name = %q, want %q", drafts[1].Name, "图2-对镜")
	}
	// 兜底路径：没有自定义 blueprint 时仍用 hardcoded 中文名（不动）
	fallback := getBridalImageDrafts(assets, "未知主题", 5, "seed")
	if len(fallback) == 0 || fallback[0].Name != "图1-主图" {
		t.Errorf("fallback name broken: %q", fallback[0].Name)
	}
}
