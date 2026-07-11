/**
 * AdminSubNav -- 管理后台子导航（苹果风格 tab）
 *
 * 在 /admin 下切换：概览 / 用户 / 模型线路 / 类目 / 积分记录。
 */
import { NavLink } from "react-router-dom";

const items = [
  { to: "/admin", label: "概览", end: true },
  { to: "/admin/users", label: "用户管理", end: false },
  { to: "/admin/channels", label: "模型线路", end: false },
  { to: "/admin/categories", label: "类目管理", end: false },
  { to: "/admin/credits", label: "积分记录", end: false }
];

export function AdminSubNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition duration-fast ease-out ${
      isActive ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-bg hover:text-text"
    }`;

  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1" aria-label="管理后台导航">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
