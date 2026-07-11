/**
 * AppHeader -- 全局顶栏（苹果风格）
 *
 * 左：Logo + 品牌名 + 类目切换下拉
 * 右：导航（内容生成/历史记录/后台管理）+ 用户信息 + 退出
 *
 * 设计：纯白底 + 极淡边框 + 极淡阴影，无玻璃态/渐变。sticky 顶部。
 */
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCategory } from "../../context/CategoryContext";
import { Button } from "../ui/Button";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition duration-fast ease-out ${
    isActive ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-bg hover:text-text"
  }`;

export function AppHeader() {
  const { session, isAdmin, logout } = useAuth();
  const { categories, currentCategory, setCurrentCategoryId } = useCategory();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 左：Logo + 类目 */}
        <div className="flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="font-display text-base font-semibold tracking-tight text-text">
              Bridal &amp; Dress
            </span>
          </NavLink>

          {/* 类目切换下拉 */}
          {categories.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition duration-fast ease-out hover:bg-bg hover:text-text"
              >
                <span>{currentCategory?.icon}</span>
                <span>{currentCategory?.name ?? "选择类目"}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCurrentCategoryId(c.id);
                          setMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition duration-fast ease-out hover:bg-bg ${
                          c.id === currentCategory?.id ? "text-primary" : "text-text"
                        }`}
                      >
                        <span>{c.icon}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 右：导航 + 用户 */}
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              内容生成
            </NavLink>
            <NavLink to="/history" className={navLinkClass}>
              历史记录
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                后台管理
              </NavLink>
            )}
          </nav>

          <div className="mx-2 h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-text-muted sm:inline">
              {session?.user.displayName}
              {session?.user.role === "super_admin" && " · 超管"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              退出
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
