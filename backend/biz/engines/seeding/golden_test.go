package seeding

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// 黄金样本固定输入日期（与 scripts/export-golden-samples.test.ts FIXED_DATE_ISO 一致）
const goldenFixedDateISO = "2026-07-10T10:00:00+08:00"

// goldenSample 对应 backend/biz/engines/testdata/golden-samples.json 结构
type goldenSample struct {
	ID    string `json:"id"`
	Input struct {
		ProductCategory string  `json:"productCategory"`
		DailySlot       int     `json:"dailySlot"`
		ContentNonce    int     `json:"contentNonce"`
		Topic           *string `json:"topic"`
		ImageCount      *int    `json:"imageCount"`
	} `json:"input"`
	Output struct {
		Topic        string   `json:"topic"`
		DateKey      string   `json:"dateKey"`
		DailySlot    int      `json:"dailySlot"`
		VariantIndex int      `json:"variantIndex"`
		VariantCount int      `json:"variantCount"`
		VariantLabel string   `json:"variantLabel"`
		Titles       []string `json:"titles"`
		Body         string   `json:"body"`
		Tags         []string `json:"tags"`
		Note         string   `json:"note"`
		Images       []struct {
			Name                   string  `json:"name"`
			Purpose                string  `json:"purpose"`
			Description            string  `json:"description"`
			ProductCategory        string  `json:"productCategory"`
			ImageType              string  `json:"imageType"`
			ScenePreference        string  `json:"scenePreference"`
			ModelChoice            string  `json:"modelChoice"`
			LightPreference        string  `json:"lightPreference"`
			ExtraRequirement       string  `json:"extraRequirement"`
			GenerationNonce        int     `json:"generationNonce"`
			BridalKeywordProfileID *string `json:"bridalKeywordProfileId"`
		} `json:"images"`
	} `json:"output"`
	FormatContent  string `json:"formatContent"`
	FormatKeywords string `json:"formatKeywords"`
}

func loadGoldenSamples(t *testing.T) []goldenSample {
	t.Helper()
	path := filepath.Join("testdata", "golden-samples.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden samples: %v", err)
	}
	var samples []goldenSample
	if err := json.Unmarshal(data, &samples); err != nil {
		t.Fatalf("unmarshal golden samples: %v", err)
	}
	if len(samples) == 0 {
		t.Fatal("no golden samples")
	}
	return samples
}

func parseGoldenDate(t *testing.T) time.Time {
	t.Helper()
	d, err := time.Parse(time.RFC3339, goldenFixedDateISO)
	if err != nil {
		t.Fatalf("parse golden date: %v", err)
	}
	return d
}

// TestGoldenSamples_ScalarFields 标量字段 byte-for-byte 比对（里程碑1）：
// topic/dateKey/dailySlot/variantIndex/variantCount/variantLabel 必须全样本一致。
// 验证日期/时区/整数运算/topic 选择/variantIndex 双分支与 TS 完全等价。
func TestGoldenSamples_ScalarFields(t *testing.T) {
	samples := loadGoldenSamples(t)
	fixedDate := parseGoldenDate(t)

	var mismatches []string
	for _, s := range samples {
		input := FashionSeedingInput{
			ProductCategory: s.Input.ProductCategory,
			Date:            fixedDate,
			DailySlot:       s.Input.DailySlot,
			ContentNonce:    s.Input.ContentNonce,
		}
		if s.Input.Topic != nil {
			input.Topic = *s.Input.Topic
		}
		if s.Input.ImageCount != nil {
			input.ImageCount = *s.Input.ImageCount
		}

		safeTopic, variantIndex, variantCount, daily := computeScalarFields(input, nil)

		check := func(name, got, want string) {
			if got != want {
				mismatches = append(mismatches, fmtMismatch(s.ID, name, got, want))
			}
		}
		checkInt := func(name string, got, want int) {
			if got != want {
				mismatches = append(mismatches, fmtMismatch(s.ID, name, intToStr(got), intToStr(want)))
			}
		}

		check("topic", safeTopic, s.Output.Topic)
		check("dateKey", daily.DateKey, s.Output.DateKey)
		checkInt("dailySlot", daily.DailySlot, s.Output.DailySlot)
		checkInt("variantIndex", variantIndex, s.Output.VariantIndex)
		checkInt("variantCount", variantCount, s.Output.VariantCount)
		// variantLabel 基于最终 variantIndex（TS :3105），非 daily.VariantIndex
		check("variantLabel", "第 "+intToStr(variantIndex+1)+" / "+intToStr(variantCount)+" 版", s.Output.VariantLabel)
	}

	if len(mismatches) > 0 {
		t.Fatalf("scalar field mismatches (%d/%d samples):\n%s", len(mismatches), len(samples)*6, joinStr(mismatches, "\n"))
	}
	t.Logf("scalar fields OK for all %d samples", len(samples))
}

