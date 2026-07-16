/**
 * AdminPage -- 管理后台概览（team 认证版）
 *
 * 路由 /admin。三段布局：
 * ① 账号 / 数据保留 / 平台信息 三卡并排（lg:grid-cols-3，信息完整不截断）
 * ② 6 张数据卡（StatCard 带 sparkline + 环比，趋势数据来自 getStatsTrend）
 * ③ 趋势图：总生图成功率 + 分模型链路成功率（纯 SVG TrendLineChart，最近 14 天）
 *
 * 数据：listMembers（成员数）、getStats（累计统计）、getStatsTrend（14 天按天趋势）、
 * listSettings/updateSetting（retention_days）。
 * 视觉：苹果风格克制 -- ring-1 ring-border 描边 + shadow-sm + rounded-lg，语义色仅点缀。
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { listMembers, listSettings, updateSetting } from "../../api/admin";
import { getStats, getStatsTrend } from "../../api/generation";
import { isUnauthorizedError } from "../../types/api";
import type { GenerationStats, GenerationStatsTrend } from "../../types/api";
import { PageHeader } from "../../components/layout/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { TrendLineChart, type TrendSeries } from "../../components/charts/TrendLineChart";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

// 语义色（与 tokens.css 一致，传给 TrendLineChart series.color）
const COLOR_PRIMARY = "rgb(var(--color-primary))";
const COLOR_SUCCESS = "rgb(var(--color-success))";
const COLOR_ACCENT = "rgb(var(--color-accent))";
const COLOR_WARNING = "rgb(var(--color-warning))";
const COLOR_DANGER = "rgb(var(--color-danger))";
// 分模型链路配色循环（苹果克制：靛紫为主，粉红/琥珀/绿/红点缀）
const CHANNEL_COLORS = [COLOR_PRIMARY, COLOR_ACCENT, COLOR_WARNING, COLOR_SUCCESS, COLOR_DANGER];

type Delta = { value: string; up: boolean; invert?: boolean } | null;

export function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [memberCount, setMemberCount] = useState(0);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [trend, setTrend] = useState<GenerationStatsTrend | null>(null);

  // 数据保留天数（retention_days）
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [editingDays, setEditingDays] = useState("");
  const [savingDays, setSavingDays] = useState(false);
  const [daysMsg, setDaysMsg] = useState("");

  const roleLabel =
    user?.role === "enterprise" ? "团队所有者" : user?.role === "admin" ? "管理员" : "成员";

  // 首字母头像：取 displayName/username/email 首字母大写，兜底 A
  const initial = (user?.displayName || user?.username || user?.email || "A").trim().charAt(0).toUpperCase();

  useEffect(() => {
    listMembers()
      .then((r) => setMemberCount(r.members.length))
      .catch(() => {});
    getStats()
      .then(setStats)
      .catch((err) => {
        if (!isUnauthorizedError(err)) {
          /* 静默：统计加载失败不阻塞概览其他部分 */
        }
      });
    getStatsTrend(14)
      .then(setTrend)
      .catch((err) => {
        if (!isUnauthorizedError(err)) {
          /* 静默：趋势加载失败不阻塞概览 */
        }
      });
    listSettings()
      .then((r) => {
        const rec = r.settings.find((s) => s.key === "retention_days");
        const days = rec?.value?.days;
        if (typeof days === "number" && days > 0) {
          setRetentionDays(days);
          setEditingDays(String(days));
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveDays = async () => {
    const n = Math.floor(Number(editingDays));
    if (!Number.isFinite(n) || n <= 0) {
      setDaysMsg("请输入大于 0 的整数。");
      return;
    }
    setSavingDays(true);
    setDaysMsg("");
    try {
      await updateSetting("retention_days", { value: { days: n } });
      setRetentionDays(n);
      setDaysMsg(`已保存：历史保留 ${n} 天。`);
    } catch (err) {
      if (!isUnauthorizedError(err)) setDaysMsg(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSavingDays(false);
    }
  };

  const lastGeneratedText =
    stats && stats.lastGeneratedAt
      ? new Date(stats.lastGeneratedAt * 1000).toLocaleString("zh-CN")
      : "暂无";

  // 派生趋势序列与环比（趋势失败时 days=[] 自然降级为空）
  const days = trend?.days ?? [];
  const labels = days.map((d) => d.date.slice(5)); // MM-DD
  const pick = (key: "total" | "success" | "failed" | "images") => days.map((d) => d[key]);
  const totalArr = pick("total");
  const successArr = pick("success");
  const failedArr = pick("failed");
  const imagesArr = pick("images");

  const deltaOf = (arr: number[]): Delta => {
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    if (prev === 0) return last > 0 ? { value: "新增", up: true } : null;
    const pct = Math.round(((last - prev) / prev) * 100);
    if (pct === 0) return null;
    return { value: `${Math.abs(pct)}%`, up: pct > 0 };
  };
  const failedDelta = deltaOf(failedArr);

  // 总成功率（每日 success/total*100，无任务日记 0）
  const successRateArr = days.map((d) => (d.total > 0 ? Math.round((d.success / d.total) * 100) : 0));
  // 分模型链路成功率
  const channelSeries: TrendSeries[] = (trend?.channels ?? []).map((ch, i) => ({
    name: ch.channelName,
    color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    data: ch.days.map((d) => (d.total > 0 ? Math.round((d.success / d.total) * 100) : 0))
  }));

  return (
    <>
      <PageHeader title="管理后台" subtitle="平台数据概览与运营管理" />

      {/* ① 账号 / 数据保留 / 平台信息 三卡并排 */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border">
          <h2 className="mb-4 text-base font-semibold text-text">账号</h2>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-h3 font-semibold text-text">
                {user?.displayName || user?.username || user?.email}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <span className="truncate">{user?.email}</span>
                <Badge variant="primary">{roleLabel}</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-primary-50 px-4 py-2.5">
              <p className="text-caption text-text-muted">积分余额</p>
              <p className="mt-0.5 text-xl font-bold text-primary">{user?.credits ?? 0}</p>
            </div>
            <div className="rounded-md bg-bg px-4 py-2.5">
              <p className="text-caption text-text-muted">每日额度</p>
              <p className="mt-0.5 text-xl font-bold text-text">{isAdmin ? "不限" : user?.dailyImageLimit ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border">
          <h2 className="mb-4 text-base font-semibold text-text">数据保留</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-32">
              <Input
                type="number"
                value={editingDays}
                onChange={(e) => setEditingDays(e.target.value)}
                placeholder="如 180"
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleSaveDays} loading={savingDays}>
              保存
            </Button>
          </div>
          <p className="mt-3 text-sm text-text-muted">
            当前：{retentionDays ? `${retentionDays} 天` : "未配置（默认 180 天）"}
          </p>
          <p className="mt-2 text-xs text-text-subtle">
            超过该天数的历史（含图片）将由后台定时任务逻辑删除（标记删除，MinIO 文件保留）。
          </p>
          {daysMsg && <p className="mt-2 text-sm text-text-muted">{daysMsg}</p>}
        </div>

        <div className="rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border">
          <h2 className="mb-4 text-base font-semibold text-text">平台信息</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">当前角色</dt>
              <dd className="text-right font-medium text-text">{roleLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">最近生图</dt>
              <dd className="text-right font-medium text-text">{lastGeneratedText}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">认证模式</dt>
              <dd className="text-right font-medium text-text">team session</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ② 6 张数据卡（带 sparkline + 环比） */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="成员数量" value={memberCount} tone="primary" />
        <StatCard
          label="生成总数"
          value={stats?.requestCount ?? 0}
          tone="primary"
          trend={totalArr}
          delta={deltaOf(totalArr)}
        />
        <StatCard
          label="成功生成"
          value={stats?.successCount ?? 0}
          tone="success"
          trend={successArr}
          delta={deltaOf(successArr)}
        />
        <StatCard
          label="生成失败"
          value={stats?.failedCount ?? 0}
          tone="danger"
          trend={failedArr}
          delta={failedDelta ? { ...failedDelta, invert: true } : null}
        />
        <StatCard
          label="生成图片数"
          value={stats?.imageCount ?? 0}
          tone="primary"
          trend={imagesArr}
          delta={deltaOf(imagesArr)}
        />
        <StatCard
          label="今日生成图片"
          value={stats?.dailyImages ?? 0}
          tone="warning"
          trend={imagesArr}
          delta={deltaOf(imagesArr)}
        />
      </section>

      {/* ③ 趋势图：总成功率 + 分模型链路 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border">
          <h2 className="text-base font-semibold text-text">生图成功率趋势</h2>
          <p className="mb-3 mt-0.5 text-caption text-text-subtle">最近 14 天每日成功率（成功 / 总任务）</p>
          <TrendLineChart
            labels={labels}
            series={[{ name: "总成功率", data: successRateArr, color: COLOR_PRIMARY }]}
            yMode="percent"
            ySuffix="%"
            height={200}
          />
        </div>
        <div className="rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border">
          <h2 className="text-base font-semibold text-text">分模型链路成功率</h2>
          <p className="mb-3 mt-0.5 text-caption text-text-subtle">最近 14 天各线路成功率</p>
          <TrendLineChart
            labels={labels}
            series={channelSeries}
            yMode="percent"
            ySuffix="%"
            height={200}
            emptyHint="暂无分线路数据（任务未关联线路）"
          />
        </div>
      </section>
    </>
  );
}
