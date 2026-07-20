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
  /** 手机号（短信注册用户），老 email 用户为空 */
  phone?: string;
  /** 初始密码标记：admin 建号 true，首登强制改密后清零 */
  mustChangePassword?: boolean;
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
  /** 创建任务时所属类目；旧记录无该字段。 */
  categoryId?: string | null;
  /** 用户上传的参考图（后端存 MinIO 后返回，旧记录可能为空） */
  referenceImages?: GeneratedImage[];
  channelId?: string | null;
  /** 任务绑定的模型线路名称；管理员历史列表展示。 */
  channelName?: string;
  /** 整组任务从开始处理到结束的耗时；旧记录可能为 0。 */
  durationMs?: number;
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
  trigger: "initial" | "user_refresh" | "admin_refresh" | "user_link_edit" | "admin_link_edit" | "auto";
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
  userLinkEditCount: number;
  /** 管理员无额度限制，因此该字段缺省。 */
  userLinkEditsRemaining?: number;
  /** 下次自动采集时间；首次提交后由后台异步采集，之后按 1/7/15 天节奏推进。 */
  nextRefreshAt?: string;
  snapshots: XHSNoteSnapshot[];
};

/** 历史列表响应（handler.go:83）{ history: SanitizedTask[] } */
export type HistoryResponse = {
  history: HistoryRecord[];
};

/** 一次真实上游模型请求携带的参考图快照；仅管理员调用审计可见，不含 Base64 原文。 */
export type ModelInvocationReference = {
  kind: string;
  name: string;
  mimeType: string;
  url: string;
  sha256: string;
  size: number;
};

/** 对应 generation.ModelInvocationRecord：一张子图的重试、fallback 均是独立一条。 */
export type ModelInvocation = {
  id: string;
  taskId: string;
  generationImageId: string;
  imageNumber: number;
  userId: string;
  username: string;
  userEmail: string;
  userRole: string;
  channelId: string;
  channelName: string;
  apiBaseUrl: string;
  protocol: string;
  modelId: string;
  candidateIndex: number;
  candidateCount: number;
  attemptNumber: number;
  attemptBudget: number;
  status: "processing" | "success" | "failed";
  prompt: string;
  promptHash: string;
  referenceImages: ModelInvocationReference[];
  size: string;
  quality: string;
  httpStatus: number;
  latencyMs: number;
  responseImageCount: number;
  error: string;
  requestedAt: string;
  completedAt?: string | null;
};

export type ModelInvocationQuery = {
  page?: number;
  pageSize?: number;
  taskId?: string;
  userId?: string;
  channelId?: string;
  status?: "processing" | "success" | "failed";
  startTime?: string;
  endTime?: string;
};

