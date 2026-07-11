/**
 * AdminPage -- 管理后台概览（V2，苹果风格）
 *
 * 路由 /admin。数据统计 Dashboard：
 * - 今日生图总数、成功率、平均耗时
 * - 账号数量、总请求、成功/失败
 * - 各模型线路使用占比
 * - 用户活跃度排行
 *
 * 数据从 DataContext 的 accounts + 历史聚合。
 */
import { useMemo } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { AdminSubNav } from "../../components/admin/AdminSubNav";
import { PageHeader } from "../../components/layout/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { formatDate } from "../../lib/format";
import type { AccountSummary } from "../../types/api";

export function AdminPage() {
  const { accounts } = useData();
  const { isSuperAdmin } = useAuth();

  const totals = useMemo(
    () =>
      accounts.reduce(
        (acc, a) => ({
          requestCount: acc.requestCount + a.requestCount,
          successCount: acc.successCount + a.successCount,
          failedCount: acc.failedCount + a.failedCount,
          images: acc.images + a.generatedImageCount,
          dailyImages: acc.dailyImages + a.dailyGeneratedImageCount
        }),
        { requestCount: 0, successCount: 0, failedCount: 0, images: 0, dailyImages: 0 }
      ),
    [accounts]
  );

  const successRate = totals.requestCount > 0 ? Math.round((totals.successCount / totals.requestCount) * 100) : 0;

  // 用户活跃度排行（按请求数降序，取前 10）
  const ranked = useMemo(
    () => [...accounts].sort((a, b) => b.requestCount - a.requestCount).slice(0, 10),
    [accounts]
  );

  return (
    <>
      <PageHeader title="管理后台" subtitle="平台数据概览与运营管理" />
      <AdminSubNav />

      {/* 统计卡片 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="账号数量" value={accounts.length} tone="primary" />
        <StatCard label="今日生图" value={totals.dailyImages} tone="accent" suffix="张" />
        <StatCard label="总请求数" value={totals.requestCount} tone="primary" />
        <StatCard label="成功率" value={successRate} tone="success" suffix="%" />
        <StatCard label="生成图片总数" value={totals.images} tone="warning" suffix="张" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* 用户活跃度排行 */}
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-text">用户活跃度排行</h2>
          {ranked.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">暂无数据</p>
          ) : (
            <div className="overflow-x-auto brand-scrollbar">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border py-2 text-xs font-medium text-text-muted">账号</th>
                    <th className="border-b border-border py-2 text-xs font-medium text-text-muted">角色</th>
                    <th className="border-b border-border py-2 text-xs font-medium text-text-muted">积分</th>
                    <th className="border-b border-border py-2 text-xs font-medium text-text-muted">请求数</th>
                    <th className="border-b border-border py-2 text-xs font-medium text-text-muted">图片数</th>
                    <th className="border-b border-border py-2 text-xs font-medium text-text-muted">最近活跃</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((a) => (
                    <UserRow key={a.user.id} account={a} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 平台信息 */}
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-text">平台信息</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">成功请求</dt>
              <dd className="font-medium text-success">{totals.successCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">失败请求</dt>
              <dd className="font-medium text-danger">{totals.failedCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">数据保留</dt>
              <dd className="font-medium text-text">180 天</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">当前角色</dt>
              <dd className="font-medium text-text">{isSuperAdmin ? "超级管理员" : "管理员"}</dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-border pt-4 text-xs text-text-subtle">
            如需配置模型线路、类目或管理用户积分，请使用上方导航切换。
          </div>
        </section>
      </div>
    </>
  );
}

function UserRow({ account }: { account: AccountSummary }) {
  const roleLabel = account.user.role === "super_admin" ? "超管" : account.user.role === "admin" ? "管理员" : "用户";
  return (
    <tr className="border-b border-border/50 hover:bg-bg">
      <td className="py-2.5 font-medium text-text">{account.user.displayName || account.user.username}</td>
      <td className="py-2.5">
        <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-text-muted">{roleLabel}</span>
      </td>
      <td className="py-2.5 text-text">{account.credits}</td>
      <td className="py-2.5 text-text">{account.requestCount}</td>
      <td className="py-2.5 text-text">{account.generatedImageCount}</td>
      <td className="py-2.5 text-xs text-text-muted">
        {account.lastGeneratedAt ? formatDate(account.lastGeneratedAt) : "—"}
      </td>
    </tr>
  );
}
