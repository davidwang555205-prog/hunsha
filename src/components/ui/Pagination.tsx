/**
 * Pagination -- 统一分页器（页码跳转 / 首页末页 / 每页条数）
 *
 * DRY：HistoryPage / AdminCreditsPage / AdminUsersPage 共用，替换各页手写的"上一页 [1/N] 下一页"。
 * total=0 不渲染；totalPages<=1 时翻页按钮 disabled，但仍展示"共 N 条 + 每页条数"，
 * 让用户明确知道分页机制存在（避免数据少时误以为没分页）。
 */
import { Button } from "./Button";
import { inputClass } from "../../studio/constants";

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

// pageList 生成页码数组，>7 页时中间用省略号折叠。
function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const arr: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) arr.push("…");
  for (let i = start; i <= end; i++) arr.push(i);
  if (end < total - 1) arr.push("…");
  arr.push(total);
  return arr;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  if (total <= 0) return null;
  const pages = pageList(page, Math.max(1, totalPages));

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(1)}>
        首页
      </Button>
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        上一页
      </Button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={
              "min-w-[32px] rounded-md px-2 py-1.5 text-sm transition " +
              (p === page
                ? "bg-primary text-white"
                : "bg-surface text-text ring-1 ring-border hover:bg-bg")
            }
          >
            {p}
          </button>
        )
      )}
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        下一页
      </Button>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
        末页
      </Button>
      {pageSizeOptions && onPageSizeChange && pageSize ? (
        <div className="relative ml-2">
          <select
            className={`${inputClass} !w-auto appearance-none pr-8 text-sm`}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s} 条/页
              </option>
            ))}
          </select>
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle"
          >
            <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}
      <span className="ml-1 text-xs text-text-muted">共 {total} 条</span>
    </div>
  );
}
