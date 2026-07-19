/**
 * 内容引擎 prompt 素材 API
 *
 * getPromptOptions：拉当前生效的 imagePrompt 素材（MergeAssets 合并 config.imagePrompt 与代码默认），
 * 供前台 UI 选项与 admin 编辑弹窗显示生效值。后端 content_engines.config.imagePrompt 为单一事实源。
 */
import { apiRequest } from "./client";
import type { ProductCategory } from "../types";
import type { EngineCapabilitiesResponse, PromptOptionsResponse, TopicOptionsResponse } from "../types/api";

/** GET /api/engines/:key/prompt-options -- 当前生效的 imagePrompt 素材（登录可读） */
export function getPromptOptions(engineKey = "bridal") {
  return apiRequest<PromptOptionsResponse>(`/api/engines/${engineKey}/prompt-options`);
}

/** GET /api/engines/:key/topic-options -- 当前引擎允许在工作台选择的主题 */
export function getEngineTopicOptions(engineKey: string, productCategory: ProductCategory) {
  const query = new URLSearchParams({ productCategory });
  return apiRequest<TopicOptionsResponse>(`/api/engines/${encodeURIComponent(engineKey)}/topic-options?${query}`);
}

/** GET /api/engines/:key/capabilities -- 是否生成文案等通用引擎能力。 */
export function getEngineCapabilities(engineKey: string) {
  return apiRequest<EngineCapabilitiesResponse>(`/api/engines/${encodeURIComponent(engineKey)}/capabilities`);
}
