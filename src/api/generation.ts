/**
 * 生图、异步任务与历史 API
 *
 * 对应后端 generation handler：
 *   POST /api/v1/generation                提交异步生图任务（返回 taskId）
 *   GET  /api/v1/generation/tasks          任务列表（分页）
 *   GET  /api/v1/generation/tasks/:id      任务详情（含子图进度）
 *   POST /api/v1/generation/tasks/:id/cancel  取消任务
 *   GET  /api/v1/generation/history        历史分页（page/pageSize/status/startDate/endDate/q）
 *
 * 兼容：POST /api/generate 同步生图（保留，逐步迁移到异步）
 */
import { apiRequest } from "./client";
import type {
  CreateTaskRequest,
  CreateTaskResponse,
  GenerationTask,
  HistoryPagedResponse,
  HistoryQuery,
  HistoryResponse,
  TaskDetailResponse,
  TaskListResponse
} from "../types/api";

/** 提交异步生图任务（立即返回 taskId，不阻塞） */
export function createTask(req: CreateTaskRequest) {
  return apiRequest<CreateTaskResponse>("/api/v1/generation", {
    method: "POST",
    body: JSON.stringify(req),
    timeoutMs: 30_000
  });
}

/** 任务列表（分页） */
export function listTasks(page = 1, pageSize = 20, status?: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (status) params.set("status", status);
  return apiRequest<TaskListResponse>(`/api/v1/generation/tasks?${params.toString()}`);
}

/** 任务详情（含子图进度） */
export function getTask(taskId: string) {
  return apiRequest<TaskDetailResponse>(`/api/v1/generation/tasks/${encodeURIComponent(taskId)}`);
}

/** 取消任务 */
export function cancelTask(taskId: string) {
  return apiRequest<{ ok: boolean; status: string }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/cancel`,
    { method: "POST" }
  );
}

/** 历史分页查询（V2） */
export function listHistoryPaged(query: HistoryQuery = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  if (query.q) params.set("q", query.q);
  const qs = params.toString();
  return apiRequest<HistoryPagedResponse>(`/api/v1/generation/history${qs ? `?${qs}` : ""}`);
}

/** 兼容：历史列表（旧100条，部分组件仍用） */
export function listHistory() {
  return apiRequest<HistoryResponse>("/api/v1/generation/history");
}

export type { GenerationTask };