func fmtMismatch(id, name, got, want string) string {
	return "[" + id + "] " + name + ": got=" + got + " want=" + want
}

func joinStr(items []string, sep string) string {
	out := ""
	for i, s := range items {
		if i > 0 {
			out += sep
		}
		out += s
	}
	return out
}

func sliceEq(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// TestGoldenSamples_CopyFields 文案字段 byte-for-byte 比对（里程碑2）：
// titles/body/tags/note 必须全样本一致。验证字符串替换链 + 素材 + 文案算法与 TS 完全等价。
func TestGoldenSamples_CopyFields(t *testing.T) {
	samples := loadGoldenSamples(t)
	fixedDate := parseGoldenDate(t)
	assets := DefaultAssets()

	var mismatches []string
	for _, s := range samples {
		input := FashionSeedingInput{
			ProductCategory: s.Input.ProductCategory,
			Date:            fixedDate,
			DailySlot:       s.Input.DailySlot,
			ContentNonce:    s.Input.ContentNonce,
		}
		if s.Input.Topic != nil {
			input.Topic = *s.Input.Topic
		}
		safeTopic, variantIndex, _, _ := computeScalarFields(input, nil)
		draft := buildCopyFromKit(assets, input.ProductCategory, safeTopic, variantIndex)

		if !sliceEq(draft.Titles, s.Output.Titles) {
			mismatches = append(mismatches, "["+s.ID+"] titles: got="+joinStr(draft.Titles, "|")+" want="+joinStr(s.Output.Titles, "|"))
		}
		if draft.Body != s.Output.Body {
			mismatches = append(mismatches, "["+s.ID+"] body: got="+draft.Body+" want="+s.Output.Body)
		}
		if !sliceEq(draft.Tags, s.Output.Tags) {
			mismatches = append(mismatches, "["+s.ID+"] tags: got="+joinStr(draft.Tags, "|")+" want="+joinStr(s.Output.Tags, "|"))
		}
		if draft.Note != s.Output.Note {
			mismatches = append(mismatches, "["+s.ID+"] note: got="+draft.Note+" want="+s.Output.Note)
		}
	}

	if len(mismatches) > 0 {
		t.Fatalf("copy field mismatches (%d):\n%s", len(mismatches), joinStr(mismatches, "\n"))
	}
	t.Logf("copy fields OK for all %d samples", len(samples))
}

// goldenBaseParams 与 scripts/export-golden-samples.test.ts baseParamsBridal 一致
func goldenBaseParams(category string) PromptParams {
	return PromptParams{
		ProductCategory:   category,
		BridalStyle:       "极简缎面婚纱",
		DressStyle:        "连衣裙",
		CustomProductName: "",
		ImageType:         "产品上身图",
		ModelChoice:       "亚洲新娘感模特 25–35",
		Season:            "夏",
		ScenePreference:   "自动匹配",
		LightPreference:   "自动匹配",
		ExtraRequirement:  "",
		GenerationNonce:   0,
	}
}

// TestGoldenSamples_FullContent 全量 byte-for-byte 比对（里程碑3）：
// 含 images（11 字段）+ formatContent + formatKeywords。
func TestGoldenSamples_FullContent(t *testing.T) {
	samples := loadGoldenSamples(t)
	fixedDate := parseGoldenDate(t)
	assets := DefaultAssets()

	var mismatches []string
	for _, s := range samples {
		input := FashionSeedingInput{
			ProductCategory: s.Input.ProductCategory,
			BaseParams:      goldenBaseParams(s.Input.ProductCategory),
			Date:            fixedDate,
			DailySlot:       s.Input.DailySlot,
			ContentNonce:    s.Input.ContentNonce,
		}
		if s.Input.Topic != nil {
			input.Topic = *s.Input.Topic
		}
		if s.Input.ImageCount != nil {
			input.ImageCount = *s.Input.ImageCount
		}
		content := GenerateFashionSeedingContent(input, assets)

		if content.Topic != s.Output.Topic {
			mismatches = append(mismatches, "["+s.ID+"] topic")
		}
		if content.DateKey != s.Output.DateKey {
			mismatches = append(mismatches, "["+s.ID+"] dateKey")
		}
		if content.DailySlot != s.Output.DailySlot {
			mismatches = append(mismatches, "["+s.ID+"] dailySlot")
		}
		if content.VariantIndex != s.Output.VariantIndex {
			mismatches = append(mismatches, "["+s.ID+"] variantIndex")
		}
		if content.VariantLabel != s.Output.VariantLabel {
			mismatches = append(mismatches, "["+s.ID+"] variantLabel")
		}
		if !sliceEq(content.Titles, s.Output.Titles) {
			mismatches = append(mismatches, "["+s.ID+"] titles")
		}
		if content.Body != s.Output.Body {
			mismatches = append(mismatches, "["+s.ID+"] body")
		}
		if !sliceEq(content.Tags, s.Output.Tags) {
			mismatches = append(mismatches, "["+s.ID+"] tags")
		}
		if content.Note != s.Output.Note {
			mismatches = append(mismatches, "["+s.ID+"] note")
		}

		if len(content.Images) != len(s.Output.Images) {
			mismatches = append(mismatches, "["+s.ID+"] images len: got="+intToStr(len(content.Images))+" want="+intToStr(len(s.Output.Images)))
		} else {
			for i, img := range content.Images {
				want := s.Output.Images[i]
				p := img.Params
				if img.Name != want.Name {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".name")
				}
				if img.Purpose != want.Purpose {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".purpose")
				}
				if img.Description != want.Description {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".description")
				}
				if p.ProductCategory != want.ProductCategory {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".productCategory")
				}
				if p.ImageType != want.ImageType {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".imageType")
				}
				if p.ScenePreference != want.ScenePreference {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".scenePreference: got="+p.ScenePreference+" want="+want.ScenePreference)
				}
				if p.ModelChoice != want.ModelChoice {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".modelChoice")
				}
				if p.LightPreference != want.LightPreference {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".lightPreference")
				}
				if p.ExtraRequirement != want.ExtraRequirement {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".extraRequirement")
				}
				if p.GenerationNonce != want.GenerationNonce {
					mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".generationNonce: got="+intToStr(p.GenerationNonce)+" want="+intToStr(want.GenerationNonce))
				}
				if want.BridalKeywordProfileID == nil {
					if p.BridalKeywordProfileID != "" {
						mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".kp: got="+p.BridalKeywordProfileID+" want=nil")
					}
				} else {
					if p.BridalKeywordProfileID != *want.BridalKeywordProfileID {
						mismatches = append(mismatches, "["+s.ID+"] img"+intToStr(i)+".kp: got="+p.BridalKeywordProfileID+" want="+*want.BridalKeywordProfileID)
					}
				}
			}
		}

		if FormatFashionSeedingContent(content) != s.FormatContent {
			mismatches = append(mismatches, "["+s.ID+"] formatContent")
		}
		if FormatFashionSeedingKeywords(content) != s.FormatKeywords {
			mismatches = append(mismatches, "["+s.ID+"] formatKeywords")
		}
	}

	if len(mismatches) > 0 {
		t.Fatalf("full content mismatches (%d):\n%s", len(mismatches), joinStr(mismatches, "\n"))
	}
	t.Logf("full content OK for all %d samples", len(samples))
}
