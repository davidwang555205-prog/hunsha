/**
 * HistoryPage -- 历史记录页（V2，苹果风格）
 *
 * 分页（每页 20）+ 时间范围筛选（今天/7天/30天/全部/自定义）
 * + 状态筛选（全部/成功/失败）+ 搜索（标题/正文/标签）。
 * 卡片式展示，点击展开详情抽屉，支持复制/下载。
 */
import { useMemo, useState } from "react";
import { useHistoryPaged } from "../hooks/useHistoryPaged";
import { PageHeader } from "../components/layout/PageHeader";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryDetailDrawer } from "../components/history/HistoryDetailDrawer";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { inputClass } from "../studio/constants";
import type { HistoryRecord } from "../types/api";

type RangeKey = "today" | "7d" | "30d" | "all";

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "today", label: "今天" },
  { key: "7d", label: "近 7 天" },
  { key: "30d", label: "近 30 天" },
  { key: "all", label: "全部" }
];

const statusOptions: { value: "" | "success" | "failed"; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" }
];

function rangeToDates(range: RangeKey): { startDate?: string; endDate?: string } {
  if (range === "all") return {};
  const now = new Date();
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  if (range === "today") {
    // 今天：start = 今天 00:00
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function HistoryPage() {
  const { query, records, total, totalPages, isLoading, error, setPage, setFilter, refresh } = useHistoryPaged();
  const [detail, setDetail] = useState<HistoryRecord | null>(null);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [searchInput, setSearchInput] = useState("");

  // 搜索防抖：输入后 500ms 触发
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer) clearTimeout(searchTimer);
    const currentStatus = (query.status || "") as "" | "success" | "failed";
    const t = setTimeout(() => {
      setFilter({ ...rangeToDates(range), status: currentStatus || undefined, q: value || undefined });
    }, 500);
    setSearchTimer(t);
  };

  const handleRangeChange = (next: RangeKey) => {
    setRange(next);
    const currentStatus = (query.status || "") as "" | "success" | "failed";
    setFilter({ ...rangeToDates(next), status: currentStatus || undefined, q: searchInput || undefined });
  };

  const handleStatusChange = (status: "" | "success" | "failed") => {
    setFilter({ ...rangeToDates(range), status: status || undefined, q: searchInput || undefined });
  };

  const currentPage = query.page ?? 1;
  const hasRecords = useMemo(() => records.length > 0, [records]);

  return (
    <>
      <PageHeader
        title="历史记录"
        subtitle={`共 ${total} 条记录`}
        actions={<Button variant="secondary" size="sm" onClick={refresh} loading={isLoading}>刷新</Button>}
      />

      {/* 筛选栏 */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleRangeChange(opt.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition duration-fast ease-out ${
                range === opt.key ? "bg-primary text-white" : "bg-bg text-text-muted hover:text-text"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="mx-1 h-5 w-px bg-border" />

          <select
            className={`${inputClass} w-32`}
            value={query.status ?? ""}
            onChange={(e) => handleStatusChange(e.target.value as "" | "success" | "failed")}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              className={`${inputClass} pl-9`}
              placeholder="搜索标题、正文或标签"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
            />
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {message && <p className="text-sm text-text-muted">{message}</p>}
      </div>

      {/* 列表 */}
      {isLoading && records.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Spinner size={28} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      ) : hasRecords ? (
        <div className="flex flex-col gap-4">
          {records.map((record) => (
            <HistoryCard key={record.id} record={record} onOpenDetail={setDetail} onMessage={setMessage} />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无历史记录" description="生成内容后，记录会显示在这里。" />
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
            上一页
          </Button>
          <span className="px-3 text-sm text-text-muted">
            {currentPage} / {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
            下一页
          </Button>
        </div>
      )}

      <HistoryDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </>
  );
}
