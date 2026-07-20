/**
 * 管理后台 API（V2 · team 认证）
 *
 * 用户管理走 team 路由（/api/v1/teams/users/*，web.Resp 包装，client 解包 data）：
 *   GET    /api/v1/teams/users                 成员列表（MemberList）
 *   POST   /api/v1/teams/users/with-password   批量建成员（返回初始密码）
 *   PUT    /api/v1/teams/users/:id             更新成员（name/isBlocked/dailyImageLimit/credits）
 *   DELETE /api/v1/teams/users/:id             删除成员
 *   PUT    /api/v1/teams/users/:id/passwords/reset  重置密码
 * 积分/线路/类目/引擎/设置走 bridal 8 模块路径（c.JSON 扁平）：
 *   POST /api/admin/users/:id/credits          调整积分
 *   GET  /api/credits/transactions             当前用户积分明细
 *   GET  /api/admin/credits/transactions        admin 全平台积分流水
 *   GET/POST/PATCH/DELETE /api/admin/{channels,categories,engines,settings}
 */
import { apiRequest } from "./client";
import type {
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
  AllCreditTransactionsResponse,
  ContentEngine,
  CreateEngineRequest,
  DefaultAssets,
  EngineListResponse,
  MemberListResponse,
  ResetPasswordResponse,
  SettingsListResponse,
  SmsSettings,
  SmsSettingsUpdateRequest,
  SmtpSettings,
  SmtpSettingsUpdateRequest,
  UpdateCategoryRequest,
  UpdateChannelRequest,
  UpdateEngineRequest,
  UpdateSettingRequest,
  UpdateSettingResponse,
  UpdateUserRequest,
  UpdateUserResponse
} from "../types/api";
import type { PromptParams, ProductCategory } from "../types";
import type { FashionSeedingContent, FashionSeedingDailySlot, FashionSeedingTopic } from "../utils/fashionSeeding";

// ===== 团队成员管理（team 路由） =====

/** 成员列表（admin，支持分页 + 搜索：page/pageSize/q） */
export function listMembers(page = 1, pageSize = 0, q?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (pageSize > 0) params.set("pageSize", String(pageSize));
  if (q) params.set("q", q);
  return apiRequest<MemberListResponse>(`/api/v1/teams/users?${params.toString()}`);
}

/** 批量建成员（admin，返回初始密码） */
export function createUser(req: CreateUserRequest) {
  return apiRequest<CreateUserResponse>("/api/v1/teams/users/with-password", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

/** 更新成员（admin，改 name/停用/额度/积分） */
export function updateUser(userId: string, req: UpdateUserRequest) {
  return apiRequest<UpdateUserResponse>(`/api/v1/teams/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

/** 删除成员（admin） */
export function deleteUser(userId: string) {
  return apiRequest<unknown>(`/api/v1/teams/users/${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
}

/** 重置成员密码（admin，返回新密码） */
export function resetPassword(userId: string) {
  return apiRequest<ResetPasswordResponse>(`/api/v1/teams/users/${encodeURIComponent(userId)}/passwords/reset`, {
    method: "PUT"
  });
}

// ===== 积分（bridal 8 模块路径） =====

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

/** admin 全平台积分流水（分页 + 过滤：userId/type/startTime/endTime） */
export function listAllCreditTransactions(
  page = 1,
  pageSize = 20,
  filter?: { userId?: string; type?: string; startTime?: string; endTime?: string }
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter?.userId) params.set("userId", filter.userId);
  if (filter?.type) params.set("type", filter.type);
  if (filter?.startTime) params.set("startTime", filter.startTime);
  if (filter?.endTime) params.set("endTime", filter.endTime);
  return apiRequest<AllCreditTransactionsResponse>(`/api/admin/credits/transactions?${params.toString()}`);
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

/** 管理类目列表（admin，含禁用） */
export function listAllCategories() {
  return apiRequest<CategoryListResponse>("/api/admin/categories");
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

/** 上传类目卡片封面图，返回可访问 URL（/api/v1/generation/images/{filename}），存入 category.config.coverImages */
export function uploadCategoryCover(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<{ url: string }>("/api/admin/categories/upload-cover", {
    method: "POST",
    body: form
  });
}

// ===== 系统设置 =====

/** 系统设置列表（admin） */
export function listSettings() {
  return apiRequest<SettingsListResponse>("/api/admin/settings");
}

/** 更新单个系统设置（admin） */
export function updateSetting(key: string, req: UpdateSettingRequest) {
  return apiRequest<UpdateSettingResponse>(`/api/admin/settings/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(req)
  });
}

/** GET /api/admin/settings/sms（短信服务配置，SecretKey 脱敏） */
export function getSmsSettings() {
  return apiRequest<{ sms: SmsSettings }>("/api/admin/settings/sms");
}

/** PUT /api/admin/settings/sms（更新短信服务配置，secret_key 空=保留原值） */
export function updateSmsSettings(req: SmsSettingsUpdateRequest) {
  return apiRequest<{ sms: SmsSettings }>("/api/admin/settings/sms", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

/** GET /api/admin/settings/smtp（邮箱服务配置，密码脱敏） */
export function getSmtpSettings() {
  return apiRequest<{ smtp: SmtpSettings }>("/api/admin/settings/smtp");
}

/** PUT /api/admin/settings/smtp（更新邮箱服务配置，password 空=保留原值） */
export function updateSmtpSettings(req: SmtpSettingsUpdateRequest) {
  return apiRequest<{ smtp: SmtpSettings }>("/api/admin/settings/smtp", {
    method: "PUT",
    body: JSON.stringify(req)
  });
}

// ===== 内容引擎 =====

/** 公开内容引擎列表（仅启用，含 config 供运行时拉取） */
export function listEngines() {
  return apiRequest<EngineListResponse>("/api/engines");
}

/** 生成内容请求（对应后端 GenerateReq / TS FashionSeedingInput） */
export type GenerateContentRequest = {
  productCategory: ProductCategory;
  baseParams: PromptParams;
  imageCount?: 3 | 5;
  topic?: FashionSeedingTopic;
  dailySlot: FashionSeedingDailySlot;
  contentNonce: number;
};

/** 生成内容（任务②阶段4：POST /api/engines/:key/generate，后端确定性算法 + config 覆盖素材） */
export function generateContent(engineKey: string, req: GenerateContentRequest) {
  return apiRequest<{ content: FashionSeedingContent }>(
    `/api/engines/${encodeURIComponent(engineKey)}/generate`,
    { method: "POST", body: JSON.stringify(req) }
  );
}

/** 管理内容引擎列表（admin，含禁用） */
export function listAllEngines() {
  return apiRequest<EngineListResponse>("/api/admin/engines");
}

/** 默认素材（admin，供编辑弹窗与 config.seeding 合并显示当前生效值） */
export function getDefaultAssets() {
  return apiRequest<{ assets: DefaultAssets }>("/api/admin/engines/default-assets");
}

export function createEngine(req: CreateEngineRequest) {
  return apiRequest<{ engine: ContentEngine }>("/api/admin/engines", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export function updateEngine(engineId: string, req: UpdateEngineRequest) {
  return apiRequest<{ engine: ContentEngine }>(`/api/admin/engines/${encodeURIComponent(engineId)}`, {
    method: "PATCH",
    body: JSON.stringify(req)
  });
}

export function deleteEngine(engineId: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/engines/${encodeURIComponent(engineId)}`, {
    method: "DELETE"
  });
}
