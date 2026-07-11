/**
 * TaskProgressCard -- 异步生图任务进度展示（苹果风格）
 *
 * 显示：任务标题 + 状态 + 进度条 + 完成数/总数 + 子图缩略图网格（每张状态）。
 * 进行中可取消；失败可重试；完成展示结果。
 */
import { ProgressBar } from "../ui/ProgressBar";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import type { GenerationTask, SubTaskStatus } from "../../types/api";

type TaskProgressCardProps = {
  task: GenerationTask | null;
  stage: string;
  progress: number;
  completedCount: number;
  totalCount: number;
  subTaskStatus: SubTaskStatus[];
  isSubmitting: boolean;
  onCancel: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
};

const statusLabel: Record<string, string> = {
  queued: "已加入队列",
  processing: "生成中",
  completed: "已完成",
  failed: "生成失败",
  cancelled: "已取消",
  idle: "待生成"
};

const subStatusBadge: Record<string, { text: string; cls: string }> = {
  pending: { text: "等待中", cls: "bg-bg text-text-subtle" },
  processing: { text: "生成中", cls: "bg-primary/10 text-primary" },
  success: { text: "成功", cls: "bg-success/10 text-success" },
  failed: { text: "失败", cls: "bg-danger/10 text-danger" },
  cancelled: { text: "已取消", cls: "bg-bg text-text-subtle" }
};

export function TaskProgressCard({
  task,
  stage,
  progress,
  completedCount,
  totalCount,
  subTaskStatus,
  isSubmitting,
  onCancel,
  onRetry,
  onDismiss
}: TaskProgressCardProps) {
  if (stage === "idle") return null;

  const isActive = stage === "queued" || stage === "processing";
  const estimatedMin = task?.estimatedSeconds ? Math.ceil(task.estimatedSeconds / 60) : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-text">{task?.title || "生图任务"}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? "bg-primary/10 text-primary" : stage === "completed" ? "bg-success/10 text-success" : stage === "failed" ? "bg-danger/10 text-danger" : "bg-bg text-text-muted"}`}>
              {statusLabel[stage] || stage}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {isActive
              ? `进度 ${completedCount}/${totalCount}${estimatedMin ? ` · 预计还需 ${Math.max(1, Math.ceil((estimatedMin * (totalCount - completedCount)) / Math.max(1, totalCount)))} 分钟` : ""}`
              : stage === "completed"
                ? `共生成 ${completedCount} 张图`
                : stage === "failed"
                  ? task?.error || "生成失败"
                  : "任务已取消"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <Button variant="secondary" size="sm" onClick={onCancel} loading={isSubmitting}>
              取消
            </Button>
          )}
          {stage === "failed" && onRetry && (
            <Button variant="primary" size="sm" onClick={onRetry}>
              重试
            </Button>
          )}
          {(stage === "completed" || stage === "failed" || stage === "cancelled") && onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              关闭
            </Button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {isActive && (
        <div className="mb-4">
          <ProgressBar value={progress} />
        </div>
      )}

      {/* 子图缩略图网格 */}
      {subTaskStatus.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {subTaskStatus.map((sub) => {
            const badge = subStatusBadge[sub.status] || subStatusBadge.pending;
            return (
              <div key={sub.index} className="overflow-hidden rounded-md border border-border bg-bg">
                <div className="flex aspect-[3/4] items-center justify-center bg-bg">
                  {sub.image?.url ? (
                    <img src={sub.image.url} alt={`图 ${sub.index + 1}`} className="h-full w-full object-cover" />
                  ) : sub.status === "processing" ? (
                    <Spinner size={24} />
                  ) : sub.status === "failed" ? (
                    <span className="text-xs text-danger">失败</span>
                  ) : (
                    <span className="text-xs text-text-subtle">等待中</span>
                  )}
                </div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs text-text-muted">图 {sub.index + 1}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 错误详情 */}
      {stage === "failed" && task?.error && (
        <p className="mt-3 rounded-md bg-danger/5 px-3 py-2 text-sm text-danger ring-1 ring-danger/20">{task.error}</p>
      )}
    </div>
  );
}
