package seeding

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

// 字符串处理函数 1:1 迁移自 src/utils/generateFashionSeedingContent.ts :1185-1514。
// byte-for-byte 关键：正则替换顺序、字面量 vs 正则、中文 Unicode（JS String.length/slice
// 是 UTF-16 码元；中文均在 BMP，1 码元 = 1 码点，故 Go 用 utf8.RuneCountInString / []rune）。

// 预编译正则（对应 TS 正则字面量）
var (
	rePhraseEnd    = regexp.MustCompile(`[。！？!?；;]+`) // :1187
	reDotRun       = regexp.MustCompile(`\.+`)            // :1188
	reCommaTail    = regexp.MustCompile(`，+$`)            // :1189
	reCommaLead    = regexp.MustCompile(`^，+`)            // :1221
	reWhitespace   = regexp.MustCompile(`\s+`)             // :1509
	reCommaRun     = regexp.MustCompile(`，+`)             // :1510
	reColonRun     = regexp.MustCompile(`：+`)             // :1511
	reCommaEdge    = regexp.MustCompile(`^，|，$`)          // :1512
	reCommaSqueeze = regexp.MustCompile(`，+`)             // :1432 narrativeCue/titleCue 末尾合并
)

// replacePrefix 对应 JS .replace(/^prefix/, repl)（无 g，^锚定只匹配开头一处）。
func replacePrefix(s, prefix, repl string) string {
	if strings.HasPrefix(s, prefix) {
		return repl + s[len(prefix):]
	}
	return s
}

// replaceSuffix 对应 JS .replace(/suffix$/, repl)（$锚定只匹配结尾一处）。
func replaceSuffix(s, suffix, repl string) string {
	if strings.HasSuffix(s, suffix) {
		return s[:len(s)-len(suffix)] + repl
	}
	return s
}

// toPhrase TS :1185-1191
func toPhrase(value string) string {
	s := rePhraseEnd.ReplaceAllString(value, "，")
	s = reDotRun.ReplaceAllString(s, "，")
	s = reCommaTail.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// readableCue TS :1193-1223。30+ 替换，顺序严格按 TS。
func readableCue(value string) string {
	s := toPhrase(value)
	s = replacePrefix(s, "内容可以保留", "")
	s = replacePrefix(s, "画面可以有", "")
	s = replacePrefix(s, "画面不需要拍成大片，", "")
	s = replacePrefix(s, "配图适合出现", "")
	s = replacePrefix(s, "配图可以有", "")
	s = replacePrefix(s, "适合拍", "")
	s = replacePrefix(s, "试纱间里可以保留", "")
	s = replacePrefix(s, "如果是系列发布，最好让", "系列发布时让")
	s = replacePrefix(s, "每张图要说明", "每张图说明")
	s = replacePrefix(s, "不要把", "不把")
	s = strings.ReplaceAll(s, "内容", "笔记")
	s = strings.ReplaceAll(s, "用户", "人")
	s = strings.ReplaceAll(s, "读者", "看到的人")
	s = strings.ReplaceAll(s, "是否", "有没有")
	s = replacePrefix(s, "让人知道", "知道")
	s = replacePrefix(s, "让看到的人", "让人")
	s = replacePrefix(s, "帮预约前的人", "预约前的人")
	s = replacePrefix(s, "让品牌或门店", "品牌或门店")
	s = replacePrefix(s, "让组图", "组图")
	s = replacePrefix(s, "让最终选择", "最终选择")
	s = replacePrefix(s, "让同一单品", "同一单品")
	s = replacePrefix(s, "让场景", "场景")
	s = replacePrefix(s, "让面料", "面料")
	s = replacePrefix(s, "让裙装", "裙装")
	s = strings.ReplaceAll(s, "把收藏价值放在可复穿上", "把重点放在可复穿")
	s = strings.ReplaceAll(s, "收藏价值", "可复穿")
	s = reCommaLead.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// softenAction TS :1468-1485
func softenAction(value string) string {
	s := readableCue(value)
	s = replacePrefix(s, "让顾问", "可以让顾问")
	s = replacePrefix(s, "请朋友", "记得请朋友")
	s = replacePrefix(s, "每件都", "每件最好都")
	s = replacePrefix(s, "把", "可以把")
	s = replacePrefix(s, "同时看", "别忘了看")
	s = replacePrefix(s, "问清楚", "提前问清楚")
	s = replacePrefix(s, "确认", "提前确认")
	s = replacePrefix(s, "不要", "尽量不要")
	s = replacePrefix(s, "回家后", "回家后再")
	s = replacePrefix(s, "先用", "先用")
	s = replacePrefix(s, "再补", "再补")
	s = replacePrefix(s, "保留", "保留")
	s = replacePrefix(s, "避免", "避免")
	s = replacePrefix(s, "听完", "听完")
	return strings.TrimSpace(s)
}

// cleanTitle TS :1507-1514
func cleanTitle(value string) string {
	s := reWhitespace.ReplaceAllString(value, "")
	s = reCommaRun.ReplaceAllString(s, "，")
	s = reColonRun.ReplaceAllString(s, "：")
	s = reCommaEdge.ReplaceAllString(s, "")
	runes := []rune(s)
	if len(runes) > 34 {
		runes = runes[:34]
	}
	return string(runes)
}

// runeSlice 对应 JS String.prototype.slice(0, n)（UTF-16 码元；中文 BMP 下等价 []rune）。
func runeSlice(s string, n int) string {
	runes := []rune(s)
	if len(runes) > n {
		runes = runes[:n]
	}
	return string(runes)
}

// runeLen 对应 JS String.length（UTF-16 码元数；中文 BMP 下等价 utf8.RuneCountInString）。
func runeLen(s string) int {
	return utf8.RuneCountInString(s)
}

// trimCommaEdge 对应 JS .replace(/^，|，$/g, "")（去首尾，）
func trimCommaEdge(s string) string {
	return reCommaEdge.ReplaceAllString(s, "")
}
