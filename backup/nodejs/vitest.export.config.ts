import { defineConfig } from "vitest/config";

// 临时配置：仅用于跑 scripts/ 下的黄金样本导出脚本，不污染 src/ 常规测试。
// 用法：npx vitest run --config scripts/vitest.export.config.ts
export default defineConfig({
  test: {
    root: "backup/nodejs",
    include: ["*.test.ts"],
  },
});
