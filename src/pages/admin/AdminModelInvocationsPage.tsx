import { useEffect, useState } from "react";
import { listChannels, listMembers } from "../../api/admin";
import { listModelInvocations } from "../../api/generation";
import { formatDate, pickUserLabel } from "../../lib/format";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { Spinner } from "../../components/ui/Spinner";
import { inputClass } from "../../studio/constants";
import type { Channel, ModelInvocation, ModelInvocationQuery, TeamMemberInfo } from "../../types/api";

const statuses = [
  { value: "", label: "全部状态" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "processing", label: "进行中" }
] as const;

function resultText(row: ModelInvocation) {
  if (row.status === "success") return "成功";
  if (row.status === "failed") return "失败";
  return "进行中";
}

function resultClass(row: ModelInvocation) {
  if (row.status === "success") return "bg-success/10 text-success";
  if (row.status === "failed") return "bg-danger/10 text-danger";
  return "bg-primary-50 text-primary";
}

function latencyText(ms: number) {
  if (!ms) return "等待中";
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 60_000 ? 0 : 1)}s` : `${ms}ms`;
}

/** 管理后台的跨任务调用日志页：筛出慢、失败或特定模型，再进入单条请求细节。 */
export function AdminModelInvocationsPage() {
  const [rows, setRows] = useState<ModelInvocation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<ModelInvocationQuery["status"]>();
  const [userId, setUserId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ModelInvocation | null>(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const result = await listModelInvocations({ page: nextPage, pageSize, status, userId: userId || undefined, channelId: channelId || undefined });
      setRows(result.invocations);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模型调用审计失败。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([listMembers(), listChannels()])
      .then(([memberResult, channelResult]) => {
        setMembers(memberResult.members);
        setChannels(channelResult.channels);
      })
      .catch(() => {
        // 筛选项加载失败不应阻断审计主列表；保留“全部”可继续排障。
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(page);
    // pageSize/status/userId/channelId 的改变由 effect 自动回到第一页。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, userId, channelId]);

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        title="模型调用审计"
        subtitle={`记录每一次真实上游请求 · 共 ${total} 条`}
        actions={<Button variant="secondary" size="sm" onClick={() => void load(page)} loading={loading}>刷新</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-4">
        <select className={`${inputClass} !w-36`} value={status ?? ""} onChange={(e) => updateFilter((v) => setStatus(v as ModelInvocationQuery["status"] || undefined), e.target.value)}>
          {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className={`${inputClass} !w-44`} value={userId} onChange={(e) => updateFilter(setUserId, e.target.value)}>
          <option value="">全部用户</option>
          {members.map((member) => <option key={member.user.id} value={member.user.id}>{pickUserLabel(member.user)}</option>)}
        </select>
        <select className={`${inputClass} !w-48`} value={channelId} onChange={(e) => updateFilter(setChannelId, e.target.value)}>
          <option value="">全部线路</option>
          {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name} · {channel.modelId}</option>)}
        </select>
        <p className="ml-auto text-xs text-text-muted">点击一条记录查看提示词、参考图、HTTP 与错误详情</p>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-20 text-text-muted"><Spinner size={28} /></div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="暂无模型调用记录" description="审计功能上线后创建的生图任务，会在这里显示每一次模型请求。" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-bg text-xs font-medium text-text-muted">
                <tr>
                  <th className="px-4 py-3">时间 / 用户</th><th className="px-4 py-3">模型线路</th><th className="px-4 py-3">子图与尝试</th><th className="px-4 py-3">结果</th><th className="px-4 py-3">耗时</th><th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {rows.map((row) => (
                  <tr key={row.id} className="cursor-pointer transition hover:bg-bg/70" onClick={() => setDetail(row)}>
                    <td className="px-4 py-3"><p className="text-text">{formatDate(row.requestedAt)}</p><p className="mt-1 max-w-44 truncate text-xs text-text-muted">{row.username || row.userEmail || row.userID}</p></td>
                    <td className="px-4 py-3"><p className="max-w-56 truncate font-medium text-text">{row.channelName || "默认线路"}</p><p className="mt-1 max-w-56 truncate text-xs text-text-muted">{row.modelID || "未记录模型"}</p></td>
                    <td className="px-4 py-3 text-text-muted">图 {row.imageNumber || "-"}<br /><span className="text-xs">候选 {row.candidateIndex}/{row.candidateCount} · 第 {row.attemptNumber} 次</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${resultClass(row)}`}>{resultText(row)}</span><p className="mt-1 text-xs text-text-muted">HTTP {row.httpStatus || "-"}</p></td>
                    <td className="px-4 py-3 font-medium tabular-nums text-text">{latencyText(row.latencyMs)}</td>
                    <td className="px-4 py-3 text-right"><Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setDetail(row); }}>详情</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title="模型调用详情" size="xl">
        {detail && <InvocationDetail row={detail} />}
      </Modal>
    </>
  );
}

function InvocationDetail({ row }: { row: ModelInvocation }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 rounded-md bg-bg p-4 ring-1 ring-border/70 sm:grid-cols-3">
        <p><span className="text-xs text-text-muted">状态</span><br />{resultText(row)} · HTTP {row.httpStatus || "-"}</p>
        <p><span className="text-xs text-text-muted">耗时</span><br />{latencyText(row.latencyMs)}</p>
        <p><span className="text-xs text-text-muted">请求时间</span><br />{formatDate(row.requestedAt)}</p>
        <p><span className="text-xs text-text-muted">用户</span><br />{row.username || "-"} {row.userEmail ? `(${row.userEmail})` : ""}</p>
        <p><span className="text-xs text-text-muted">模型</span><br />{row.channelName || "默认线路"} · {row.modelID || "-"}</p>
        <p><span className="text-xs text-text-muted">候选 / 尝试</span><br />{row.candidateIndex}/{row.candidateCount} · {row.attemptNumber}/{row.attemptBudget}</p>
      </div>
      <p className="break-all rounded-md bg-bg px-3 py-2 text-xs text-text-muted ring-1 ring-border/70">{row.protocol || "-"} · {row.apiBaseURL || "-"}</p>
      {row.error && <pre className="whitespace-pre-wrap rounded-md border border-danger/30 bg-danger/5 p-3 text-xs leading-5 text-danger">{row.error}</pre>}
      <section><h4 className="mb-2 font-medium text-text">传递的提示词</h4><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-3 text-xs leading-5 text-text-muted ring-1 ring-border/70">{row.prompt}</pre></section>
      <section><h4 className="mb-2 font-medium text-text">参考图 ({row.referenceImages.length})</h4><div className="flex flex-wrap gap-3">{row.referenceImages.map((ref, index) => <a key={`${ref.sha256}-${index}`} href={ref.url || undefined} target={ref.url ? "_blank" : undefined} rel="noreferrer" className="w-28 overflow-hidden rounded-md bg-bg ring-1 ring-border/70">{ref.url ? <img src={ref.url} alt={ref.name || ref.kind} className="aspect-[4/5] w-full object-cover" /> : <div className="flex aspect-[4/5] items-center justify-center px-2 text-center text-xs text-text-subtle">未存对象 URL</div>}<p className="truncate px-2 py-1.5 text-xs text-text-muted">{ref.kind || ref.name}</p></a>)}</div></section>
    </div>
  );
}
