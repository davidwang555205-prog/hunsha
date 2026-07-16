// Package seeding 实现小红书内容确定性生成引擎（1:1 迁移自
// src/utils/generateFashionSeedingContent.ts）。每主题 1000 变体，纯算法无 LLM。
//
// 迁移约束：字符串拼接顺序、整数除法/取模、中文 Unicode 必须与 TS byte-for-byte 一致。
// JS String.length/slice 是 UTF-16 码元；中文字符均在 BMP，UTF-16 码元数 = 码点数，
// 故 Go 侧用 utf8.RuneCountInString / []rune 切片对应。日期依赖本地时区，黄金样本在
// +08:00 导出，Go 侧用解析 ISO 得到的 location 构造本地午夜以匹配。
package seeding

import (
	"fmt"
	"time"
)

// 算法常量（与 TS :166-207 一致，改了破坏变体空间，只读）
const (
	TopicVariantCount = 1000
	VariantAxisSize   = 10
	MSPerDay          = 24 * 60 * 60 * 1000
	DailyPostCount    = 2
)

// ProductCategory 取值（src/types.ts:3）
const (
	ProductCategoryBridal = "婚纱 / 礼服"
	ProductCategoryDress  = "裙装 / 女装"
)

// XiaohongshuBridalTopic 小红书婚纱主题（src/data/xiaohongshuBridalContentProfiles.ts:4-10,55-62）
var xiaohongshuBridalTopicOptions = []string{
	"真实客户试纱",
	"手机对镜自拍试纱",
	"试纱陪同视角",
	"试纱避坑准备",
	"婚纱品牌发布",
	"婚纱店发布",
}

// BridalFashionTopicOptions 婚纱主题列表（TS :169-181，顺序不可变）
var BridalFashionTopicOptions = []string{
	"试纱体验",
	"真实客户试纱", "手机对镜自拍试纱", "试纱陪同视角", "试纱避坑准备", "婚纱品牌发布", "婚纱店发布",
	"极简新娘", "法式婚纱", "草坪婚礼", "酒店婚礼", "海边旅拍", "登记照", "晚宴礼服", "婚礼前一天", "新娘独处时刻",
}

// DressFashionTopicOptions 裙装主题列表（TS :183-194，顺序不可变）
var DressFashionTopicOptions = []string{
	"通勤裙装", "约会裙装", "周末裙装", "度假长裙", "艺术馆穿搭",
	"下午茶", "晚餐约会", "轻熟日常", "秋冬裙装", "一条裙子的多场景",
}

// IsXiaohongshuBridalTopic 小红书婚纱主题判定（TS :198-205）
func IsXiaohongshuBridalTopic(topic string) bool {
	for _, t := range xiaohongshuBridalTopicOptions {
		if t == topic {
			return true
		}
	}
	return false
}

// IsBridalFashionTopic 婚纱品类主题判定（TS :202-205）
func IsBridalFashionTopic(topic string) bool {
	for _, t := range BridalFashionTopicOptions {
		if t == topic {
			return true
		}
	}
	return false
}

func getTopicOptions(productCategory string) []string {
	if productCategory == ProductCategoryBridal {
		return BridalFashionTopicOptions
	}
	return DressFashionTopicOptions
}

// GetFashionSeedingTopicOptions 暴露主题选项（TS :230-232）
func GetFashionSeedingTopicOptions(productCategory string) []string {
	return getTopicOptions(productCategory)
}

func pad2(v int) string {
	return fmt.Sprintf("%02d", v)
}

// GetLocalDateKey 本地日期键 YYYY-MM-DD（TS :213-215）
func GetLocalDateKey(d time.Time) string {
	return fmt.Sprintf("%d-%s-%s", d.Year(), pad2(int(d.Month())), pad2(d.Day()))
}

// getDayNumber 本地午夜以来的天数（TS :217-220）。用 d 的 location 构造本地午夜，
// 与 TS 在 +08:00 环境跑 getDayNumber 一致。
func getDayNumber(d time.Time) int64 {
	loc := d.Location()
	midnight := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc)
	return midnight.UnixMilli() / int64(MSPerDay)
}

func resolveDailySlot(slot int) int {
	if slot == 2 {
		return 2
	}
	return 1
}

// DailySelection 每日确定性选题（TS getDailyFashionSeedingSelection 返回）
type DailySelection struct {
	DateKey      string
	DailySlot    int
	Topic        string
	VariantIndex int
	VariantCount int
	VariantLabel string
}

