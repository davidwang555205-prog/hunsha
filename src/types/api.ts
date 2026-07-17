/**
 * API 请求/响应类型 -- 前后端单一事实源
 *
 * 认证切 MonkeyCode team（cookie session），用户类型对应 backend/domain.User：
 *   - login/status/logout/成员管理 走 /api/v1/teams/users/*（web.Resp 包装 {code,message,data}，client 自动解包 data）
 *   - 8 模块（generation/credits/engines/categories/channels/syssetting）走 bridal 路径，响应扁平
 * 错误体：8 模块 { error }，team { code, message }，client 归一化为 error||message。
 */
import type { PromptParams } from "../types";

/** 对应 consts.UserRole（consts/user.go:26-29）：bridal admin=enterprise，受限成员=subaccount */
export type UserRole = "individual" | "enterprise" | "subaccount" | "admin";

/** 对应 domain.User（domain/user.go:88），team login/status 返回的 Resp.data */
export type ApiUser = {
  id: string;
  name: string;
  avatar_url: string;
  email: string;
  role: UserRole;
  status: string;
  is_blocked: boolean;
  wechat_mp_bound: boolean;
  has_password: boolean;
  username: string;
  displayName: string;
  dailyImageLimit: number;
  credits: number;
  /** 空数组表示可见全部启用类目；非空时仅能看到所列类目。 */
  visibleCategoryIds: string[];
  team?: Team | null;
};

/** 对应 domain.Team */
export type Team = { id: string; name: string };

/** 会话：cookie session 无 token，仅持有当前 user（内存态，刷新靠 /status 恢复） */
export type Session = { user: ApiUser };

/** 对应 domain.TeamUser（team /status 返回的 Resp.data） */
export type TeamUser = { user: ApiUser; team: Team | null; login?: boolean };
export type StatusResponse = TeamUser;

/** 对应 generation.ImageRecord（repo.go:30） */
export type GeneratedImage = {
  id: string;
  name?: string;
  url: string;
  downloadUrl: string;
  source: "local" | "remote";
  /** 参考图类型：scene=场景参考图, product=婚纱产品图；生成图无此字段，旧历史记录无此字段兜底当产品图 */
  kind?: "scene" | "product";
  /** 列表/详情缩略图 URL（COS imageMogr2 等比缩放 480px，~260KB）；缺省兜底用 url */
  thumbUrl?: string;
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
  /** 用户上传的参考图（后端存 MinIO 后返回，旧记录可能为空） */
  referenceImages?: GeneratedImage[];
  channelId?: string | null;
  /** 给大模型的提示词（仅管理员侧返回，用户侧为空数组） */
  prompts?: string[];
  /** 小红书发布反馈，null=未反馈 */
  feedback?: TaskFeedback | null;
};

/** 小红书发布反馈（对应后端 types.TaskFeedback） */
export type TaskFeedback = {
  noteUrl: string;
  views: number;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  /** ISO 时间，空=未反馈 */
  submittedAt?: string;
};

/** POST /api/v1/generation/tasks/:id/feedback 请求体 */
export type SubmitFeedbackRequest = {
  noteUrl: string;
  views: number;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
};

/** Redfox 相似账号快照；对应 generation_task_xhs_snapshots.similar_accounts。 */
export type XHSSimilarAccount = {
  rank: number;
  tier: "same_level" | "high_level";
  accountId: string;
  nickname: string;
  avatar: string;
  url: string;
  fans: number;
  level: string;
  collected: number;
  liked: number;
  totalWork: number;
  noteCountSeven: number;
  interactiveCountSeven: number;
  interactiveCountThirty: number;
};

/** Redfox 账号基础数据；每个笔记刷新快照均保留一份，供趋势复盘。 */
export type XHSAccountSnapshot = {
  name: string;
  avatar: string;
  displayId: string;
  userId: string;
  description: string;
  fans: number;
  totalWorks: number;
  likes: number;
  collects: number;
  follows: number;
  updatedAt: string;
};

export type XHSNoteSnapshot = {
  id: string;
  sequence: number;
  trigger: "initial" | "user_refresh" | "admin_refresh";
  status: "success" | "failed";
  error?: string;
  capturedAt: string;
  workUpdatedAt: string;
  views: number;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  account: XHSAccountSnapshot;
  similarAccounts: XHSSimilarAccount[];
  similarSummary: string;
};

