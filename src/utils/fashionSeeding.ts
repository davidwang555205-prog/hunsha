/**
 * 小红书内容引擎 -- 前端保留的轻量部分（类型 + 主题列表 + 确定性选题）。
 *
 * 任务②阶段5：文案/配图算法（generateFashionSeedingContent）已迁 Go 后端
 * （backend/biz/engines/seeding/），前端通过 POST /api/engines/:key/generate 调用。
 * 本文件只保留前端 UI 需要的类型 + 主题下拉列表 + 确定性选题（getDailyFashionSeedingSelection，
 * 用于 constants.ts 算默认 topic），不依赖素材库/NarrativePool。
 *
 * 算法源（含素材）已移至 backup/nodejs/，Go 侧 byte-for-byte 等价（78 黄金样本验证）。
 */
import { xiaohongshuBridalTopicOptions, type XiaohongshuBridalTopic } from "../data/xiaohongshuBridalContentProfiles";
import type { PromptParams, ProductCategory } from "../types";

export type BridalFashionTopic =
  | "试纱体验"
  | XiaohongshuBridalTopic
  | "极简新娘"
  | "法式婚纱"
  | "草坪婚礼"
  | "酒店婚礼"
  | "海边旅拍"
  | "登记照"
  | "晚宴礼服"
  | "婚礼前一天"
  | "新娘独处时刻";

export type DressFashionTopic =
  | "通勤裙装"
  | "约会裙装"
  | "周末裙装"
  | "度假长裙"
  | "艺术馆穿搭"
  | "下午茶"
  | "晚餐约会"
  | "轻熟日常"
  | "秋冬裙装"
  | "一条裙子的多场景";

export type FashionSeedingTopic = BridalFashionTopic | DressFashionTopic;
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

const TOPIC_VARIANT_COUNT = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_POST_COUNT = 2;

export const bridalFashionTopicOptions: BridalFashionTopic[] = [
  "试纱体验",
  ...xiaohongshuBridalTopicOptions,
  "极简新娘",
  "法式婚纱",
  "草坪婚礼",
  "酒店婚礼",
  "海边旅拍",
  "登记照",
  "晚宴礼服",
  "婚礼前一天",
  "新娘独处时刻"
];

export const dressFashionTopicOptions: DressFashionTopic[] = [
  "通勤裙装",
  "约会裙装",
  "周末裙装",
  "度假长裙",
  "艺术馆穿搭",
  "下午茶",
  "晚餐约会",
  "轻熟日常",
  "秋冬裙装",
  "一条裙子的多场景"
];

export const fashionSeedingDailySlotOptions: FashionSeedingDailySlot[] = [1, 2];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getDayNumber(date = new Date()) {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.floor(localMidnight / MS_PER_DAY);
}

function resolveDailySlot(slot?: FashionSeedingDailySlot): FashionSeedingDailySlot {
  return slot === 2 ? 2 : 1;
}

function getTopicOptions(productCategory: ProductCategory): FashionSeedingTopic[] {
  return productCategory === "婚纱 / 礼服" ? bridalFashionTopicOptions : dressFashionTopicOptions;
}

export function getFashionSeedingTopicOptions(productCategory: ProductCategory) {
  return getTopicOptions(productCategory);
}

// 每日确定性选题（与 Go GetDailyFashionSeedingSelection 等价，前端用于算默认 topic）。
export function getDailyFashionSeedingSelection(
  productCategory: ProductCategory,
  date = new Date(),
  dailySlot: FashionSeedingDailySlot = 1
) {
  const topicOptions = getTopicOptions(productCategory);
  const safeSlot = resolveDailySlot(dailySlot);
  const globalPostIndex = getDayNumber(date) * DAILY_POST_COUNT + (safeSlot - 1);
  const topic = topicOptions[globalPostIndex % topicOptions.length];
  const variantCount = TOPIC_VARIANT_COUNT;
  const variantIndex = Math.floor(globalPostIndex / topicOptions.length) % variantCount;

  return {
    dateKey: getLocalDateKey(date),
    dailySlot: safeSlot,
    topic,
    variantIndex,
    variantCount,
    variantLabel: `第 ${variantIndex + 1} / ${variantCount} 版`
  };
}
