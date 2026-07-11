/**
 * API 请求/响应类型 -- 前后端单一事实源
 *
 * 从后端 Go struct 1:1 推导：
 *   - bridalauth/types.go: PublicUser / AccountSummary
 *   - bridalauth/usecase.go: LoginResp / MeResp / Summary / AccountSummary
 *   - generation/usecase.go: GenerateReq / SanitizedTask / GenerateResp
 *   - generation/repo.go: ImageRecord / FileInput
 *   - generation/prompt/prompt.go: Params（对应前端 PromptParams）
 *
 * 响应体扁平（无 code/message 包装），错误体统一为 { error: "中文文案" }。
 */

import type { PromptParams } from "../types";

/** 对应 bridalauth.PublicUser（types.go:66），V2 扩展 credits/role/isDisabled/allowedChannels */
export type UserRole = "super_admin" | "admin" | "user";

export type ApiUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  dailyImageLimit: number;
  credits: number;
  isDisabled: boolean;
  allowedChannels: string[] | null;
  lastActiveAt: string | null;
  hasUnlimitedImageGeneration: boolean;
};

/** 会话：token + user，存 localStorage（sessionStorageKey） */
export type Session = {
  token: string;
  user: ApiUser;
};

/** 对应 bridalauth.AccountSummary（usecase.go:152），V2 增 credits/lastActiveAt */
export type AccountSummary = {
  user: ApiUser;
  requestCount: number;
  successCount: number;
  failedCount: number;
  generatedImageCount: number;
  dailyGeneratedImageCount: number;
  lastGeneratedAt: string | null;
  credits: number;
  lastActiveAt: string | null;
};

/** 对应 generation.ImageRecord（repo.go:30） */
export type GeneratedImage = {
  id: string;
  name?: string;
  url: string;
  downloadUrl: string;
  source: "local" | "remote";
};

/** 对应 generation.SanitizedTask（usecase.go:86） */
export type HistoryRecord = {
  id: string;
  userId: string;
  username: string;
  createdAt: string;
  status: "success" | "failed";
  model: string;
  mode: string;
  title: string;
  body: string;
  tags: string[];
  topic: string;
  images: GeneratedImage[];
  error?: string;
  uploadedImageCount: number;
  channelId?: string | null;
};

/** 对应 bridalauth.Summary（usecase.go:105） */
export type Summary = {
  requestCount: number;
  successCount: number;
  generatedImageCount: number;
  retentionDays: number;
};

/** 对应 bridalauth.LoginResp（usecase.go:62），非 admin 无 accounts */
export type LoginResponse = {
  token: string;
  user: ApiUser;
  accounts?: AccountSummary[];
};

/** 对应 bridalauth.MeResp（usecase.go:96） */
export type MeResponse = {
  user: ApiUser;
  accounts?: AccountSummary[];
  summary: Summary;
};

/** 历史列表响应（handler.go:83）{ history: SanitizedTask[] } */
export type HistoryResponse = {
  history: HistoryRecord[];
};

/** 对应 generation.GenerateResp（usecase.go:132）{ record: SanitizedTask } */
export type GenerateResponse = {
  record: HistoryRecord;
};

/** POST /api/admin/users 201 响应 */
export type CreateUserResponse = {
  user: ApiUser;
  accounts: AccountSummary[];
};

/** PATCH /api/admin/users/:id 响应 */
export type UpdateUserResponse = {
  user: ApiUser;
  accounts: AccountSummary[];
};

/** 对应 generation.FileInput（usecase.go:77），前端参考图 base64 */
export type ReferenceImageUpload = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

/**
 * 生图请求体，对应 generation.GenerateReq（usecase.go:64）。
 * promptParamsList 元素为补全 generatedImageName 的 PromptParams。
 */
export type GenerateRequest = {
  promptParamsList: (PromptParams & { generatedImageName: string })[];
  title: string;
  body: string;
  tags: string[];
  topic: string;
  referenceImages: ReferenceImageUpload[];
  size: string;
  quality: string;
};

/** POST /api/login 请求体 */
export type LoginRequest = {
  username: string;
  password: string;
};

/** POST /api/admin/users 请求体（V2 增 credits/role/allowedChannels） */
export type CreateUserRequest = {
  username: string;
  displayName?: string;
  password: string;
  dailyImageLimit: number;
  credits?: number;
  role?: UserRole;
  allowedChannels?: string[] | null;
};