export type ModelInvocationListResponse = {
  invocations: ModelInvocation[];
  total: number;
  page: number;
  pageSize: number;
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

/** POST /api/v1/teams/users/login 请求体（email/phone 二选一，captcha_token 为空时后端跳过校验） */
export type LoginRequest = {
  email?: string;
  phone?: string;
  password: string;
  captcha_token?: string;
};

/** login 响应 = Resp.data = ApiUser（cookie 由后端 Set-Cookie 建立，无 token） */
export type LoginResponse = ApiUser;

/** PUT /api/v1/users/passwords/change 请求体（已登录改密，初始密码强制改密也走此接口） */
export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

/** PUT /api/v1/users 请求体（当前用户修改昵称 / 头像，multipart/form-data） */
export type UpdateCurrentUserRequest = {
  name?: string;
  avatar_url?: string;
};

/** PUT /api/v1/users/phone 请求体（登录态变更手机号，验证码校验新号） */
export type ChangePhoneRequest = {
  phone?: string;
  email?: string;
  code: string;
  channel: VerificationChannel;
};

/** PUT /api/v1/users/passwords/reset-request 请求体（邮件重置：发重置邮件，email 用户用） */
export type ResetPasswordEmailRequest = {
  emails: string[];
  captcha_token?: string;
};

/** PUT /api/v1/users/passwords/reset 请求体（token 重置密码：邮件链接跳转后提交） */
export type ResetPasswordTokenRequest = {
  token: string;
  new_password: string;
};

/** GET /api/admin/settings/sms 响应（短信服务配置，SecretKey 脱敏） */
export type SmsSettings = {
  enabled: boolean;
  secret_id: string;
  masked_secret_key: string;
  configured: boolean;
  app_id: string;
  sign_name: string;
  template_id: string;
  region: string;
  code_expire_min: number;
  send_interval_sec: number;
  daily_limit: number;
};

/** PUT /api/admin/settings/sms 请求（secret_key 空=保留原值不覆盖） */
export type SmsSettingsUpdateRequest = {
  enabled: boolean;
  secret_id: string;
  secret_key?: string;
  app_id: string;
  sign_name: string;
  template_id: string;
  region: string;
  code_expire_min: number;
  send_interval_sec: number;
  daily_limit: number;
};

/** GET /api/admin/settings/smtp 响应（SMTP 配置，密码脱敏） */
export type SmtpSettings = {
  host: string;
  port: string;
  username: string;
  masked_password: string;
  configured: boolean;
  from: string;
  tls: boolean;
};

/** PUT /api/admin/settings/smtp 请求（password 空=保留原值） */
export type SmtpSettingsUpdateRequest = {
  host: string;
  port: string;
  username: string;
  password?: string;
  from: string;
  tls: boolean;
};

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
export type TeamUserPassword = { account: string; password: string };

/** POST /api/v1/teams/users/with-password 请求体（批量建 subaccount 成员） */
export type CreateUserRequest = {
  phones: string[];
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

/** 统一错误：归一化后的 HTTP 错误，401 触发全局登出。
 *
 * - statusCode：HTTP 状态码；web.Resp 业务错误 HTTP 仍 200，由 code 区分。
 * - code：web.Resp 业务码（106xx），与 i18n key 对应；前端按 code 做差异化文案，不用 message 字符串判断。
 */
export type ApiError = Error & {
  statusCode?: number;
  code?: number;
};

/** 判断是否为 401 未授权错误 */
export function isUnauthorizedError(error: unknown): error is ApiError {
  return error instanceof Error && (error as ApiError).statusCode === 401;
}

/** 验证码通道（前端按响应 channel 渲染提示文案，不假设 phone 必走 SMS） */
export type VerificationChannel = "sms" | "email";

/** POST /api/v1/users/verification/send 请求体（phone 或 email 之一） */
export type SendVerificationCodeRequest = {
  phone?: string;
  email?: string;
  scene: "register" | "reset_password" | "change_phone";
  captcha_token?: string;
};

/** 验证码发送响应（前端保存 channel 给后续 register/reset 提交带回） */
export type VerificationDelivery = {
  channel: VerificationChannel;
  masked_destination: string;
  expires_in_seconds: number;
  retry_after_seconds: number;
};

/** POST /api/v1/users/register-by-code 请求体（phone 或 email 之一 + code + channel） */
export type RegisterByCodeRequest = {
  phone?: string;
  email?: string;
  password: string;
  code: string;
  channel: VerificationChannel;
};

/** PUT /api/v1/users/passwords/reset-by-code 请求体（phone 或 email 之一 + code + channel + 新密码） */
export type ResetByCodeRequest = {
  phone?: string;
  email?: string;
  code: string;
  channel: VerificationChannel;
  new_password: string;
};

/** 验证码业务错误码（与 backend/errcode/errcode.go 10633-10648 对齐） */
export const VerificationErrorCode = {
  PhoneRequired: 10633,
  PhoneInvalid: 10634,
  PhoneTaken: 10635,
  PhoneNotFound: 10636,
  SmsCodeRequired: 10637,
  SmsCodeInvalid: 10638,
  SmsSendTooFrequent: 10639,
  SmsSendFailed: 10640,
  RegisterDisabled: 10641,
  MustChangePassword: 10642,
  EmailCodeRequired: 10643,
  EmailCodeInvalid: 10644,
  EmailCodeSendTooFrequent: 10645,
  EmailCodeSendFailed: 10646,
  VerificationChannelUnavailable: 10647,
  SmsUnavailableForPhone: 10648,
  // 业务相关：email 注册查重 / phone 找回密码 email 兜底
  EmailTaken: 10613,
  EmailNotBound: 10615
} as const;
export type VerificationErrorCodeValue = (typeof VerificationErrorCode)[keyof typeof VerificationErrorCode];

/** 从 ApiError 提取业务码（无业务码返 undefined） */
export function errorCodeOf(error: unknown): number | undefined {
  if (error instanceof Error) {
    return (error as ApiError).code;
  }
  return undefined;
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
  /** 单次上游请求超时；0 表示使用系统兼容默认值。 */
  requestTimeoutMs: number;
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
  requestTimeoutMs?: number;
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
  /** pending=等待通道槽位；processing=已实际发往上游模型。 */
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
  /** 按创建任务所属类目筛选 */
  categoryId?: string;
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

/** 列表用的精简 ContentEngine（无 config 字段，对应后端 EngineSummaryResp）。
 *  content_engines.config 是 jsonb 大字段，列表页只用 8 个标量字段，裁剪后响应体 KB 级。 */
export type ContentEngineSummary = Omit<ContentEngine, "config">;

/** GET /api/admin/engines 管理列表响应（精简行，无 config） */
export type EngineSummaryListResponse = { engines: ContentEngineSummary[] };

/** GET /api/admin/engines/:id 返回完整 ContentEngine（含 config），供编辑弹窗回填 */
export type EngineDetailResponse = { engine: ContentEngine };

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

/** GET /api/engines/:key/capabilities 响应。 */
export type EngineCapabilitiesResponse = { copyEnabled: boolean };

/** GET /api/engines/:key/topic-options 响应 */
export type TopicOptionsResponse = { topics: string[] };