/** 一条生图历史关联的小红书笔记，以及所有可追溯的数据快照。 */
export type XHSNoteTracking = {
  id: string;
  taskId: string;
  noteUrl: string;
  canonicalUrl: string;
  workId: string;
  title: string;
  body: string;
  coverUrl: string;
  workType: string;
  publishedAt: string;
  userRefreshCount: number;
  /** 管理员无额度限制，因此该字段缺省。 */
  userRefreshesRemaining?: number;
  snapshots: XHSNoteSnapshot[];
};

/** 历史列表响应（handler.go:83）{ history: SanitizedTask[] } */
export type HistoryResponse = {
  history: HistoryRecord[];
};

/** 生图统计（GET /api/v1/generation/stats，对应后端 generation.StatsResp） */
export type GenerationStats = {
  requestCount: number;
  successCount: number;
  failedCount: number;
  imageCount: number;
  dailyImages: number;
  lastGeneratedAt: number;
};

/** 单日趋势聚合（上海时区日期），对应后端 generation.TrendDay */
export type TrendDay = {
  date: string;
  total: number;
  success: number;
  failed: number;
  images: number;
};

/** 单条模型线路的趋势，对应后端 generation.ChannelTrend */
export type ChannelTrend = {
  channelId: string;
  channelName: string;
  days: TrendDay[];
};

/** 趋势统计（GET /api/v1/generation/stats/trend，对应后端 generation.StatsTrendResp） */
export type GenerationStatsTrend = {
  days: TrendDay[];
  channels: ChannelTrend[];
};

/** 对应 generation.GenerateResp（usecase.go:132）{ record: SanitizedTask } */
export type GenerateResponse = {
  record: HistoryRecord;
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
  /** 场景参考图（0~1 张，可选），传了则锁定在该场景生成 */
  sceneReferenceImage?: ReferenceImageUpload;
  /** 婚纱产品图（4~6 张，必传） */
  productReferenceImages: ReferenceImageUpload[];
  size: string;
  quality: string;
};

/** POST /api/v1/teams/users/login 请求体（captcha_token 为空时后端跳过校验） */
export type LoginRequest = {
  email: string;
  password: string;
  captcha_token?: string;
};

/** login 响应 = Resp.data = ApiUser（cookie 由后端 Set-Cookie 建立，无 token） */
export type LoginResponse = ApiUser;

/** team 成员角色（consts/team.go:6-7） */
export type TeamMemberRole = "admin" | "user";

/** 对应 domain.TeamMemberInfo（team MemberList 返回的成员，无 bridalauth 统计字段） */
export type TeamMemberInfo = {
  user: ApiUser;
  role: TeamMemberRole;
  created_at: number;
  last_active_at: number;
};

/** GET /api/v1/teams/users 响应 = Resp.data */
export type MemberListResponse = {
  members: TeamMemberInfo[];
  member_limit: number;
  total: number;
  page: number;
  pageSize: number;
};

/** 创号/重置密码返回的初始密码（仅回传一次） */
export type TeamUserPassword = { email: string; password: string };

/** POST /api/v1/teams/users/with-password 请求体（批量建 subaccount 成员） */
export type CreateUserRequest = {
  emails: string[];
  dailyImageLimit: number;
};

/** 创号响应 = Resp.data，含初始密码 */
export type CreateUserResponse = {
  users: TeamUser[];
  passwords: TeamUserPassword[];
};

/** PUT /api/v1/teams/users/:id 请求体（bridal 扩展 dailyImageLimit/credits） */
export type UpdateUserRequest = {
  name?: string;
  is_blocked?: boolean;
  dailyImageLimit?: number;
  credits?: number;
  visibleCategoryIds?: string[];
};

/** 更新响应 = Resp.data */
export type UpdateUserResponse = { user: ApiUser };

/** 重置密码响应 = Resp.data */
export type ResetPasswordResponse = TeamUserPassword;

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
  protocol: string;
  modelId: string;
  supportedSizes: string[];
  defaultQuality: string;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  maxConcurrency: number;
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
  protocol?: string;
  modelId: string;
  supportedSizes?: string[];
  defaultQuality?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  maxConcurrency?: number;
};

export type UpdateChannelRequest = Partial<Omit<CreateChannelRequest, "id">>;

