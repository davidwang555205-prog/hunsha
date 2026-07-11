/**
 * 工作台共享常量与辅助函数
 *
 * 选项数组、initialParams、getSettingsGenerationTitle 等，StudioPage 与（未来）拆出的
 * ParamsForm/ContentPanel 共用。从原 App.tsx 顶层迁移，逻辑零改动。
 */
import {
  getDailyFashionSeedingSelection,
  type FashionSeedingDailySlot,
  type FashionSeedingTopic
} from "../utils/generateFashionSeedingContent";
import { isSceneCompatibleWithImageType } from "../data/bridalDressSceneOptions";
import type {
  BridalStyle,
  DressStyle,
  ImageType,
  LightPreference,
  ProductCategory,
  PromptParams,
  Season
} from "../types";

export const productCategoryOptions: ProductCategory[] = ["婚纱 / 礼服", "裙装 / 女装"];
export const bridalStyleOptions: BridalStyle[] = [
  "极简缎面婚纱",
  "法式蕾丝婚纱",
  "A-line 婚纱",
  "鱼尾婚纱",
  "公主裙婚纱",
  "轻婚纱",
  "短款婚纱",
  "晚宴礼服",
  "自定义"
];
export const dressStyleOptions: DressStyle[] = ["连衣裙", "衬衫裙", "针织裙", "吊带裙", "A字裙", "半裙", "度假长裙", "通勤裙", "自定义"];
export const imageTypeOptions: ImageType[] = ["产品上身图", "对镜穿搭图", "生活场景图", "非产品氛围图", "拍摄花絮 / 材质图", "产品静物图"];
export const seasonOptions: Season[] = ["春", "夏", "秋", "冬"];
export const lightPreferenceOptions: LightPreference[] = ["自动匹配", "清晨自然光", "午后柔光", "傍晚金色光", "室内窗边光", "酒店暖光", "婚礼现场自然光"];
export const sizeOptions = ["1152x1536", "1024x1024", "1024x1536", "1536x1024"];
export const qualityOptions = [
  { value: "medium", label: "M / standard" },
  { value: "low", label: "L / low" },
  { value: "high", label: "H / high" },
  { value: "auto", label: "Auto" }
];
export const defaultImageQuality = "medium";
export const preferredBridalContentTopic: FashionSeedingTopic = "真实客户试纱";

export const initialParams: PromptParams = {
  productCategory: "婚纱 / 礼服",
  bridalStyle: "极简缎面婚纱",
  dressStyle: "连衣裙",
  customProductName: "",
  imageType: "产品上身图",
  modelChoice: "亚洲新娘感模特 25–35",
  season: "春",
  scenePreference: "酒店套房晨光",
  lightPreference: "室内窗边光",
  extraRequirement: "",
  generationNonce: 0
};

const initialDailySelection = getDailyFashionSeedingSelection(initialParams.productCategory, new Date(), 1);
export const initialContentTopic: FashionSeedingTopic =
  initialParams.productCategory === "婚纱 / 礼服" ? preferredBridalContentTopic : initialDailySelection.topic;

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition duration-fast ease-out focus:border-primary focus:ring-2 focus:ring-primary-50 disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-subtle";
export const labelClass = "text-sm font-medium text-text";
export const mutedClass = "text-sm leading-6 text-text-muted";
export const panelClass = "rounded-md bg-surface p-5 shadow-sm ring-1 ring-border";
export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition duration-fast ease-out hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-surface px-4 py-2.5 text-sm font-medium text-text ring-1 ring-border transition duration-fast ease-out hover:bg-bg hover:ring-border-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export function updateField<K extends keyof PromptParams>(params: PromptParams, key: K, value: PromptParams[K]) {
  return { ...params, [key]: value };
}

export function getSelectedStyle(params: PromptParams) {
  return params.productCategory === "婚纱 / 礼服" ? params.bridalStyle : params.dressStyle;
}

export function getSettingsGenerationTitle(params: PromptParams) {
  return params.customProductName.trim() || getSelectedStyle(params) || params.imageType;
}

export function getSettingsGenerationBody(params: PromptParams) {
  const rows = [
    `品类：${params.productCategory}`,
    `款式：${getSelectedStyle(params)}`,
    `图片类型：${params.imageType}`,
    `场景：${params.scenePreference}`,
    `模特：${params.modelChoice}`,
    `季节：${params.season}`,
    `光线：${params.lightPreference}`
  ];
  if (params.customProductName.trim()) rows.push(`自定义款式：${params.customProductName.trim()}`);
  if (params.extraRequirement.trim()) rows.push(`补充要求：${params.extraRequirement.trim()}`);
  return rows.join("\n");
}

export function getDefaultContentTopic(productCategory: ProductCategory, dailySlot: FashionSeedingDailySlot) {
  if (productCategory === "婚纱 / 礼服") return preferredBridalContentTopic;
  return getDailyFashionSeedingSelection(productCategory, new Date(), dailySlot).topic;
}

export function handleCategoryChangeHelper(
  current: PromptParams,
  productCategory: ProductCategory,
  dailySlot: FashionSeedingDailySlot
): { params: PromptParams; topic: FashionSeedingTopic } {
  const topic = getDefaultContentTopic(productCategory, dailySlot);
  const nextParams: PromptParams = {
    ...current,
    productCategory,
    modelChoice: productCategory === "婚纱 / 礼服" ? "亚洲新娘感模特 25–35" : "轻熟风裙装模特 28–40",
    scenePreference: isSceneCompatibleWithImageType(productCategory, current.imageType, current.scenePreference)
      ? current.scenePreference
      : "自动匹配"
  };
  return { params: nextParams, topic };
}

export function handleImageTypeChangeHelper(current: PromptParams, imageType: ImageType): PromptParams {
  return {
    ...current,
    imageType,
    scenePreference: isSceneCompatibleWithImageType(current.productCategory, imageType, current.scenePreference)
      ? current.scenePreference
      : "自动匹配"
  };
}

export { isSceneCompatibleWithImageType };
