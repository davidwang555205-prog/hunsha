// Package dotenv 提供轻量 .env 加载（与 Node server/index.mjs applyDotEnv 行为一致）。
// 仅在进程环境变量未设置时填充，不覆盖已有值。不依赖第三方库。
package dotenv

import (
	"bufio"
	"os"
	"regexp"
	"strings"
)

var lineRegex = regexp.MustCompile(`^([A-Za-z_][A-Za-z0-9_]*)=(.*)$`)

// Load 读取 .env 文件并在环境变量未设置时填充。文件不存在则跳过。
func Load(path string) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		m := lineRegex.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		key := m[1]
		value := strings.Trim(m[2], `"'`)
		// 与 Node 一致：仅当环境变量未设置时填充。
		if _, ok := os.LookupEnv(key); !ok {
			_ = os.Setenv(key, value)
		}
	}
	return scanner.Err()
}
