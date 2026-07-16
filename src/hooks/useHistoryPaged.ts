/**
 * useHistoryPaged -- 历史记录分页查询（V2）
 *
 * 封装 listHistoryPaged：page/pageSize/status/startDate/endDate/q。
 * 支持翻页、筛选变更时回到第 1 页。loading/error 状态。
 */
import { useCallback, useEffect, useState } from "react";
import { listHistoryPaged } from "../api/generation";
import { useAuth } from "../context/AuthContext";
import type { HistoryQuery, HistoryRecord } from "../types/api";

const defaultQuery: HistoryQuery = { page: 1, pageSize: 12 };

export function useHistoryPaged() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState<HistoryQuery>(defaultQuery);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(
    async (q: HistoryQuery) => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      setError(null);
      try {
        const payload = await listHistoryPaged(q);
        setRecords(payload.history);
        setTotal(payload.total);
      } catch (err) {
        // 401 由 client 统一处理
        setError(err instanceof Error ? err.message : "加载历史失败。");
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    // 数据查询：query 变化时 fetch + setState（初始化加载模式）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetch(query);
  }, [query, fetch]);

  const setPage = useCallback((page: number) => setQuery((q) => ({ ...q, page })), []);
  const setFilter = useCallback((patch: Omit<HistoryQuery, "page">) => setQuery({ ...patch, page: 1 }), []);
  const refresh = useCallback(() => void fetch(query), [fetch, query]);
  const setPageSize = useCallback((size: number) => setQuery((q) => ({ ...q, pageSize: size, page: 1 })), []);

  const totalPages = Math.max(1, Math.ceil(total / (query.pageSize ?? 12)));

  return {
    query,
    records,
    total,
    totalPages,
    isLoading,
    error,
    setPage,
    setFilter,
    setPageSize,
    refresh
  };
}
