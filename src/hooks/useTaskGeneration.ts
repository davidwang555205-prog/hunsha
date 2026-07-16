/**
 * useTaskGeneration -- 异步生图任务状态机（V2）
 *
 * 流程：提交任务（POST /api/v1/generation）-> 返回 taskId -> 轮询任务详情（每 3s）
 * 状态：idle -> queued -> processing -> completed / failed / cancelled
 *
 * 进度：基于 task.subTaskStatus（真实逐张状态）+ completedCount/totalCount。
 * 用户退出页面（组件卸载）暂停轮询，任务在后端继续；重新进入页面可重新拉取进度。
 *
 * 与旧 useGeneration 的区别：不再阻塞等待单次请求，而是异步任务 + 轮询。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTask, getTask, cancelTask } from "../api/generation";
import { isUnauthorizedError } from "../types/api";
import type { CreateTaskRequest, GenerationTask } from "../types/api";
import { describeGenerationFailure, type GenerationFeedback } from "../lib/generationFeedback";

const POLL_INTERVAL_MS = 3000;

export type TaskStage = "idle" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export function useTaskGeneration() {
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [stage, setStage] = useState<TaskStage>("idle");
  const [error, setError] = useState<GenerationFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 插值显示进度（与 task 解耦，submit/reset 直接重置，避免激活初始值残留）
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshTask = useCallback(async (taskId: string) => {
    try {
      const payload = await getTask(taskId);
      setTask(payload.task);
      setStage(payload.task.status as TaskStage);
      return payload.task;
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setError(describeGenerationFailure(err));
      }
      return null;
    }
  }, []);

  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        void refreshTask(taskId).then((latest) => {
          // 终态停止轮询
          if (latest && ["completed", "failed", "cancelled"].includes(latest.status)) {
            stopPolling();
          }
        });
      }, POLL_INTERVAL_MS);
    },
    [refreshTask, stopPolling]
  );

  const submit = useCallback(
    async (req: CreateTaskRequest) => {
      setIsSubmitting(true);
      setError(null);
      setDisplayedProgress(0);
      try {
        const resp = await createTask(req);
        taskIdRef.current = resp.taskId;
        setStage("queued");
        // 立即拉一次详情，然后开始轮询
        const latest = await refreshTask(resp.taskId);
        if (latest && !["completed", "failed", "cancelled"].includes(latest.status)) {
          startPolling(resp.taskId);
        }
        return resp.taskId;
      } catch (err) {
        if (!isUnauthorizedError(err)) {
          setError(describeGenerationFailure(err));
          setStage("failed");
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refreshTask, startPolling]
  );

  const cancel = useCallback(async () => {
    const taskId = taskIdRef.current;
    if (!taskId) return;
    try {
      await cancelTask(taskId);
      stopPolling();
      setStage("cancelled");
      await refreshTask(taskId);
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setError(describeGenerationFailure(err));
      }
    }
  }, [refreshTask, stopPolling]);

  /** 恢复某个任务进度的轮询（重新进入页面时） */
  const resume = useCallback(
    async (taskId: string) => {
      taskIdRef.current = taskId;
      const latest = await refreshTask(taskId);
      if (latest && !["completed", "failed", "cancelled"].includes(latest.status)) {
        startPolling(taskId);
      }
    },
    [refreshTask, startPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    taskIdRef.current = null;
    setTask(null);
    setStage("idle");
    setError(null);
    setDisplayedProgress(0);
  }, [stopPolling]);

  /** 供请求体组装等提交前步骤复用同一套用户提示。 */
  const reportError = useCallback((err: unknown) => setError(describeGenerationFailure(err)), []);

  // 卸载清理
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // 进度计算：加权基础进度 + 时间插值
  // 后端串行生图，每张 30s~2min，completedCount 仅在每张完成时 +1。
  // 纯 completedCount/totalCount 会让进度条在每张生成期间长时间静止（看着像卡死）。
  // 改为：加权基础（已结束=1，processing=0.5）+ 200ms 插值向估算上限缓慢爬升。
  const totalCount = task?.totalCount ?? 0;
  const completedCount = task?.completedCount ?? 0;
  const subTaskStatus = useMemo(() => task?.subTaskStatus ?? [], [task?.subTaskStatus]);
  const resultImages = task?.resultImages ?? [];
  const isActive = stage === "queued" || stage === "processing";

  // 加权基础进度：反映逐张真实状态，每张进入 processing 即贡献半格（不再从 0 空着）
  const weightedBase = useMemo(() => {
    if (totalCount <= 0) return 0;
    let w = 0;
    for (const s of subTaskStatus) {
      if (s.status === "success" || s.status === "failed" || s.status === "cancelled") w += 1;
      else if (s.status === "processing") w += 0.5;
    }
    return (w / totalCount) * 100;
  }, [subTaskStatus, totalCount]);

  // 估算爬升上限：(已完成 + 0.85 张)/总数。受真实 completedCount 约束，永不超估；0.85 留余量避免假满
  const ceilProgress = totalCount > 0 ? ((completedCount + 0.85) / totalCount) * 100 : 0;

  // displayedProgress 插值：真实跳变时快速追上，停滞时缓慢向估算上限爬升，让条持续动
  const targetRef = useRef(0);
  const ceilRef = useRef(0);
  useEffect(() => {
    targetRef.current = weightedBase;
    ceilRef.current = ceilProgress;
  }, [weightedBase, ceilProgress]);

  useEffect(() => {
    if (!isActive) return; // 非激活不插值，progress 由 weightedBase 直接派生
    const id = setInterval(() => {
      setDisplayedProgress((prev) => {
        const target = targetRef.current;
        if (prev < target) return Math.min(target, prev + 2.5); // 真实跳变，快速追上
        const ceil = ceilRef.current;
        if (prev < ceil) return Math.min(ceil, prev + Math.max(0.08, (ceil - prev) * 0.06)); // 渐近逼近估算上限：越近上限越慢，保底 0.08 持续微动不死等
        return prev;
      });
    }, 200);
    return () => clearInterval(id);
  }, [isActive]);

  // 非激活直接派生真实进度（完成=100，其它=加权基础）；激活用插值后的 displayedProgress
  const progress = !isActive
    ? (stage === "completed" ? 100 : Math.round(weightedBase))
    : Math.round(displayedProgress);

  return {
    task,
    stage,
    error,
    isSubmitting,
    isActive,
    totalCount,
    completedCount,
    progress,
    subTaskStatus,
    resultImages,
    submit,
    cancel,
    resume,
    reportError,
    reset
  };
}
