/**
 * deepMerge -- 递归合并两个 plain object（array/标量整体覆盖，null/undefined 跳过）。
 * 与后端 seeding.deepMerge 语义一致：config.seeding 覆盖默认素材。
 * 返回新对象，不修改入参。
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | undefined | null
): T {
  if (!override) return base;
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const ov = override[key];
    if (ov === null || ov === undefined) continue;
    const bv = result[key];
    if (
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv) &&
      ov &&
      typeof ov === "object" &&
      !Array.isArray(ov)
    ) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>);
    } else {
      result[key] = ov;
    }
  }
  return result as T;
}
