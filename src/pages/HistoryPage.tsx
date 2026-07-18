/**
 * HistoryPage -- 历史记录页
 *
 * 分页（每页 20）+ 时间范围筛选（今天/7天/30天/全部/自定义）
 * + 状态筛选（全部/成功/失败）+ 搜索（标题/正文/标签）。
 * 自定义时间范围用日期选择器，传 startTime/endTime（RFC3339）给后端。
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistoryPaged } from "../hooks/useHistoryPaged";
import { listHistoryPaged } from "../api/generation";
import { listMembers } from "../api/admin";
import { PageHeader } from "../components/layout/PageHeader";
import { HistoryCard } from "../components/history/HistoryCard";
import { HistoryDetailDrawer } from "../components/history/HistoryDetailDrawer";
import { XHSNotePanel } from "../components/history/XHSNotePanel";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { Pagination } from "../components/ui/Pagination";
import { inputClass } from "../studio/constants";
import { Modal } from "../components/ui/Modal";
import type { HistoryRecord, TeamMemberInfo } from "../types/api";

type RangeKey = "today" | "7d" | "30d" | "all" | "custom";

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "today", label: "今天" },
  { key: "7d", label: "近 7 天" },
  { key: "30d", label: "近 30 天" },
  { key: "all", label: "全部" },
  { key: "custom", label: "自定义" }
];

const statusOptions: { value: "" | "success" | "failed"; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" }
];

// select 自定义下拉箭头：配合 appearance-none 隐藏浏览器默认箭头，与输入框圆角描边风格统一
function SelectArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle">
      <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function rangeToDates(range: RangeKey): { startTime?: string; endTime?: string } {
  if (range === "all" || range === "custom") return {};
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

// YYYY-MM-DD -> RFC3339（start 00:00:00 / end 23:59:59）
function dateToISO(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function HistoryPage({ adminMode = false }: { adminMode?: boolean } = {}) {
  const { query, records, total, totalPages, isLoading, error, setPage, setFilter, setPageSize, refresh } = useHistoryPaged();
  const [detail, setDetail] = useState<HistoryRecord | null>(null);
  const [xhsRecord, setXhsRecord] = useState<HistoryRecord | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // adminMode 拉成员列表用于用户筛选下拉
  useEffect(() => {
    if (!adminMode) return;
    void listMembers()
      .then((r) => setMembers(r.members))
      .catch(() => {});
  }, [adminMode]);

  // 通知跳转：URL 带 taskId 时单查该记录并打开详情抽屉，随后清除参数避免重复打开
  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (!taskId) return;
    void listHistoryPaged({ taskId, pageSize: 1 })
      .then((r) => {
        if (r.history.length > 0) setDetail(r.history[0]);
      })
      .catch(() => {});
    searchParams.delete("taskId");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [message, setMessage] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const applyFilter = (nextRange: RangeKey, status: string, q: string, cStart?: string, cEnd?: string, userId?: string) => {
    const dates =
      nextRange === "custom"
        ? { startTime: dateToISO(cStart ?? customStart, false), endTime: dateToISO(cEnd ?? customEnd, true) }
        : rangeToDates(nextRange);
    const uid = userId !== undefined ? userId : selectedUserId;
    setFilter({
      ...dates,
      status: (status || undefined) as "success" | "failed" | undefined,
      q: q || undefined,
      userId: uid || undefined
    });
  };

  // adminMode 用户筛选
  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    const currentStatus = (query.status || "") as "" | "success" | "failed";
    applyFilter(range, currentStatus, searchInput, undefined, undefined, userId);
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer) clearTimeout(searchTimer);
    const currentStatus = (query.status || "") as "" | "success" | "failed";
    const t = setTimeout(() => applyFilter(range, currentStatus, value), 500);
    setSearchTimer(t);
  };

  const handleRangeChange = (next: RangeKey) => {
    // 自定义走弹窗：打开时不 setRange/不查，确认后才提交，避免状态不一致
    if (next === "custom") {
      setTempStart(customStart);
      setTempEnd(customEnd);
      setShowCustomModal(true);
      return;
    }
    setRange(next);
    const currentStatus = (query.status || "") as "" | "success" | "failed";
    applyFilter(next, currentStatus, searchInput);
  };

  // 弹窗确认：才 setRange(custom) + 提交查询
  const handleConfirmCustom = () => {
    setCustomStart(tempStart);
    setCustomEnd(tempEnd);
    setRange("custom");
    const currentStatus = (query.status || "") as "" | "success" | "failed";
    applyFilter("custom", currentStatus, searchInput, tempStart, tempEnd);
    setShowCustomModal(false);
  };

  const handleStatusChange = (status: "" | "success" | "failed") => {
    applyFilter(range, status, searchInput);
  };

  const currentPage = query.page ?? 1;
  const hasRecords = useMemo(() => records.length > 0, [records]);

  return (
    <>
      <PageHeader
        title={adminMode ? "生图历史（全部用户）" : "历史记录"}
        subtitle={`共 ${total} 条记录`}
        actions={<Button variant="secondary" size="sm" onClick={refresh} loading={isLoading}>刷新</Button>}
      />

      {/* 筛选栏 */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={rangeOptions.map((opt) => ({ value: opt.key, label: opt.label }))}
            value={range}
            onChange={(v) => handleRangeChange(v)}
            size="sm"
          />

          <div className="mx-1 h-5 w-px bg-border" />

          {adminMode && (
            <div className="relative shrink-0">
              <select
                className={`${inputClass} !w-40 appearance-none pr-9`}
                value={selectedUserId}
                onChange={(e) => handleUserChange(e.target.value)}
              >
                <option value="">全部用户</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.displayName || m.user.name || m.user.id}
                  </option>
                ))}
              </select>
              <SelectArrow />
            </div>
          )}

          {/* 状态 + 搜索同一组，组内 flex 不换行，确保两者始终在同一行 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative shrink-0">
              <select
                className={`${inputClass} !w-40 appearance-none pr-9`}
                value={query.status ?? ""}
                onChange={(e) => handleStatusChange(e.target.value as "" | "success" | "failed")}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <SelectArrow />
            </div>

            <div className="relative min-w-0 flex-1">
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
        </div>

        {/* 自定义范围：已选时展示文本，点「修改」重开弹窗 */}
        {range === "custom" && (customStart || customEnd) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm text-text-muted">
            <span>已选范围：</span>
            <span className="text-text">{customStart || "不限"} 至 {customEnd || "不限"}</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => { setTempStart(customStart); setTempEnd(customEnd); setShowCustomModal(true); }}
            >
              修改
            </Button>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setCustomStart("");
                setCustomEnd("");
                setRange("all");
                const currentStatus = (query.status || "") as "" | "success" | "failed";
                applyFilter("all", currentStatus, searchInput);
              }}
            >
              清空
            </Button>
          </div>
        )}
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
            <HistoryCard key={record.id} record={record} onOpenDetail={setDetail} onOpenXHS={setXhsRecord} onMessage={setMessage} />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无历史记录" description="生成内容后，记录会显示在这里。" />
      )}

      {/* 分页 */}
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
        pageSize={query.pageSize ?? 12}
        pageSizeOptions={[12, 20, 50]}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* 自定义时间范围弹窗：选起止日期，点确认才查询 */}
      <Modal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="自定义时间范围"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCustomModal(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleConfirmCustom} disabled={!tempStart || !tempEnd}>确认</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text">开始日期</span>
            <input type="date" className={inputClass} value={tempStart} onChange={(e) => setTempStart(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text">结束日期</span>
            <input type="date" className={inputClass} value={tempEnd} onChange={(e) => setTempEnd(e.target.value)} />
          </label>
          <p className="text-xs text-text-muted">选择起止日期后点「确认」，将查询该时间段内的记录。</p>
        </div>
      </Modal>

      <HistoryDetailDrawer
        record={detail}
        onClose={() => setDetail(null)}
        isAdmin={adminMode}
      />
      <Modal open={!!xhsRecord} onClose={() => setXhsRecord(null)} title="小红书发布数据" size="xl">
        {xhsRecord && <XHSNotePanel key={xhsRecord.id} taskId={xhsRecord.id} isAdmin={adminMode} initialURL={xhsRecord.feedback?.noteUrl} />}
      </Modal>
    </>
  );
}
