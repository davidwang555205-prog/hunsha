package engines

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// sanitizeSummary 是「管理列表性能优化」的核心映射：
// 必须把 EngineSummaryRecord 完整映射为 EngineSummaryResp，且 JSON 输出中绝不出现 config 字段。
// PRD 需求 2：列表响应体从 MB 级降到 KB 级，依赖于 summary 不携带 config 大字段。
func TestSanitizeSummary(t *testing.T) {
	id := uuid.New()
	now := time.Date(2026, 7, 20, 12, 34, 56, 0, time.UTC)
	rec := EngineSummaryRecord{
		ID:          id,
		Key:         "bridal",
		Name:        "婚纱礼服内容引擎",
		Description: "一句话简介",
		IsEnabled:   true,
		SortOrder:   7,
		CreatedAt:   now,
		UpdatedAt:   now.Add(time.Hour),
	}

	got := sanitizeSummary(rec)

	if got.ID != id.String() {
		t.Errorf("ID = %q, want %q", got.ID, id.String())
	}
	if got.Key != "bridal" {
		t.Errorf("Key = %q, want %q", got.Key, "bridal")
	}
	if got.Name != "婚纱礼服内容引擎" {
		t.Errorf("Name = %q, want %q", got.Name, "婚纱礼服内容引擎")
	}
	if got.Description != "一句话简介" {
		t.Errorf("Description = %q, want %q", got.Description, "一句话简介")
	}
	if !got.IsEnabled {
		t.Errorf("IsEnabled = false, want true")
	}
	if got.SortOrder != 7 {
		t.Errorf("SortOrder = %d, want 7", got.SortOrder)
	}
	if got.CreatedAt != now.Format(time.RFC3339) {
		t.Errorf("CreatedAt = %q, want %q", got.CreatedAt, now.Format(time.RFC3339))
	}
	if got.UpdatedAt != now.Add(time.Hour).Format(time.RFC3339) {
		t.Errorf("UpdatedAt = %q, want %q", got.UpdatedAt, now.Add(time.Hour).Format(time.RFC3339))
	}
}

// 关键契约：EngineSummaryResp 序列化为 JSON 时不得出现 "config" 字段。
// 这是性能优化的根本承诺——裁掉 config 大字段。
func TestEngineSummaryRespJSONExcludesConfig(t *testing.T) {
	resp := EngineSummaryResp{
		ID:          uuid.New().String(),
		Key:         "bridal",
		Name:        "婚纱",
		Description: "desc",
		IsEnabled:   true,
		SortOrder:   0,
		CreatedAt:   time.Now().Format(time.RFC3339),
		UpdatedAt:   time.Now().Format(time.RFC3339),
	}
	buf, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(buf), "config") {
		t.Errorf("summary JSON must not contain config field, got: %s", string(buf))
	}
	if strings.Contains(string(buf), "Config") {
		t.Errorf("summary JSON must not contain Config field, got: %s", string(buf))
	}
}

// 对比验证：完整 EngineResp 始终携带 config（即便是空 map），
// 用于证明 listAdmin 旧接口和 listAdminSummary 新接口的响应差异。
func TestEngineRespJSONIncludesConfig(t *testing.T) {
	rec := EngineRecord{
		ID:          uuid.New(),
		Key:         "bridal",
		Name:        "婚纱",
		Description: "desc",
		Config:      map[string]any{"seeding": map[string]any{"bridalTopics": []string{"试纱体验"}}},
		IsEnabled:   true,
		SortOrder:   0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	resp := sanitize(rec)
	buf, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(buf), "config") {
		t.Errorf("full EngineResp JSON must contain config field, got: %s", string(buf))
	}
	if !strings.Contains(string(buf), "bridalTopics") {
		t.Errorf("full EngineResp JSON must serialize config content, got: %s", string(buf))
	}
}

// sanitize 兜底：Config 为 nil 时必须初始化为空 map，避免 JSON 输出 "config":null 破坏前端类型。
func TestSanitizeNilConfigDefaultsToEmptyMap(t *testing.T) {
	rec := EngineRecord{
		ID:        uuid.New(),
		Key:       "bridal",
		Name:      "婚纱",
		Config:    nil,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	resp := sanitize(rec)
	if resp.Config == nil {
		t.Fatal("sanitize must initialize nil Config to empty map")
	}
	buf, _ := json.Marshal(resp)
	if strings.Contains(string(buf), `"config":null`) {
		t.Errorf("config must not be null in JSON, got: %s", string(buf))
	}
}
