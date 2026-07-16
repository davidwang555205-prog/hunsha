/**
 * AuthContext -- 认证全局状态层（team cookie session）
 *
 * 职责：user/login/logout，启动时调 /status 确认登录态（cookie 有效则恢复 user）。
 * 统一 401 拦截：启动时向 api/client 注入 unauthorizedHandler，遇 401 自动登出。
 *
 * 变更频率：低（登录/登出/刷新 user），位于 Context 顶层。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "../api/client";
import { login as apiLogin, getStatus, logout as apiLogout } from "../api/auth";
import type { ApiUser } from "../types/api";

type AuthContextValue = {
  user: ApiUser | null;
  isAuthenticated: boolean;
  /** 是否管理员（enterprise=团队所有者 / admin=系统管理员，不限额度） */
  isAdmin: boolean;
  /** 登录，失败抛错由调用方处理 UI */
  login: (email: string, password: string) => Promise<void>;
  /** 主动登出：调 team logout 清 cookie + 清 user */
  logout: () => void;
  /** 被动登出（401）：不调 logout 接口（session 已失效），仅清 user + 错误提示 */
  logoutWithError: (message?: string) => void;
  /** 刷新当前用户信息（来自 /status 的 user） */
  refreshUser: (user: ApiUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  // 启动 status 检查完成标志：未完成时不渲染子树，避免子组件 effect 在登录态确认前
  // 发请求触发 401（时序竞争），也避免已登录用户首屏闪现登录页。
  const [ready, setReady] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // 持有最新 logout 引用，供 client 的 unauthorizedHandler 同步调用（避免闭包过期）
  const logoutRef = useRef<() => void>(() => {});

  const logout = useCallback(() => {
    void apiLogout().catch(() => {});
    setUser(null);
    setLogoutError(null);
  }, []);

  const logoutWithError = useCallback((message?: string) => {
    setUser(null);
    setLogoutError(message ?? "登录已失效。");
  }, []);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin({ email, password });
    setUser(u);
  }, []);

  const refreshUser = useCallback((u: ApiUser) => setUser(u), []);

  // 启动：调 status 确认登录态（cookie 有效则恢复 user）
  useEffect(() => {
    let cancelled = false;
    getStatus()
      .then((tu) => {
        if (!cancelled) setUser(tu.user);
      })
      .catch(() => {
        // 未登录或 session 失效，user 保持 null
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 注入 401 处理器（统一 401 登出）
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logoutRef.current();
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === "enterprise" || user?.role === "admin",
      login,
      logout,
      logoutWithError,
      refreshUser
    }),
    [user, login, logout, logoutWithError, refreshUser]
  );

  // logoutError 暴露给消费方（如 LoginPage 展示被动登出原因）--通过自定义事件桥接，
  // 避免把错误塞进 value 触发全树重渲染。LoginPage 监听即可。
  useEffect(() => {
    if (logoutError) {
      window.dispatchEvent(new CustomEvent("auth:logout-error", { detail: logoutError }));
    }
  }, [logoutError]);

  if (!ready) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 <AuthProvider> 内使用");
  return ctx;
}
