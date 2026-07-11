/**
 * DataContext -- 跨视图共享数据层
 *
 * 职责：history/accounts/summary 统一 refresh + isLoading/error。
 * refresh() 并发拉 /api/me + /api/v1/generation/history，移出组件。
 *
 * 变更频率：中（历史/账号/概要），位于 AuthContext 下层。
 * 依赖 useAuth：session 变化时自动 refresh。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getMe } from "../api/auth";
import { listHistory } from "../api/generation";
import { useAuth } from "./AuthContext";
import type { AccountSummary, HistoryRecord, Summary } from "../types/api";

type DataContextValue = {
  history: HistoryRecord[];
  accounts: AccountSummary[];
  summary: Summary | null;
  isLoading: boolean;
  error: string | null;
  /** 并发拉 me + history，刷新全部共享数据 */
  refresh: () => Promise<void>;
  /** 仅更新 accounts（admin 操作后局部回填，避免全量刷新闪烁） */
  setAccounts: (accounts: AccountSummary[]) => void;
  /** 仅更新 history（生图成功后追加） */
  setHistory: (history: HistoryRecord[]) => void;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, refreshUser } = useAuth();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
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
      const [me, historyPayload] = await Promise.all([getMe(), listHistory()]);
      refreshUser(me.user);
      setSummary(me.summary);
      setAccounts(me.accounts || []);
      setHistory(historyPayload.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败。");
      // 401 已由 client 统一登出，此处仅记录非 401 错误
    } finally {
      setIsLoading(false);
      refreshingRef.current = false;
    }
  }, [refreshUser]);

  // session 变化时自动 refresh（替代原 App.tsx 的 useEffect）
  const token = session?.token;
  // session 变化时自动 refresh；登出时清空陈旧数据
  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory([]);
      setSummary(null);
      return;
    }
    void refresh();
  }, [token, refresh]);

  const value = useMemo<DataContextValue>(
    () => ({ history, accounts, summary, isLoading, error, refresh, setAccounts, setHistory }),
    [history, accounts, summary, isLoading, error, refresh]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData 必须在 <DataProvider> 内使用");
  return ctx;
}
