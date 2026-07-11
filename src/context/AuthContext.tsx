/**
 * AuthContext -- 认证全局状态层
 *
 * 职责：session/user/login/logout/refreshUser，token 持久化沿用 sessionStorageKey。
 * 统一 401 拦截：启动时向 api/client 注入 tokenGetter + unauthorizedHandler，
 *   遇 401 自动 logout（消除原 App.tsx 4+ 处重复 isUnauthorizedError -> handleLogout）。
 *
 * 变更频率：低（登录/登出/刷新 user），位于 Context 顶层。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setTokenGetter, setUnauthorizedHandler } from "../api/client";
import { login as apiLogin } from "../api/auth";
import type { AccountSummary, ApiUser, Session } from "../types/api";

const sessionStorageKey = "bridal-content-studio-session";

function loadStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  session: Session | null;
  user: ApiUser | null;
  isAuthenticated: boolean;
  /** 是否管理员（admin/super_admin） */
  isAdmin: boolean;
  /** 是否超级管理员 */
  isSuperAdmin: boolean;
  /** 登录成功后写入的 accounts（非 admin 为空） */
  loginAccounts: AccountSummary[];
  /** 登录，返回是否成功（失败抛错由调用方处理 UI） */
  login: (username: string, password: string) => Promise<void>;
  /** 登出：清 session + localStorage，附带清空回调 */
  logout: () => void;
  /** 登出并带错误信息（用于 401 被动登出） */
  logoutWithError: (message?: string) => void;
  /** 刷新当前用户信息（来自 /api/me 的 user） */
  refreshUser: (user: ApiUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 初始化时同步注入 tokenGetter，避免子组件（DataContext/CategoryContext）首屏 effect
  // 发请求时 tokenGetter 尚未注入导致 401（时序竞争）。
  const [session, setSession] = useState<Session | null>(() => {
    const stored = loadStoredSession();
    if (stored?.token) setTokenGetter(() => stored.token);
    return stored;
  });
  const [loginAccounts, setLoginAccounts] = useState<AccountSummary[]>([]);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // 持有最新 logout 引用，供 client 的 unauthorizedHandler 同步调用（避免闭包过期）
  const logoutRef = useRef<() => void>(() => {});

  const clearSession = useCallback(() => {
    setTokenGetter(() => null);
    setSession(null);
    setLoginAccounts([]);
    window.localStorage.removeItem(sessionStorageKey);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setLogoutError(null);
  }, [clearSession]);

  const logoutWithError = useCallback(
    (message?: string) => {
      clearSession();
      setLogoutError(message ?? "登录已失效。");
    },
    [clearSession]
  );

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const payload = await apiLogin({ username, password });
    const nextSession = { token: payload.token, user: payload.user };
    // 立即注入 token，避免 DataContext 的 effect 在 tokenGetter 更新前发起 401 请求
    setTokenGetter(() => nextSession.token);
    setSession(nextSession);
    setLoginAccounts(payload.accounts || []);
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
  }, []);

  const refreshUser = useCallback((user: ApiUser) => {
    setSession((current) => (current ? { ...current, user } : current));
  }, []);

  // 启动时注入 tokenGetter + unauthorizedHandler（统一 401 登出）
  useEffect(() => {
    setTokenGetter(() => session?.token ?? null);
  }, [session?.token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logoutRef.current();
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => {
      const role = session?.user.role;
      return {
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isAdmin: role === "admin" || role === "super_admin",
        isSuperAdmin: role === "super_admin",
        loginAccounts,
        login,
        logout,
        logoutWithError,
        refreshUser
      };
    },
    [session, loginAccounts, login, logout, logoutWithError, refreshUser]
  );

  // logoutError 暴露给消费方（如 LoginPage 展示被动登出原因）--通过自定义事件桥接，
  // 避免把错误塞进 value 触发全树重渲染。LoginPage 监听即可。
  useEffect(() => {
    if (logoutError) {
      window.dispatchEvent(new CustomEvent("auth:logout-error", { detail: logoutError }));
    }
  }, [logoutError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 <AuthProvider> 内使用");
  return ctx;
}
