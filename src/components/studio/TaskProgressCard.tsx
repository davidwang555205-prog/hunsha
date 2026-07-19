/**
 * TaskProgressCard -- 异步生图任务状态条（苹果风格）
 *
 * 顶部简洁状态条：任务标题 + 状态徽章 + 取消/重试/新任务。
 * 具体进度完全交给右侧 ImageGenerationGrid 的逐张卡片呈现。
 * 进行中可取消；失败可重试；完成展示结果。
 */
import { Button } from "../ui/Button";
import { FeedbackAlert } from "../ui/FeedbackAlert";
import { describeGenerationFailure, type GenerationFeedback } from "../../lib/generationFeedback";
import type { GenerationTask } from "../../types/api";

type TaskProgressCardProps = {
  task: GenerationTask | null;
  stage: string;
  completedCount: number;
  totalCount: number;
  isSubmitting: boolean;
  error?: GenerationFeedback | null;
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

export function TaskProgressCard({
  task,
  stage,
  completedCount,
  totalCount,
  isSubmitting,
  error,
  onCancel,
  onRetry,
  onDismiss
}: TaskProgressCardProps) {
  if (stage === "idle") return null;

  const isActive = stage === "queued" || stage === "processing";
  const estimatedMin = task?.estimatedSeconds ? Math.ceil(task.estimatedSeconds / 60) : null;
  const failure = task?.error ? describeGenerationFailure(task.error) : error;
  const processingCount = task?.subTaskStatus.filter((item) => item.status === "processing").length ?? 0;
  const pendingCount = task?.subTaskStatus.filter((item) => item.status === "pending").length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-text">{task?.title || "生图任务"}</h3>
            {stage !== "completed" && !isActive && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage === "completed" ? "bg-success/10 text-success" : stage === "failed" ? "bg-danger/10 text-danger" : "bg-bg text-text-muted"}`}>
                {statusLabel[stage] || stage}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {isActive
              ? <><span className="font-medium text-text">已完成 {completedCount}/{totalCount} 张</span>{processingCount > 0 ? ` · 正在生成 ${processingCount} 张` : ""}{pendingCount > 0 ? ` · 排队 ${pendingCount} 张` : ""}{estimatedMin ? ` · 预计还需 ${Math.max(1, Math.ceil((estimatedMin * (totalCount - completedCount)) / Math.max(1, totalCount)))} 分钟` : ""}</>
              : stage === "completed"
                ? `共生成 ${completedCount} 张图`
                : stage === "failed"
                  ? failure?.message || "生成失败"
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
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              新任务
            </Button>
          )}
        </div>
      </div>

      {/* 错误详情 */}
      {failure && <FeedbackAlert feedback={failure} className="mt-3" />}
    </div>
  );
}
