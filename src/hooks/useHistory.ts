/**
 * useHistory -- 历史筛选/分页（前端分页，数据全量拉取自 DataContext）
 *
 * 筛选维度：状态（全部/成功/失败）、主题（全部/生成设置/内容）、日期范围。
 * 客户端分页：每页 PAGE_SIZE，"加载更多"。
 */
import { useMemo, useState } from "react";
import type { HistoryRecord } from "../types/api";

export type StatusFilter = "all" | "success" | "failed";
export type TopicFilter = "all" | "settings" | "content";

const PAGE_SIZE = 20;

export function useHistory(records: HistoryRecord[]) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [topicFilter, setTopicFilter] = useState<TopicFilter>("all");
  const [pageCount, setPageCount] = useState(1);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (topicFilter === "settings" && record.topic !== "生成设置") return false;
      if (topicFilter === "content" && record.topic === "生成设置") return false;
      return true;
    });
  }, [records, statusFilter, topicFilter]);

  // 当前页展示的记录（前 pageCount × PAGE_SIZE 条）
  const visible = useMemo(() => filtered.slice(0, pageCount * PAGE_SIZE), [filtered, pageCount]);
  const hasMore = visible.length < filtered.length;

  const loadMore = () => setPageCount((current) => current + 1);

  const resetPaging = () => setPageCount(1);

  return {
    statusFilter,
    topicFilter,
    setStatusFilter,
    setTopicFilter,
    filtered,
    visible,
    hasMore,
    loadMore,
    resetPaging,
    total: records.length,
    filteredCount: filtered.length
  };
}
