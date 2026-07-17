import { useEffect, useMemo, useState } from "react";
import { TrendLineChart } from "../charts/TrendLineChart";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { getXHSNote, importXHSNote, refreshXHSNote } from "../../api/generation";
import type { XHSNoteSnapshot, XHSNoteTracking } from "../../types/api";

type XHSNotePanelProps = {
  taskId: string;
  isAdmin: boolean;
  initialURL?: string;
};

const number = new Intl.NumberFormat("zh-CN");

function snapshotTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function change(current: number, previous?: number) {
  if (previous === undefined) return "—";
  const delta = current - previous;
  return `${delta > 0 ? "+" : ""}${number.format(delta)}`;
}

export function XHSNotePanel({ taskId, isAdmin, initialURL = "" }: XHSNotePanelProps) {
  const [note, setNote] = useState<XHSNoteTracking | null>(null);
  const [noteURL, setNoteURL] = useState(initialURL);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await getXHSNote(taskId);
      setNote(result.note);
      setNoteURL(result.note.noteUrl);
    } catch {
      // 未关联笔记是首次打开的正常状态；提交操作会展示真实请求错误。
      setNote(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 延后到 effect 完成后发起请求，避免 React 同步 effect-state 级联更新告警。
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // taskId 切换时重新拉取；load 不宜作为依赖导致无意义重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const latest = note && note.snapshots.length > 0 ? note.snapshots[note.snapshots.length - 1] : undefined;
  const labels = useMemo(
    () => (note?.snapshots ?? []).map((snapshot) => snapshotTime(snapshot.capturedAt).slice(5, 16)),
    [note]
  );

  const submitImport = async () => {
    const value = noteURL.trim();
    if (!value) {
      setError("请填写小红书笔记链接。");
      return;
    }
    try {
      new URL(value);
    } catch {
      setError("笔记链接格式不正确。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await importXHSNote(taskId, value);
      setNote(result.note);
      setNoteURL(result.note.noteUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "采集失败。");
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await refreshXHSNote(taskId);
      setNote(result.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "刷新失败。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-xs text-text-muted">正在读取小红书数据…</p>;

  if (!note) {
    return (
      <div className="space-y-3">
        <Field label="小红书笔记链接" hint="提交后立即采集笔记、账号基础数据和相似账号；不再需要手填指标。" error={error || undefined}>
          <Input
            type="url"
            placeholder="https://www.xiaohongshu.com/explore/..."
            value={noteURL}
            onChange={(event) => setNoteURL(event.target.value)}
            error={!!error}
            disabled={submitting}
          />
        </Field>
        <Button size="sm" onClick={submitImport} loading={submitting}>获取并保存数据</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <a href={note.canonicalUrl || note.noteUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-primary hover:underline">
            小红书笔记链接 ↗
          </a>
          <p className="mt-1 text-xs text-text-muted">
            {isAdmin ? "管理员可不限次数刷新" : `已刷新 ${note.userRefreshCount}/7 次，剩余 ${note.userRefreshesRemaining ?? 0} 次`}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={refresh} loading={submitting}>
          刷新数据{!isAdmin && note.userRefreshesRemaining !== undefined ? `（剩余 ${note.userRefreshesRemaining} 次）` : ""}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      {latest && <LatestSnapshot snapshot={latest} />}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-md bg-bg/60 p-3 ring-1 ring-border/70">
          <h4 className="mb-2 text-xs font-medium text-text">笔记数据变化趋势</h4>
          <TrendLineChart
            labels={labels}
            height={150}
            series={[
              { name: "阅读", data: note.snapshots.map((s) => s.views), color: "rgb(var(--color-primary))" },
              { name: "点赞", data: note.snapshots.map((s) => s.likes), color: "#d97706" },
              { name: "收藏", data: note.snapshots.map((s) => s.collects), color: "#7c3aed" }
            ]}
            emptyHint="再刷新一次后展示趋势"
          />
        </div>
        <div className="rounded-md bg-bg/60 p-3 ring-1 ring-border/70">
          <h4 className="mb-2 text-xs font-medium text-text">账号数据变化趋势</h4>
          <TrendLineChart
            labels={labels}
            height={150}
            series={[
              { name: "粉丝", data: note.snapshots.map((s) => s.account.fans), color: "rgb(var(--color-primary))" },
              { name: "总获赞", data: note.snapshots.map((s) => s.account.likes), color: "#d97706" },
              { name: "总收藏", data: note.snapshots.map((s) => s.account.collects), color: "#7c3aed" }
            ]}
            emptyHint="再刷新一次后展示趋势"
          />
        </div>
      </div>

      <SnapshotHistory snapshots={note.snapshots} />
      {latest && <SimilarAccounts snapshot={latest} />}
    </div>
  );
}

function LatestSnapshot({ snapshot }: { snapshot: XHSNoteSnapshot }) {
  const noteMetrics: [string, number][] = [
    ["阅读", snapshot.views], ["点赞", snapshot.likes], ["收藏", snapshot.collects], ["评论", snapshot.comments], ["转发", snapshot.shares]
  ];
  const accountMetrics: [string, number][] = [["粉丝", snapshot.account.fans], ["作品", snapshot.account.totalWorks], ["总获赞", snapshot.account.likes], ["总收藏", snapshot.account.collects], ["关注", snapshot.account.follows]];
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span>笔记最新数据</span><span>采集：{snapshotTime(snapshot.capturedAt)}</span>{snapshot.workUpdatedAt && <span>Redfox 更新：{snapshot.workUpdatedAt}</span>}
        </div>
        <MetricGrid metrics={noteMetrics} />
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span>账号基础数据</span>{snapshot.account.name && <span>{snapshot.account.name}</span>}{snapshot.account.updatedAt && <span>Redfox 更新：{snapshot.account.updatedAt}</span>}
        </div>
        <MetricGrid metrics={accountMetrics} />
        {snapshot.account.description && <p className="mt-2 text-xs leading-5 text-text-muted">{snapshot.account.description}</p>}
      </div>
      {snapshot.error && <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">{snapshot.error}</p>}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: [string, number][] }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-md bg-surface px-3 py-2 ring-1 ring-border/70"><div className="text-xs text-text-muted">{label}</div><div className="text-base font-semibold text-text">{number.format(value)}</div></div>)}</div>;
}

function SnapshotHistory({ snapshots }: { snapshots: XHSNoteSnapshot[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-text">采集快照</h4>
      <div className="overflow-x-auto rounded-md ring-1 ring-border/70">
        <table className="min-w-[760px] w-full text-left text-xs">
          <thead className="bg-bg text-text-muted"><tr><th className="px-3 py-2 font-medium">采集时间</th><th className="px-3 py-2 font-medium">触发</th><th className="px-3 py-2 font-medium">阅读变化</th><th className="px-3 py-2 font-medium">点赞变化</th><th className="px-3 py-2 font-medium">收藏变化</th><th className="px-3 py-2 font-medium">粉丝变化</th><th className="px-3 py-2 font-medium">总获赞变化</th></tr></thead>
          <tbody>{snapshots.map((snapshot, index) => {
            const previous = snapshots[index - 1];
            const trigger = snapshot.trigger === "initial" ? "首次采集" : snapshot.trigger === "admin_refresh" ? "管理员刷新" : "用户刷新";
            return <tr key={snapshot.id} className="border-t border-border/70"><td className="px-3 py-2 text-text-muted">{snapshotTime(snapshot.capturedAt)}</td><td className="px-3 py-2 text-text">{trigger}</td><td className="px-3 py-2 text-text">{change(snapshot.views, previous?.views)}</td><td className="px-3 py-2 text-text">{change(snapshot.likes, previous?.likes)}</td><td className="px-3 py-2 text-text">{change(snapshot.collects, previous?.collects)}</td><td className="px-3 py-2 text-text">{change(snapshot.account.fans, previous?.account.fans)}</td><td className="px-3 py-2 text-text">{change(snapshot.account.likes, previous?.account.likes)}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function SimilarAccounts({ snapshot }: { snapshot: XHSNoteSnapshot }) {
  const same = snapshot.similarAccounts.filter((account) => account.tier === "same_level");
  const high = snapshot.similarAccounts.filter((account) => account.tier === "high_level");
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-text">相似账号</h4><span className="text-xs text-text-muted">{snapshot.similarSummary}</span></div>
      <div className="grid gap-3 lg:grid-cols-2"><SimilarGroup title="同阶对标" hint="可直接参考玩法" accounts={same} /><SimilarGroup title="高阶标杆" hint="可追赶的成熟模式" accounts={high} /></div>
    </div>
  );
}

function SimilarGroup({ title, hint, accounts }: { title: string; hint: string; accounts: XHSNoteSnapshot["similarAccounts"] }) {
  return <div className="rounded-md bg-bg/60 p-3 ring-1 ring-border/70"><div className="mb-2"><h5 className="text-xs font-medium text-text">{title}</h5><p className="text-xs text-text-muted">{hint}</p></div>{accounts.length === 0 ? <p className="text-xs text-text-muted">暂无匹配数据</p> : <div className="space-y-2">{accounts.map((account) => <a key={`${account.tier}-${account.rank}-${account.accountId}`} href={account.url || undefined} target="_blank" rel="noreferrer" className="block rounded-md bg-surface px-3 py-2 ring-1 ring-border/60 transition hover:bg-primary-50"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-text">{account.nickname || "未命名账号"}</span><span className="shrink-0 text-xs text-text-muted">{number.format(account.fans)} 粉</span></div><p className="mt-1 text-xs text-text-muted">近 7 天互动 {number.format(account.interactiveCountSeven)} · 近 30 天互动 {number.format(account.interactiveCountThirty)}{account.level ? ` · ${account.level}` : ""}</p></a>)}</div>}</div>;
}
