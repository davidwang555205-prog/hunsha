/**
 * 路由守卫
 *
 * RequireAuth：需登录，否则跳 /login（保留来源 location）
 * RequireAdmin：需登录 + admin，否则：
 *   - 未登录：跳 /login
 *   - 已登录非管理员访问白名单路径（/admin/profile）：放行
 *   - 已登录非管理员访问其他 /admin/*：跳 /admin/profile（不白屏不 403）
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** 已登录非管理员可见的 /admin 白名单路径前缀（/admin/profile 及其子路径） */
const NON_ADMIN_ALLOWED_PREFIXES = ["/admin/profile"];

/** 判断路径是否属于非管理员白名单（精确匹配或前缀+"/"开头）。导出以便单测覆盖。 */
export function isNonAdminAllowedPath(pathname: string): boolean {
  return NON_ADMIN_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // 初始密码强制改密：mustChangePassword=true 且不在改密页，跳转强制改密
  if (user?.mustChangePassword && !location.pathname.startsWith("/change-password")) {
    return <Navigate to="/change-password?force=1" replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!isAdmin) {
    // 非管理员：白名单路径放行，其余 /admin/* 统一跳个人中心
    if (isNonAdminAllowedPath(location.pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/admin/profile" replace />;
  }
  return <>{children}</>;
}
