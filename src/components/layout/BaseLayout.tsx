/**
 * BaseLayout -- 全局布局壳（合并 AppShell / AdminLayout 重复结构）
 *
 * 可折叠 sidebar：展开 220px（图标 + 文字）/ 收起 64px（纯图标 + tooltip），
 * 折叠状态 localStorage 记忆。右侧 AppHeader + main max-w-6xl。
 *
 * navItems / navTitle / showBackToSite 由调用方（AppShell / AdminLayout）传入，
 * 消除两套布局壳的重复结构（DRY）。
 *
 * NavItem 支持 children（可选）：有则渲染为可折叠二级分组
 *   - 展开态：分组头点击 toggle，子项缩进 + 左竖线，任一子项 active 时分组头高亮
 *   - 收起态：分组头纯图标，hover 弹出 flyout 子项面板
 *   - 当前路由命中某子项的分组默认展开；路由变化时自动展开命中组（不强制收起其他组）
 *
 * 点击即时高亮：pendingPath 本地态（点击瞬间置为目标 path，URL 变化后清空）。
 * 懒加载 chunk 期间旧路由仍在，原生 isActive 不会立即变，这里补一拍交互反馈。
 */
import { useEffect, useState, type ReactNode } from "react";
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
  /** 存在则渲染为可折叠分组，其元素为二级菜单项 */
  children?: NavItem[];
};

type BaseLayoutProps = {
  navItems: NavItem[];
  /** 分组标题（如"后台管理"），收起态隐藏 */
  navTitle?: string;
  /** 底部显示"返回主站"入口 */
  showBackToSite?: boolean;
  children: ReactNode;
};

const navClass = (active: boolean, collapsed: boolean) =>
  `group relative flex items-center rounded-md transition duration-fast ease-out ${
    collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2"
  } text-sm ${active ? "bg-primary/10 font-medium text-primary" : "font-normal text-text-muted hover:bg-bg hover:text-text"}`;

/** 二级菜单子项 className（展开态缩进列表 / 收起态 flyout 面板共用）：字色比一级更淡以区分层级 */
const childNavClass = (active: boolean) =>
  `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition duration-fast ease-out ${
    active ? "bg-primary/10 font-medium text-primary" : "font-normal text-text-subtle hover:bg-bg hover:text-text"
  }`;

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-2 z-dropdown whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-surface opacity-0 shadow-md transition duration-fast ease-out group-hover:opacity-100">
      {label}
    </span>
  );
}

/** 当前路由命中的分组 label（子项 to === pathname），无则 null */
function findHitGroupLabel(navItems: NavItem[], pathname: string): string | null {
  for (const item of navItems) {
    if (item.children?.some((c) => c.to === pathname)) return item.label;
  }
  return null;
}

export function BaseLayout({ navItems, navTitle, showBackToSite, children }: BaseLayoutProps) {
  const location = useLocation();
  const isStudioWorkspace = location.pathname === "/studio";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === SIDEBAR_COLLAPSED;
  });
  // 点击瞬间的本地高亮路径；URL 变化（路由真正生效）或 5s 超时后清空，避免与路由状态错位。
  // 用 derived-state 模式：把上一次 location.pathname 也存进 state，渲染期对比差异并一次性清空，
  // 避免 react-hooks/set-state-in-effect 与 react-hooks/refs 两组 lint 规则冲突。
  const [highlight, setHighlight] = useState<{ pendingPath: string | null; lastPathname: string }>({
    pendingPath: null,
    lastPathname: location.pathname
  });
  if (highlight.lastPathname !== location.pathname) {
    setHighlight({ pendingPath: null, lastPathname: location.pathname });
  }
  const pendingPath = highlight.pendingPath;
  const setPendingPath = (path: string | null) =>
    setHighlight((cur) => ({ pendingPath: path, lastPathname: cur.lastPathname }));

  // 二级分组展开状态：初始展开当前路由命中组；路由变化时自动展开命中组（保留用户对其余组的手动收起）
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const label = findHitGroupLabel(navItems, location.pathname);
    return label ? new Set([label]) : new Set();
  });
  const [lastGroupPath, setLastGroupPath] = useState(location.pathname);
  if (lastGroupPath !== location.pathname) {
    setLastGroupPath(location.pathname);
    const label = findHitGroupLabel(navItems, location.pathname);
    setOpenGroups((prev) => {
      if (!label || prev.has(label)) return prev;
      return new Set(prev).add(label);
    });
  }
  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => setPendingPath(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingPath]);

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
          {navItems.map((item) =>
            item.children ? (
              <NavGroup
                key={item.label}
                item={item}
                collapsed={collapsed}
                open={openGroups.has(item.label)}
                onToggle={toggleGroup}
                pendingPath={pendingPath}
                setPendingPath={setPendingPath}
              />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setPendingPath(item.to)}
                className={({ isActive }) => navClass(pendingPath === item.to || isActive, collapsed)}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && <Tooltip label={item.label} />}
              </NavLink>
            )
          )}

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

/**
 * NavGroup -- 可折叠二级分组
 * 展开态：分组头（图标 + 标题 + chevron）点击 toggle，子项缩进带左竖线
 * 收起态：分组头纯图标，hover 弹出 flyout 面板（absolute 定位在 aside 右侧）
 */
function NavGroup({
  item,
  collapsed,
  open,
  onToggle,
  pendingPath,
  setPendingPath
}: {
  item: NavItem;
  collapsed: boolean;
  open: boolean;
  onToggle: (label: string) => void;
  pendingPath: string | null;
  setPendingPath: (path: string | null) => void;
}) {
  const location = useLocation();
  const childActive = item.children!.some((c) => c.to === location.pathname);

  if (collapsed) {
    return (
      <div className="group relative">
        <button
          type="button"
          onClick={() => onToggle(item.label)}
          className={`flex w-full items-center justify-center rounded-md px-0 py-2 text-sm transition duration-fast ease-out ${
            childActive ? "bg-primary/10 font-medium text-primary" : "font-normal text-text-muted hover:bg-bg hover:text-text"
          }`}
          aria-expanded={open}
          aria-label={item.label}
        >
          <span className="shrink-0">{item.icon}</span>
        </button>
        {/* flyout：hover 弹出子项面板，aside 无 overflow-hidden 不会被裁剪 */}
        <div className="pointer-events-none absolute left-full top-0 ml-2 z-dropdown w-44 rounded-lg border border-border bg-surface p-1.5 opacity-0 shadow-lg transition duration-fast ease-out group-hover:pointer-events-auto group-hover:opacity-100">
          <p className="px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-text-subtle">{item.label}</p>
          {item.children!.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.end}
              onClick={() => setPendingPath(c.to)}
              className={({ isActive }) => childNavClass(pendingPath === c.to || isActive)}
            >
              <span className="shrink-0">{c.icon}</span>
              <span className="truncate">{c.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onToggle(item.label)}
        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition duration-fast ease-out ${
          childActive ? "text-primary" : "text-text-muted hover:bg-bg hover:text-text"
        }`}
        aria-expanded={open}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
        <span
          className={`ml-auto shrink-0 text-text-subtle transition-transform duration-base ease-out ${open ? "-rotate-90" : ""}`}
        >
          <ChevronLeftIcon size={16} />
        </span>
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-3">
          {item.children!.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.end}
              onClick={() => setPendingPath(c.to)}
              className={({ isActive }) => childNavClass(pendingPath === c.to || isActive)}
            >
              <span className="shrink-0">{c.icon}</span>
              <span className="truncate">{c.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
