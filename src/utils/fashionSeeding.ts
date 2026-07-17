/**
 * 内容引擎前端契约。
 *
 * 主题列表与每日选题均由后端内容引擎 config.seeding 决定；前端不维护主题枚举，
 * 以支持管理后台直接在内容引擎 JSON 中新增、改名或删除主题。
 */
import type { PromptParams } from "../types";

export type FashionSeedingTopic = string;
export type FashionSeedingDailySlot = 1 | 2;

export type FashionSeedingImagePlan = {
  name: string;
  purpose: string;
  description: string;
  params: PromptParams;
};

export type FashionSeedingContent = {
  topic: FashionSeedingTopic;
  dateKey: string;
  dailySlot: FashionSeedingDailySlot;
  variantIndex: number;
  variantCount: number;
  variantLabel: string;
  titles: string[];
  body: string;
  images: FashionSeedingImagePlan[];
  tags: string[];
  note: string;
};

export const fashionSeedingDailySlotOptions: FashionSeedingDailySlot[] = [1, 2];
