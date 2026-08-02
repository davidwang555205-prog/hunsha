/**
 * useActiveTaskWatcher -- 全局任务完成通知 watcher
 *
 * 挂在 AppShell，每 15s 拉取最近任务列表。首次轮询仅建立状态基线不写通知；
 * 后续检测到 queued/processing -> completed/failed/cancelled 跳变时写入本地通知，
 * 并刷新积分余额/历史。未登录时不轮询。
 */
import { useEffect, useRef } from "react";
import { listTasks } from "../api/generation";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNotifications } from "../context/NotificationContext";
import { describeGenerationFailure } from "../lib/generationFeedback";
import { firstTitle } from "../lib/titles";
import type { GenerationTask } from "../types/api";

export const ACTIVE_TASK_WATCHER_INTERVAL_MS = 15_000;
const activeStatuses = new Set(["queued", "processing"]);
const terminalStatuses = new Set(["completed", "failed", "cancelled"]);

export type TaskTransition = {
  task: GenerationTask;
  prevStatus: string;
  curStatus: "completed" | "failed" | "cancelled";
};

/** 纯函数：从上一轮状态快照与当前任务列表中找出需要通知的跳变。 */
export function detectTaskTransitions(
  baseline: Record<string, string> | null,
  tasks: GenerationTask[]
): { transitions: TaskTransition[]; nextBaseline: Record<string, string> } {
  const nextBaseline: Record<string, string> = {};
  for (const task of tasks) {
    nextBaseline[task.id] = task.status;
  }
  if (baseline === null) {
    return { transitions: [], nextBaseline };
  }
  const transitions: TaskTransition[] = [];
  for (const task of tasks) {
    const prev = baseline[task.id];
    const cur = task.status;
    if (!prev || !activeStatuses.has(prev) || !terminalStatuses.has(cur)) {
      continue;
    }
    transitions.push({ task, prevStatus: prev, curStatus: cur as TaskTransition["curStatus"] });
  }
  return { transitions, nextBaseline };
}

export function useActiveTaskWatcher() {
  const { isAuthenticated } = useAuth();
  const { refresh } = useData();
  const { addNotification } = useNotifications();
  const baselineRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      baselineRef.current = null;
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const { tasks } = await listTasks(1, 10);
        if (cancelled) return;

        const { transitions, nextBaseline } = detectTaskTransitions(baselineRef.current, tasks);
        baselineRef.current = nextBaseline;

        if (transitions.length === 0) return;

        for (const { task, curStatus } of transitions) {
          if (curStatus === "completed") {
            addNotification({
              type: "success",
              title: "生成完成",
              body: `「${firstTitle(task.title)}」已生成 ${task.resultImages?.length ?? 0} 张图`,
              taskId: task.id
            });
          } else if (curStatus === "failed") {
            const feedback = describeGenerationFailure(task.error);
            addNotification({
              type: "failed",
              title: feedback.title,
              body: feedback.message,
              taskId: task.id
            });
          } else {
            addNotification({
              type: "info",
              title: "任务已取消",
              body: `「${firstTitle(task.title)}」已被取消。`,
              taskId: task.id
            });
          }
        }
        void refresh();
      } catch {
        // 列表失败不弹通知，避免非任务错误打扰；401 由 client 统一处理
      }
    };

    void tick();
    const timer = window.setInterval(tick, ACTIVE_TASK_WATCHER_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, refresh, addNotification]);
}
