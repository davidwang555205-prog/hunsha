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
  GenerationStats,
  GenerationStatsTrend,
  GenerationTask,
  HistoryPagedResponse,
  HistoryQuery,
  HistoryRecord,
  HistoryResponse,
  ModelInvocationListResponse,
  ModelInvocationQuery,
  SubmitFeedbackRequest,
  TaskDetailResponse,
  TaskListResponse,
  XHSNoteTracking
} from "../types/api";

/** 提交异步生图任务（立即返回 taskId，不阻塞） */
export function createTask(req: CreateTaskRequest) {
  return apiRequest<CreateTaskResponse>("/api/v1/generation", {
    method: "POST",
    body: JSON.stringify(req),
    // 后端提交时需串行上传 6 张参考图到 COS 才创建 task，30s 不够，放宽到 180s
    timeoutMs: 180_000
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

/** 单张重试：重新生成失败/取消的某张子图（仅失败任务且至少 1 张成功时可用） */
export function retryImage(taskId: string, imageNumber: number) {
  return apiRequest<{ ok: boolean }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/images/${imageNumber}/retry`,
    { method: "POST", timeoutMs: 30_000 }
  );
}

/** 提交小红书发布反馈（笔记链接 + 阅读/点赞/收藏/评论） */
export function submitFeedback(taskId: string, req: SubmitFeedbackRequest) {
  return apiRequest<{ task: HistoryRecord }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/feedback`,
    { method: "POST", body: JSON.stringify(req) }
  );
}

/** 首次关联已发布的小红书笔记，并立即从 Redfox 采集笔记、账号和相似账号快照。 */
export function importXHSNote(taskId: string, noteUrl: string) {
  return apiRequest<{ note: XHSNoteTracking }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/xhs-note`,
    { method: "POST", body: JSON.stringify({ noteUrl }), timeoutMs: 45_000 }
  );
}

/** 修改已关联的笔记链接并立即重新采集；普通用户每条记录最多修改 3 次。 */
export function updateXHSNote(taskId: string, noteUrl: string) {
  return apiRequest<{ note: XHSNoteTracking }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/xhs-note`,
    { method: "PUT", body: JSON.stringify({ noteUrl }), timeoutMs: 45_000 }
  );
}

/** 刷新已关联笔记；普通用户最多 7 次，管理员不受总次数限制。 */
export function refreshXHSNote(taskId: string) {
  return apiRequest<{ note: XHSNoteTracking }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/xhs-note/refresh`,
    { method: "POST", timeoutMs: 45_000 }
  );
}

/** 获取已关联笔记及其完整快照序列。 */
export function getXHSNote(taskId: string) {
  return apiRequest<{ note: XHSNoteTracking }>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/xhs-note`
  );
}

/** 历史分页查询（V2） */
export function listHistoryPaged(query: HistoryQuery = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.startTime) params.set("startTime", query.startTime);
  if (query.endTime) params.set("endTime", query.endTime);
  if (query.q) params.set("q", query.q);
  if (query.taskId) params.set("taskId", query.taskId);
  if (query.userId) params.set("userId", query.userId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  const qs = params.toString();
  return apiRequest<HistoryPagedResponse>(`/api/v1/generation/history${qs ? `?${qs}` : ""}`);
}

/** 兼容：历史列表（旧100条，部分组件仍用） */
export function listHistory() {
  return apiRequest<HistoryResponse>("/api/v1/generation/history");
}

/** 管理员模型调用审计列表：一条记录对应一次真实上游 HTTP 请求。 */
export function listModelInvocations(query: ModelInvocationQuery = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.taskId) params.set("taskId", query.taskId);
  if (query.userId) params.set("userId", query.userId);
  if (query.channelId) params.set("channelId", query.channelId);
  if (query.status) params.set("status", query.status);
  if (query.startTime) params.set("startTime", query.startTime);
  if (query.endTime) params.set("endTime", query.endTime);
  const qs = params.toString();
  return apiRequest<ModelInvocationListResponse>(`/api/v1/generation/invocations${qs ? `?${qs}` : ""}`);
}

/** 管理员在任务详情中查看该任务的完整模型调用时间线。 */
export function listTaskModelInvocations(taskId: string) {
  return apiRequest<ModelInvocationListResponse>(
    `/api/v1/generation/tasks/${encodeURIComponent(taskId)}/invocations`
  );
}

/** 生图统计（admin 概览页用，GET /api/v1/generation/stats） */
export function getStats() {
  return apiRequest<GenerationStats>("/api/v1/generation/stats");
}

/** 生图趋势统计（admin 概览页趋势图用，GET /api/v1/generation/stats/trend?days=14） */
export function getStatsTrend(days = 14) {
  return apiRequest<GenerationStatsTrend>(`/api/v1/generation/stats/trend?days=${days}`);
}

export type { GenerationTask };
