package seeding

import "strconv"

// intToStr 整数转字符串（避免多处 import strconv）
func intToStr(v int) string {
	return strconv.Itoa(v)
}

// concat 拼接多个 string slice（对应 TS [...a, ...b, ...c]）
func concat(slices ...[]string) []string {
	out := []string{}
	for _, s := range slices {
		out = append(out, s...)
	}
	return out
}

// orDefault 对应 TS `value || default`：空字符串用 default
func orDefault(value, def string) string {
	if value == "" {
		return def
	}
	return value
}

// pickT 泛型按索引取条目（对应 TS 泛型 pick<T>(items, index): T）
func pickT[T any](items []T, index int) T {
	return items[index%len(items)]
}

// narrativePoolGet 对应 TS `pool[type] ?? pool.bridal`：type 不存在或空则用 bridal
func narrativePoolGet(pool map[string][]NarrativeTemplate, key string) []NarrativeTemplate {
	if t, ok := pool[key]; ok && len(t) > 0 {
		return t
	}
	return pool["bridal"]
}
