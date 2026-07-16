/**
 * AppShell -- 主站布局壳（BaseLayout 薄封装）
 *
 * 主站导航：工具首页 / 内容生成 / 历史记录 / [后台管理(admin)]。
 * 可折叠 sidebar、AppHeader、main max-w-6xl 由 BaseLayout 提供。
 */
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { BaseLayout, type NavItem } from "./BaseLayout";
import { HomeIcon, SparklesIcon, ClockIcon, ShieldIcon } from "../icons";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const navItems: NavItem[] = [
    { to: "/", label: "工具首页", icon: <HomeIcon size={18} />, end: true },
    { to: "/studio", label: "内容生成", icon: <SparklesIcon size={18} /> },
    { to: "/history", label: "历史记录", icon: <ClockIcon size={18} /> },
    ...(isAdmin ? [{ to: "/admin", label: "后台管理", icon: <ShieldIcon size={18} /> }] : [])
  ];
  return <BaseLayout navItems={navItems}>{children}</BaseLayout>;
}
