/**
 * AdminCreditsPage -- 积分记录（全平台）
 *
 * 路由 /admin/credits。展示全平台积分变动记录（分页 + 筛选）。
 * 列表：时间 / 用户（名称+邮箱）/ 类型 / 金额 / 变动后余额 / 说明。
 * 筛选：用户（listMembers）/ 类型 / 时间范围。支持 URL ?userId 预设。
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listAllCreditTransactions, listMembers } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { CreditTransaction, TeamMemberInfo } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { inputClass } from "../../studio/constants";
import { formatDate, pickUserLabel } from "../../lib/format";

const typeLabel: Record<CreditTransaction["type"], { text: string; cls: string }> = {
  recharge: { text: "充值", cls: "bg-success/10 text-success" },
  consume: { text: "消费", cls: "bg-danger/10 text-danger" },
  adjust: { text: "调整", cls: "bg-primary/10 text-primary" }
};

const typeOptions = [
  { value: "", label: "全部类型" },
  { value: "recharge", label: "充值" },
  { value: "consume", label: "消费" },
  { value: "adjust", label: "调整" }
];

export function AdminCreditsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterUserId, setFilterUserId] = useState(searchParams.get("userId") ?? "");
  const [filterType, setFilterType] = useState(searchParams.get("type") ?? "");
  const [filterStart, setFilterStart] = useState(searchParams.get("startDate") ?? "");
  const [filterEnd, setFilterEnd] = useState(searchParams.get("endDate") ?? "");

  const fetchTransactions = async (p: number, size: number = pageSize) => {
    setIsLoading(true);
    setError(null);
    try {
      const filter: { userId?: string; type?: string; startTime?: string; endTime?: string } = {};
      if (filterUserId) filter.userId = filterUserId;
      if (filterType) filter.type = filterType;
      if (filterStart) filter.startTime = `${filterStart}T00:00:00Z`;
      if (filterEnd) filter.endTime = `${filterEnd}T23:59:59Z`;
      const payload = await listAllCreditTransactions(p, size, filter);
      setTransactions(payload.transactions);
      setTotal(payload.total);
      setPage(payload.page);
    } catch (err) {
      if (!isUnauthorizedError(err)) setError(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    void fetchTransactions(1, size);
  };

  const fetchMembers = async () => {
    try {
      const payload = await listMembers();
      setMembers(payload.members);
    } catch {
      // 忽略，筛选下拉为空不影响列表
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void fetchMembers();
    void fetchTransactions(1);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = () => {
    const params: Record<string, string> = {};
    if (filterUserId) params.userId = filterUserId;
    if (filterType) params.type = filterType;
    if (filterStart) params.startDate = filterStart;
    if (filterEnd) params.endDate = filterEnd;
    setSearchParams(params, { replace: true });
    void fetchTransactions(1);
  };

  const resetFilter = () => {
    setFilterUserId("");
    setFilterType("");
    setFilterStart("");
    setFilterEnd("");
    setSearchParams({}, { replace: true });
    void fetchTransactions(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        title="积分记录"
        subtitle={`全平台积分变动明细 · 共 ${total} 条`}
        actions={<Button variant="secondary" size="sm" onClick={() => fetchTransactions(page)} loading={isLoading}>刷新</Button>}
      />

      {error && <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      {/* 筛选 */}
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="用户">
            <select className={inputClass} value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
              <option value="">全部用户</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {pickUserLabel(m.user)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="类型">
            <select className={inputClass} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="开始日期">
            <input type="date" className={inputClass} value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
          </Field>
          <Field label="结束日期">
            <input type="date" className={inputClass} value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={applyFilter}>筛选</Button>
          <Button variant="ghost" size="sm" onClick={resetFilter}>重置</Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                {["时间", "用户", "类型", "金额", "变动后余额", "说明"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border py-3 px-4 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const badge = typeLabel[t.type] ?? typeLabel.adjust;
                const userLabel = pickUserLabel(t);
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-bg">
                    <td className="px-4 py-3 text-text-muted">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{userLabel}</div>
                      <div className="text-xs text-text-muted">{t.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.text}</span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
                      {t.amount >= 0 ? "+" : ""}{t.amount}
                    </td>
                    <td className="px-4 py-3 text-text">{t.balanceAfter}</td>
                    <td className="px-4 py-3 text-text-muted">{t.description || "-"}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-text-muted">暂无积分记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={[12, 20, 50]}
        onPageChange={(p) => void fetchTransactions(p)}
        onPageSizeChange={handlePageSizeChange}
      />
    </>
  );
}
