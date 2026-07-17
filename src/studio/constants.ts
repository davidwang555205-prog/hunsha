/**
 * 工作台共享常量与辅助函数
 *
 * 选项数组、initialParams、getSettingsGenerationTitle 等，StudioPage 共用。
 * 此处保留固定枚举（品类/图片类型/尺寸/质量）与基础辅助函数。
 */
import type { FashionSeedingTopic } from "../utils/fashionSeeding";
import type {
  ImageType,
  ProductCategory,
  PromptParams
} from "../types";

export const productCategoryOptions: ProductCategory[] = ["婚纱 / 礼服", "裙装 / 女装"];
export const imageTypeOptions: ImageType[] = ["产品上身图", "对镜穿搭图", "生活场景图", "非产品氛围图", "拍摄花絮 / 材质图", "产品静物图"];
// 图片尺寸（宽高比），用户在生图设置选择，后端按渠道协议适配：
//   openai 协议（官方 OpenAI/WalaAPI）-> 分辨率 size（3:4->1152x1536）；
//   openrouter 协议 -> 按模型 supported_parameters 传 aspect_ratio/resolution，不支持则不传（模型自决）。
export const imageSizeOptions = [
  { value: "3:4", label: "3:4 竖图" },
  { value: "1:1", label: "1:1 方图" },
  { value: "16:9", label: "16:9 横图" },
  { value: "4:3", label: "4:3 横图" }
];
export const defaultImageSize = "3:4";
export const qualityOptions = [
  { value: "medium", label: "M / standard" },
  { value: "low", label: "L / low" },
  { value: "high", label: "H / high" },
  { value: "auto", label: "Auto" }
];
export const defaultImageQuality = "medium";

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

// 首个可选主题由工作台拉取内容引擎 JSON 后设置，前端不保留主题默认值。
export const initialContentTopic: FashionSeedingTopic = "";

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition duration-fast ease-out focus:border-primary focus:ring-2 focus:ring-primary-50 disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-subtle";
export const labelClass = "text-sm font-medium text-text";
export const mutedClass = "text-sm leading-6 text-text-muted";
export const panelClass = "rounded-md bg-surface p-5 shadow-sm ring-1 ring-border";

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
