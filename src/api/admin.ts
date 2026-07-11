/**
 * 管理后台 API（V2）
 *
 * 对应后端：
 *   用户管理：GET /api/admin/users, POST /api/admin/users, PATCH/DELETE /api/admin/users/:id
 *             POST /api/admin/users/:id/credits
 *   模型线路：GET/POST /api/admin/channels, PATCH/DELETE /api/admin/channels/:id
 *   类目：    POST /api/admin/categories, PATCH/DELETE /api/admin/categories/:id
 *   积分记录：GET /api/credits/transactions
 *   公开线路：GET /api/channels（所有用户）
 *   公开类目：GET /api/categories（所有用户）
 */
import { apiRequest } from "./client";
import type {
  AccountSummary,
  AdjustCreditsRequest,
  AdjustCreditsResponse,
  Category,
  CategoryListResponse,
  Channel,
  ChannelListResponse,
  CreateCategoryRequest,
  CreateChannelRequest,
  CreateUserRequest,
  CreateUserResponse,
  CreditTransactionListResponse,
  UpdateCategoryRequest,
  UpdateChannelRequest,
  UpdateUserRequest,
  UpdateUserResponse
} from "../types/api";

/** 用户列表（admin+） */
export function listAccounts() {
  return apiRequest<{ accounts: AccountSummary[] }>("/api/admin/users");
}

/** 创建用户（admin+） */
export function createUser(req: CreateUserRequest) {
  return apiRequest<CreateUserResponse>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** 更新用户（admin+） */
export function updateUser(userId: string, req: UpdateUserRequest) {
  return apiRequest<UpdateUserResponse>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(req)
  });
}

/** 删除用户（super_admin） */
export function deleteUser(userId: string) {
  return apiRequest<{ accounts: AccountSummary[] }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
}

/** 积分充值/调整（admin+） */
export function adjustCredits(userId: string, req: AdjustCreditsRequest) {
  return apiRequest<AdjustCreditsResponse>(`/api/admin/users/${encodeURIComponent(userId)}/credits`, {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** 当前用户积分变动记录 */
export function listCreditTransactions() {
  return apiRequest<CreditTransactionListResponse>("/api/credits/transactions");
}

// ===== 模型线路 =====

/** 公开线路列表（当前用户可选，不含 apiKey） */
export function listPublicChannels() {
  return apiRequest<ChannelListResponse>("/api/channels");
}

/** 管理线路列表（含 apiKey + 统计） */
export function listChannels() {
  return apiRequest<ChannelListResponse>("/api/admin/channels");
}

export function createChannel(req: CreateChannelRequest) {
  return apiRequest<{ channel: Channel }>("/api/admin/channels", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export function updateChannel(channelId: string, req: UpdateChannelRequest) {
  return apiRequest<{ channel: Channel }>(`/api/admin/channels/${encodeURIComponent(channelId)}`, {
    method: "PATCH",
    body: JSON.stringify(req)
  });
}

export function deleteChannel(channelId: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE"
  });
}

// ===== 类目 =====

/** 类目列表（普通用户只见启用的） */
export function listCategories() {
  return apiRequest<CategoryListResponse>("/api/categories");
}

export function createCategory(req: CreateCategoryRequest) {
  return apiRequest<{ category: Category }>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export function updateCategory(categoryId: string, req: UpdateCategoryRequest) {
  return apiRequest<{ category: Category }>(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
    method: "PATCH",
    body: JSON.stringify(req)
  });
}

export function deleteCategory(categoryId: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE"
  });
}