/** 内容类目 */
export type Category = {
  id: string;
  name: string;
  icon: string;
  engine: string;
  description: string;
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
  description?: string;
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
  /** 用户上传的参考图（scene/product，恢复任务时回显；进行中任务可能为空） */
  referenceImages?: GeneratedImage[];
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
  /** 场景参考图（0~1 张，可选），传了则锁定在该场景生成 */
  sceneReferenceImage?: ReferenceImageUpload;
  /** 婚纱产品图（4~6 张，必传） */
  productReferenceImages: ReferenceImageUpload[];
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
  username: string;
  displayName: string;
  name: string;
  email: string;
  type: "recharge" | "consume" | "adjust";
  amount: number;
  balanceAfter: number;
  description: string;
  relatedTaskId: string | null;
  createdAt: string;
};

export type CreditTransactionListResponse = { transactions: CreditTransaction[] };

export type AllCreditTransactionsResponse = {
  transactions: CreditTransaction[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdjustCreditsRequest = {
  amount: number;
  type?: "recharge" | "adjust";
  description?: string;
};

/** 调整积分响应（账号概要改走 MemberList，此处只回 user + balance） */
export type AdjustCreditsResponse = {
  user: ApiUser;
  balance: number;
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
  startTime?: string;
  endTime?: string;
  q?: string;
  taskId?: string;
  /** admin 按用户筛选 */
  userId?: string;
};

/** 系统设置（后台可配运行时配置，如 retention_days 数据保留天数） */
export type SystemSetting = {
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
};

export type SettingsListResponse = { settings: SystemSetting[] };

export type UpdateSettingRequest = {
  value: Record<string, unknown>;
};

export type UpdateSettingResponse = { setting: SystemSetting };

/** 内容引擎配置（后台可配，config 存可编辑素材如主题覆盖文案） */
export type ContentEngine = {
  id: string;
  key: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EngineListResponse = { engines: ContentEngine[] };

/** 主题覆盖文案（每个主题 10 字段，均 string[]，可选--未覆盖字段用默认） */
export type TopicOverride = {
  audiences?: string[];
  focuses?: string[];
  concerns?: string[];
  proofs?: string[];
  scenes?: string[];
  materials?: string[];
  services?: string[];
  takeaways?: string[];
  tones?: string[];
  tagExtras?: string[];
};

/** 默认素材（编辑弹窗与 config.seeding 合并显示；只声明结构化编辑的组，其他组宽松） */
export type DefaultAssets = {
  xiaohongshuTopicOverrides?: Record<string, TopicOverride>;
  /** 内容引擎主题来源；数组顺序决定工作台展示顺序。 */
  bridalTopics?: string[];
  dressTopics?: string[];
  titleStarters?: string[];
  titleAngles?: string[];
  titleClosers?: string[];
  [key: string]: unknown;
};

export type CreateEngineRequest = {
  key: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  isEnabled?: boolean;
  sortOrder?: number;
};

export type UpdateEngineRequest = Partial<CreateEngineRequest>;

/** 关键词档案（镜像 backend/biz/generation/prompt/assets.go KeywordProfile） */
export type PromptKeywordProfile = {
  promptLine: string;
  negativeLine: string;
};

/** 生图 prompt 素材（镜像 backend/biz/generation/prompt/assets.go Assets，即 content_engines.config.imagePrompt 存储格式）。
 *  由后端 PromptOptions 接口返回 MergeAssets 合并后的当前生效值；字段全可选，未配置字段用代码默认。 */
export type PromptAssets = {
  materialImageTypes?: string[];
  wornImageTypes?: string[];
  categoryLines?: Record<string, string>;
  bridalStyleLines?: Record<string, string>;
  dressStyleLines?: Record<string, string>;
  imageTypeLines?: Record<string, string>;
  sceneLines?: Record<string, string>;
  modelLines?: Record<string, string>;
  seasonLines?: Record<string, string>;
  lightLines?: Record<string, string>;
  bridalImageKeywordProfiles?: Record<string, PromptKeywordProfile>;
  bridalScenesByImageType?: Record<string, string[]>;
  dressScenesByImageType?: Record<string, string[]>;
  bridalReferenceDetails?: string[];
  dressReferenceDetails?: string[];
  negativeRules?: string[];
};

/** GET /api/engines/:key/prompt-options 响应 */
export type PromptOptionsResponse = { assets: PromptAssets };

/** GET /api/engines/:key/topic-options 响应 */
export type TopicOptionsResponse = { topics: string[] };
