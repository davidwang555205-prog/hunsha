/**
 * AdminCreditsPage -- 积分记录（V2，苹果风格）
 *
 * 路由 /admin/credits。展示当前登录用户的积分变动记录。
 * 列表：时间/类型/金额/变动后余额/说明。
 * 管理员可通过用户管理页对其他用户充值，此处只看自己的记录。
 */
import { useEffect, useState } from "react";
import { listCreditTransactions } from "../../api/admin";
import { isUnauthorizedError } from "../../types/api";
import type { CreditTransaction } from "../../types/api";
import { AdminSubNav } from "../../components/admin/AdminSubNav";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { formatDate } from "../../lib/format";

const typeLabel: Record<CreditTransaction["type"], { text: string; cls: string }> = {
  recharge: { text: "充值", cls: "bg-success/10 text-success" },
  consume: { text: "消费", cls: "bg-danger/10 text-danger" },
  adjust: { text: "调整", cls: "bg-primary/10 text-primary" }
};

export function AdminCreditsPage() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await listCreditTransactions();
      setTransactions(payload.transactions);
    } catch (err) {
      if (!isUnauthorizedError(err)) setError(err instanceof Error ? err.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetch();
  }, []);

  return (
    <>
      <PageHeader
        title="积分记录"
        subtitle="当前账号的积分变动明细"
        actions={<Button variant="secondary" size="sm" onClick={fetch} loading={isLoading}>刷新</Button>}
      />
      <AdminSubNav />

      {error && <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto brand-scrollbar">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["时间", "类型", "金额", "变动后余额", "说明"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-border py-3 px-4 text-xs font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const badge = typeLabel[t.type] ?? typeLabel.adjust;
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-bg">
                    <td className="px-4 py-3 text-text-muted">{formatDate(t.createdAt)}</td>
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
                <tr><td colSpan={5} className="py-8 text-center text-sm text-text-muted">暂无积分记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