// GetDailyFashionSeedingSelection 每日选题（TS :238-258）
func GetDailyFashionSeedingSelection(productCategory string, d time.Time, dailySlot int) DailySelection {
	topicOptions := getTopicOptions(productCategory)
	safeSlot := resolveDailySlot(dailySlot)
	globalPostIndex := getDayNumber(d)*int64(DailyPostCount) + int64(safeSlot-1)
	n := int64(len(topicOptions))
	topic := topicOptions[int(globalPostIndex%n)]
	variantCount := TopicVariantCount
	variantIndex := int((globalPostIndex / n) % int64(variantCount))
	return DailySelection{
		DateKey:      GetLocalDateKey(d),
		DailySlot:    safeSlot,
		Topic:        topic,
		VariantIndex: variantIndex,
		VariantCount: variantCount,
		VariantLabel: fmt.Sprintf("第 %d / %d 版", variantIndex+1, variantCount),
	}
}

// pick 按索引取条目（TS :260-262）
func pick(items []string, index int) string {
	return items[index%len(items)]
}

// VariantAxes 15 轴选择索引（TS :118-135）
type VariantAxes struct {
	VariantIndex                   int
	Primary, Secondary, Tertiary   int
	Audience, Focus, Concern       int
	Proof, Scene, Material         int
	Service, Takeaway, Tone        int
	TagA, TagB, TagC               int
}

// GetVariantAxes 十进制分解 + 线性同余映射 15 轴（TS :2137-2161）
func GetVariantAxes(variantIndex int) VariantAxes {
	safeIndex := ((variantIndex % TopicVariantCount) + TopicVariantCount) % TopicVariantCount
	primary := safeIndex % VariantAxisSize
	secondary := (safeIndex / VariantAxisSize) % VariantAxisSize
	tertiary := (safeIndex / (VariantAxisSize * VariantAxisSize)) % VariantAxisSize
	return VariantAxes{
		VariantIndex: safeIndex,
		Primary:      primary,
		Secondary:    secondary,
		Tertiary:     tertiary,
		Audience:     primary,
		Focus:        secondary,
		Concern:      tertiary,
		Proof:        (primary + secondary*3 + tertiary*7) % VariantAxisSize,
		Scene:        (primary*7 + secondary + tertiary*3) % VariantAxisSize,
		Material:     (primary*3 + secondary*7 + tertiary) % VariantAxisSize,
		Service:      (primary*5 + secondary*2 + tertiary) % VariantAxisSize,
		Takeaway:     (primary*2 + secondary + tertiary*5) % VariantAxisSize,
		Tone:         (primary*3 + secondary*2 + tertiary) % VariantAxisSize,
		TagA:         primary,
		TagB:         (secondary + tertiary) % VariantAxisSize,
		TagC:         (primary + tertiary) % VariantAxisSize,
	}
}

// FashionSeedingInput 生成输入（TS :61-69）。Topic 为空走 daily.topic；ImageCount 0 表示默认 5。
type FashionSeedingInput struct {
	ProductCategory string
	BaseParams      PromptParams // 配图层用，文案层不依赖
	ImageCount      int          // 0=默认5，3=3图
	Topic           string       // "" 走 daily.topic
	Date            time.Time
	DailySlot       int
	ContentNonce    int
}

// ChinaFixedZone 返回 +08:00 固定时区（项目面向中国用户，与前端浏览器 +08:00 一致）。
// API 生成用此时区算 dateKey/variantIndex，避免服务器时区差异导致选题漂移。
func ChinaFixedZone() *time.Location {
	return time.FixedZone("CST", 8*3600)
}

func contains(items []string, v string) bool {
	for _, x := range items {
		if x == v {
			return true
		}
	}
	return false
}

// computeScalarFields 主入口的标量字段计算（TS generateFashionSeedingContent :3065-3076 的标量部分）。
// 返回 safeTopic, variantIndex, variantCount, daily。用原始 input.Topic 判定 variantIndex 分支
// （与 TS 一致，不是 safeTopic）。
func computeScalarFields(input FashionSeedingInput) (safeTopic string, variantIndex int, variantCount int, daily DailySelection) {
	daily = GetDailyFashionSeedingSelection(input.ProductCategory, input.Date, input.DailySlot)
	topicOptions := getTopicOptions(input.ProductCategory)
	safeTopic = daily.Topic
	if input.Topic != "" && contains(topicOptions, input.Topic) {
		safeTopic = input.Topic
	}
	variantCount = TopicVariantCount
	contentNonce := input.ContentNonce
	if input.Topic != "" && input.Topic != daily.Topic {
		variantIndex = contentNonce % variantCount
	} else {
		variantIndex = (daily.VariantIndex + contentNonce) % variantCount
	}
	return safeTopic, variantIndex, variantCount, daily
}
