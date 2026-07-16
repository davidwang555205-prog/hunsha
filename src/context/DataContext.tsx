/**
 * DataContext -- 跨视图共享数据层
 *
 * 职责：history 统一 refresh + isLoading/error。
 * refresh() 并发拉 /status（拿 user）+ /api/v1/generation/history，移出组件。
 * 账号列表（原 accounts/summary）随 bridalauth 移除，admin 页面改走 listMembers 单独调。
 *
 * 变更频率：中（历史），位于 AuthContext 下层。
 * 依赖 useAuth：isAuthenticated 变化时自动 refresh。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getStatus } from "../api/auth";
import { getCreditBalance } from "../api/credits";
import { listHistory } from "../api/generation";
import { useAuth } from "./AuthContext";
import type { HistoryRecord } from "../types/api";

type DataContextValue = {
  history: HistoryRecord[];
  isLoading: boolean;
  error: string | null;
  /** 并发拉 status + history，刷新共享数据 */
  refresh: () => Promise<void>;
  /** 仅更新 history（生图成功后追加） */
  setHistory: (history: HistoryRecord[]) => void;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, refreshUser } = useAuth();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 防止 session 变化期间重复 refresh
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      // balance 单独降级：/api/credits/balance 失败不阻塞 status/history；
      // status 的 401 仍由 Promise.all 抛出触发 client 统一登出。
      const [status, historyPayload, balance] = await Promise.all([
        getStatus(),
        listHistory(),
        getCreditBalance().catch(() => null)
      ]);
      // /status 返回的 user.credits 是登录 session 快照，生图消耗后 session 不更新（team 模块不刷 credits）；
      // 用实时 balance 覆盖，让 AppHeader 外层积分随 refresh 实时扣减。
      refreshUser(balance ? { ...status.user, credits: balance.balance } : status.user);
      setHistory(historyPayload.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败。");
      // 401 已由 client 统一登出，此处仅记录非 401 错误
    } finally {
      setIsLoading(false);
      refreshingRef.current = false;
    }
  }, [refreshUser]);

  // isAuthenticated 变化时自动 refresh；登出时清空陈旧数据
  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory([]);
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  const value = useMemo<DataContextValue>(
    () => ({ history, isLoading, error, refresh, setHistory }),
    [history, isLoading, error, refresh]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData 必须在 <DataProvider> 内使用");
  return ctx;
}
