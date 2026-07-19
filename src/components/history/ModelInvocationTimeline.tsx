import { useEffect, useState } from "react";
import { listTaskModelInvocations } from "../../api/generation";
import { copyText } from "../../lib/clipboard";
import { formatDate } from "../../lib/format";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import type { ModelInvocation } from "../../types/api";

function statusStyle(status: ModelInvocation["status"]) {
  if (status === "success") return "bg-success text-success";
  if (status === "failed") return "bg-danger text-danger";
  return "bg-primary text-primary";
}

function statusLabel(status: ModelInvocation["status"]) {
  return status === "success" ? "成功" : status === "failed" ? "失败" : "进行中";
}

function duration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms >= 60_000 ? 0 : 1)}s`;
}

/** 任务详情内的可展开上游调用轨迹，供管理员定位慢/失败发生在哪条线路和哪次尝试。 */
export function ModelInvocationTimeline({ taskId }: { taskId: string }) {
  const [rows, setRows] = useState<ModelInvocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const result = await listTaskModelInvocations(taskId);
        if (active) setRows(result.invocations);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "加载模型调用审计失败。");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  const copyPrompt = async (row: ModelInvocation) => {
    try {
      await copyText(row.prompt);
      setCopied(row.id);
      window.setTimeout(() => setCopied((id) => (id === row.id ? null : id)), 1500);
    } catch {
      // 与项目既有提示词复制行为保持一致：浏览器不允许剪贴板时不打断排障阅读。
    }
  };

  return (
    <section className="mt-5 rounded-lg border border-border bg-bg/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">模型调用时间线</h3>
          <p className="mt-1 text-xs text-text-muted">一条即一次真实上游 HTTP 请求；重试与线路切换会单独记录。</p>
        </div>
        {!loading && <span className="text-xs tabular-nums text-text-muted">{rows.length} 次调用</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-text-muted"><Spinner size={16} /> 读取调用轨迹…</div>
      ) : error ? (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-md bg-surface px-3 py-3 text-xs text-text-muted ring-1 ring-border/70">暂无调用记录。审计功能上线后的新任务会从这里显示每次模型请求。</p>
      ) : (
        <ol className="mt-4 space-y-3 border-l border-border pl-4">
          {rows.map((row) => (
            <li key={row.id} className="relative">
              <span className={`absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${statusStyle(row.status).split(" ")[0]}`} />
              <details className="group rounded-md bg-surface ring-1 ring-border/80" open={row.status === "failed"}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      <span>图 {row.imageNumber || "-"}</span>
                      <span className="truncate">{row.channelName || "默认线路"} · {row.modelId || "未记录模型"}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{formatDate(row.requestedAt)} · 候选 {row.candidateIndex}/{row.candidateCount} · 尝试 {row.attemptNumber}/{row.attemptBudget}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 ${statusStyle(row.status)}`}>{statusLabel(row.status)}</span>
                    <span className="tabular-nums text-text-muted">{row.latencyMs ? duration(row.latencyMs) : "等待中"}</span>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border px-3 py-3 text-xs">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="text-text-muted">HTTP：<span className="text-text">{row.httpStatus || "网络错误"}</span></p>
                    <p className="text-text-muted">协议 / 尺寸 / 质量：<span className="text-text">{row.protocol || "-"} / {row.size || "-"} / {row.quality || "-"}</span></p>
                    <p className="break-all text-text-muted sm:col-span-2">API Base：<span className="text-text">{row.apiBaseUrl || "-"}</span></p>
                  </div>
                  {row.error && <p className="whitespace-pre-wrap rounded-md border border-danger/25 bg-danger/5 px-3 py-2 leading-5 text-danger">{row.error}</p>}
                  <div className="rounded-md bg-bg p-3 ring-1 ring-border/70">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-medium text-text">传递的提示词</span>
                      <Button type="button" variant="ghost" size="sm" className="!h-6 !px-2 !text-xs" onClick={() => void copyPrompt(row)}>{copied === row.id ? "已复制" : "复制"}</Button>
                    </div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words leading-5 text-text-muted">{row.prompt || "-"}</pre>
                  </div>
                  {row.referenceImages.length > 0 && (
                    <div>
                      <p className="mb-2 font-medium text-text">参考图 ({row.referenceImages.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {row.referenceImages.map((ref, index) => (
                          <a key={`${ref.sha256}-${index}`} href={ref.url || undefined} target={ref.url ? "_blank" : undefined} rel="noreferrer" className="group/ref flex w-24 flex-col overflow-hidden rounded-md bg-bg ring-1 ring-border/70">
                            {ref.url ? <img src={ref.url} alt={ref.name || ref.kind} className="aspect-[4/5] w-full object-cover" /> : <span className="flex aspect-[4/5] items-center justify-center px-2 text-center text-[10px] text-text-subtle">未存对象 URL</span>}
                            <span className="truncate px-2 py-1.5 text-[10px] text-text-muted">{ref.kind || "参考图"}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