/** PATCH /api/admin/users/:id 请求体（V2 支持全字段） */
export type UpdateUserRequest = {
  dailyImageLimit?: number;
  password?: string;
  credits?: number;
  role?: UserRole;
  displayName?: string;
  isDisabled?: boolean;
  allowedChannels?: string[] | null;
};

/** 统一错误：归一化后的 HTTP 错误，401 触发全局登出 */
export type ApiError = Error & {
  statusCode?: number;
};

/** 判断是否为 401 未授权错误 */
export function isUnauthorizedError(error: unknown): error is ApiError {
  return error instanceof Error && (error as ApiError).statusCode === 401;
}

// ============================================================
// V2 类型：模型线路 / 类目 / 异步任务 / 积分 / 历史分页
// ============================================================

/** 模型线路统计 */
export type ChannelStats = {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  successRate: number;
  avgLatencyMs: number;
};

/** 模型线路 */
export type Channel = {
  id: string;
  name: string;
  apiBaseUrl: string;
  modelId: string;
  supportedSizes: string[];
  defaultQuality: string;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  apiKey?: string;
  stats?: ChannelStats | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelListResponse = { channels: Channel[] };

export type CreateChannelRequest = {
  id?: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  modelId: string;
  supportedSizes?: string[];
  defaultQuality?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
};

export type UpdateChannelRequest = Partial<Omit<CreateChannelRequest, "id">>;

/** 内容类目 */
export type Category = {
  id: string;
  name: string;
  icon: string;
  engine: string;
  sortOrder: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CategoryListResponse = { categories: Category[] };

export type CreateCategoryRequest = {
  id?: string;
  name: string;
  icon?: string;
  engine: string;
  sortOrder?: number;
  isEnabled?: boolean;
  config?: Record<string, unknown>;
};

export type UpdateCategoryRequest = Partial<Omit<CreateCategoryRequest, "id">>;

/** 异步生图任务子图状态 */
export type SubTaskStatus = {
  index: number;
  status: "pending" | "processing" | "success" | "failed" | "cancelled";
  image: GeneratedImage | null;
  error: string | null;
  latencyMs: number;
};

/** 异步生图任务 */
export type GenerationTask = {
  id: string;
  userId: string;
  categoryId: string | null;
  channelId: string | null;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  title: string;
  body: string;
  tags: string[];
  topic: string;
  resultImages: GeneratedImage[];
  subTaskStatus: SubTaskStatus[];
  error: string;
  totalCount: number;
  completedCount: number;
  estimatedSeconds: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

/** POST /api/v1/generation 提交任务请求（与 GenerateRequest 共用基础字段 + channelId/categoryId） */
export type CreateTaskRequest = {
  promptParamsList: (PromptParams & { generatedImageName: string })[];
  title: string;
  body: string;
  tags: string[];
  topic: string;
  referenceImages: ReferenceImageUpload[];
  size: string;
  quality: string;
  channelId?: string;
  categoryId?: string;
};

export type CreateTaskResponse = {
  taskId: string;
  status: string;
  totalCount: number;
  estimatedSeconds: number;
};

export type TaskListResponse = {
  tasks: GenerationTask[];
  total: number;
  page: number;
  pageSize: number;
};

export type TaskDetailResponse = { task: GenerationTask };

/** 积分变动记录 */
export type CreditTransaction = {
  id: string;
  userId: string;
  type: "recharge" | "consume" | "adjust";
  amount: number;
  balanceAfter: number;
  description: string;
  relatedTaskId: string | null;
  createdAt: string;
};

export type CreditTransactionListResponse = { transactions: CreditTransaction[] };

export type AdjustCreditsRequest = {
  amount: number;
  type?: "recharge" | "adjust";
  description?: string;
};

export type AdjustCreditsResponse = {
  user: ApiUser;
  balance: number;
  accounts: AccountSummary[];
};

/** 历史分页响应（V2） */
export type HistoryPagedResponse = {
  history: HistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type HistoryQuery = {
  page?: number;
  pageSize?: number;
  status?: "success" | "failed";
  startDate?: string;
  endDate?: string;
  q?: string;
};
