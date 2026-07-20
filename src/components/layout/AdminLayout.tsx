/**
 * AdminLayout -- 后台管理布局壳（BaseLayout 薄封装）
 *
 * 后台导航按角色过滤：
 *   - 管理员：概览 / 个人中心 / 用户管理 / 生图历史 / 调用审计 / 模型线路 / 类目管理 / 积分记录 / 内容引擎 / 系统配置
 *   - 非管理员：仅"个人中心"
 * 可折叠 sidebar、AppHeader、main max-w-6xl 由 BaseLayout 提供。
 */
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { BaseLayout, type NavItem } from "./BaseLayout";
import { GridIcon, UsersIcon, CpuIcon, TagIcon, CoinIcon, LayersIcon, HistoryIcon, ShieldIcon } from "../icons";

/** 按角色构建侧边导航项 */
function buildNavItems(isAdmin: boolean): NavItem[] {
  const profileItem: NavItem = { to: "/admin/profile", label: "个人中心", icon: <UsersIcon size={18} /> };
  if (!isAdmin) {
    return [profileItem];
  }
  return [
    { to: "/admin", label: "概览", icon: <GridIcon size={18} />, end: true },
    profileItem,
    { to: "/admin/users", label: "用户管理", icon: <UsersIcon size={18} /> },
    { to: "/admin/history", label: "生图历史", icon: <HistoryIcon size={18} /> },
    { to: "/admin/model-invocations", label: "调用审计", icon: <CpuIcon size={18} /> },
    { to: "/admin/channels", label: "模型线路", icon: <CpuIcon size={18} /> },
    { to: "/admin/categories", label: "类目管理", icon: <TagIcon size={18} /> },
    { to: "/admin/credits", label: "积分记录", icon: <CoinIcon size={18} /> },
    { to: "/admin/engines", label: "内容引擎", icon: <LayersIcon size={18} /> },
    { to: "/admin/settings", label: "系统配置", icon: <ShieldIcon size={18} /> }
  ];
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const navItems = buildNavItems(isAdmin);
  return (
    <BaseLayout navItems={navItems} navTitle="后台管理" showBackToSite>
      {children}
    </BaseLayout>
  );
}
