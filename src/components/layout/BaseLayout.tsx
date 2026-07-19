/**
 * BaseLayout -- 全局布局壳（合并 AppShell / AdminLayout 重复结构）
 *
 * 可折叠 sidebar：展开 220px（图标 + 文字）/ 收起 64px（纯图标 + tooltip），
 * 折叠状态 localStorage 记忆。右侧 AppHeader + main max-w-6xl。
 *
 * navItems / navTitle / showBackToSite 由调用方（AppShell / AdminLayout）传入，
 * 消除两套布局壳的重复结构（DRY）。
 */
import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { ArrowLeftIcon, ChevronLeftIcon } from "../icons";
import logo from "../../assets/logo.png";

const SIDEBAR_KEY = "bridal-content-studio-sidebar";
const SIDEBAR_COLLAPSED = "collapsed";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

type BaseLayoutProps = {
  navItems: NavItem[];
  /** 分组标题（如"后台管理"），收起态隐藏 */
  navTitle?: string;
  /** 底部显示"返回主站"入口 */
  showBackToSite?: boolean;
  children: ReactNode;
};

const navClass = ({ isActive }: { isActive: boolean }, collapsed: boolean) =>
  `group relative flex items-center rounded-md transition duration-fast ease-out ${
    collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2"
  } text-sm font-medium ${
    isActive ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-bg hover:text-text"
  }`;

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-2 z-dropdown whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-surface opacity-0 shadow-md transition duration-fast ease-out group-hover:opacity-100">
      {label}
    </span>
  );
}

export function BaseLayout({ navItems, navTitle, showBackToSite, children }: BaseLayoutProps) {
  const location = useLocation();
  const isStudioWorkspace = location.pathname === "/studio";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === SIDEBAR_COLLAPSED;
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem(SIDEBAR_KEY, next ? SIDEBAR_COLLAPSED : "expanded");
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-base ease-out ${
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        }`}
      >
        {/* 顶部：logo + 折叠按钮（按钮置于 logo 行尾，收起态上下堆叠） */}
        <div className={`flex shrink-0 items-center ${collapsed ? "flex-col gap-1 py-3" : "justify-between gap-2 px-5 py-4"}`}>
          <NavLink to="/" className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
            <img src={logo} alt="Bridal & Dress" className="h-8 w-8 shrink-0 rounded-md object-cover" />
            {!collapsed && (
              <span className="font-display whitespace-nowrap text-base font-semibold tracking-tight text-text">
                Bridal &amp; Dress
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex items-center justify-center rounded-md text-text-muted transition duration-fast ease-out hover:bg-bg hover:text-text ${collapsed ? "h-8 w-8" : "h-7 w-7"}`}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <span className={`shrink-0 transition-transform duration-base ease-out ${collapsed ? "rotate-180" : ""}`}>
              <ChevronLeftIcon size={18} />
            </span>
          </button>
        </div>

        {/* nav */}
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {navTitle && !collapsed && (
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-text-subtle">{navTitle}</p>
          )}
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={(state) => navClass(state, collapsed)}>
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && <Tooltip label={item.label} />}
            </NavLink>
          ))}

          {/* 返回主站（outlined 按钮，区别于上方纯文字导航） */}
          {showBackToSite && (
            <NavLink
              to="/"
              end
              className={`group relative mt-auto flex items-center rounded-md border border-border bg-surface text-sm font-medium text-text transition duration-fast ease-out hover:bg-bg hover:text-text ${
                collapsed ? "mx-auto mb-2 mt-3 h-9 w-9 justify-center" : "mt-3 justify-center gap-2 px-3 py-2"
              }`}
            >
              <span className="shrink-0">
                <ArrowLeftIcon size={18} />
              </span>
              {!collapsed && <span>返回主站</span>}
              {collapsed && <Tooltip label="返回主站" />}
            </NavLink>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className={isStudioWorkspace ? "min-h-0 flex-1 text-text" : "flex-1 px-6 py-6 text-text sm:px-8"}>
          <div className={isStudioWorkspace ? "h-[calc(100vh-3.5rem)]" : "mx-auto max-w-6xl"}>{children}</div>
        </main>
      </div>
    </div>
  );
}
