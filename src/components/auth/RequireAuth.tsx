/**
 * 路由守卫
 *
 * RequireAuth：需登录，否则跳 /login（保留来源 location）
 * RequireAdmin：需登录 + admin，否则跳 /（非 admin）或 /login（未登录）
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
