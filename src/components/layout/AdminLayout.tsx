/**
 * AdminLayout -- 后台管理布局壳（BaseLayout 薄封装）
 *
 * 后台导航：概览 / 用户管理 / 模型线路 / 类目管理 / 积分记录 + 返回主站。
 * 可折叠 sidebar、AppHeader、main max-w-6xl 由 BaseLayout 提供。
 */
import type { ReactNode } from "react";
import { BaseLayout, type NavItem } from "./BaseLayout";
import { GridIcon, UsersIcon, CpuIcon, TagIcon, CoinIcon, LayersIcon, HistoryIcon, ShieldIcon } from "../icons";

const navItems: NavItem[] = [
  { to: "/admin", label: "概览", icon: <GridIcon size={18} />, end: true },
  { to: "/admin/users", label: "用户管理", icon: <UsersIcon size={18} /> },
  { to: "/admin/history", label: "生图历史", icon: <HistoryIcon size={18} /> },
  { to: "/admin/model-invocations", label: "调用审计", icon: <CpuIcon size={18} /> },
  { to: "/admin/channels", label: "模型线路", icon: <CpuIcon size={18} /> },
  { to: "/admin/categories", label: "类目管理", icon: <TagIcon size={18} /> },
  { to: "/admin/credits", label: "积分记录", icon: <CoinIcon size={18} /> },
  { to: "/admin/engines", label: "内容引擎", icon: <LayersIcon size={18} /> },
  { to: "/admin/settings", label: "系统配置", icon: <ShieldIcon size={18} /> }
];

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <BaseLayout navItems={navItems} navTitle="后台管理" showBackToSite>
      {children}
    </BaseLayout>
  );
}
