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
import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, getTask, cancelTask } from "../api/generation";
import { isUnauthorizedError } from "../types/api";
import type { CreateTaskRequest, GenerationTask } from "../types/api";

const POLL_INTERVAL_MS = 3000;

export type TaskStage = "idle" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export function useTaskGeneration() {
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [stage, setStage] = useState<TaskStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        setError(err instanceof Error ? err.message : "获取任务进度失败。");
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
          setError(err instanceof Error ? err.message : "提交任务失败。");
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
        setError(err instanceof Error ? err.message : "取消任务失败。");
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
  }, [stopPolling]);

  // 卸载清理
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // 进度计算
  const totalCount = task?.totalCount ?? 0;
  const completedCount = task?.completedCount ?? 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isActive = stage === "queued" || stage === "processing";
  const subTaskStatus = task?.subTaskStatus ?? [];
  const resultImages = task?.resultImages ?? [];

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
    reset
  };
}
