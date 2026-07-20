import { describe, expect, it } from "vitest";
import { isNonAdminAllowedPath } from "./RequireAuth";

/**
 * 非管理员访问 /admin/* 的白名单判定。
 * PRD 需求 1：头像弹窗 + 菜单权限 —— 非管理员仅能访问 /admin/profile，
 * 其余 /admin/* 一律跳回 /admin/profile（不白屏不 403）。
 */
describe("isNonAdminAllowedPath — 非管理员白名单路径判定", () => {
  it("精确命中 /admin/profile：放行", () => {
    expect(isNonAdminAllowedPath("/admin/profile")).toBe(true);
  });

  it("子路径 /admin/profile/xxx：放行", () => {
    expect(isNonAdminAllowedPath("/admin/profile/email")).toBe(true);
    expect(isNonAdminAllowedPath("/admin/profile/phone")).toBe(true);
    expect(isNonAdminAllowedPath("/admin/profile/any/depth")).toBe(true);
  });

  it("尾随斜杠 /admin/profile/：放行（仍属子路径）", () => {
    expect(isNonAdminAllowedPath("/admin/profile/")).toBe(true);
  });

  it("根 /admin：不放行", () => {
    expect(isNonAdminAllowedPath("/admin")).toBe(false);
  });

  it("/admin/users 等其他管理路径：不放行", () => {
    expect(isNonAdminAllowedPath("/admin/users")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/engines")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/settings")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/channels")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/categories")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/credits")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/history")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/model-invocations")).toBe(false);
  });

  it("前缀重叠但非子路径（/admin/profilefoo）：不放行", () => {
    // 关键边界：必须防止 startsWith("/admin/profile") 这种宽松判定把 /admin/profilefoo 当成白名单
    expect(isNonAdminAllowedPath("/admin/profilefoo")).toBe(false);
    expect(isNonAdminAllowedPath("/admin/profile-edit")).toBe(false);
  });

  it("非 /admin 路径（主站）：不在此白名单语义内，返回 false", () => {
    expect(isNonAdminAllowedPath("/")).toBe(false);
    expect(isNonAdminAllowedPath("/profile")).toBe(false);
    expect(isNonAdminAllowedPath("/history")).toBe(false);
    expect(isNonAdminAllowedPath("/studio")).toBe(false);
  });

  it("大小写敏感：/Admin/Profile 不命中", () => {
    expect(isNonAdminAllowedPath("/Admin/Profile")).toBe(false);
    expect(isNonAdminAllowedPath("/ADMIN/PROFILE")).toBe(false);
  });

  it("查询串不影响判定（location.pathname 不含 query）", () => {
    // useLocation().pathname 不会带 ?query，此处仅验证输入本身
    expect(isNonAdminAllowedPath("/admin/profile?tab=email")).toBe(false); // 含 ? 不等于精确匹配
  });
});
