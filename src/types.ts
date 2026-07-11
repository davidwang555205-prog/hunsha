import type { BridalImageKeywordProfileId } from "./data/bridalImageKeywordProfiles";

export type ProductCategory = "婚纱 / 礼服" | "裙装 / 女装";

export type BridalStyle =
  | "极简缎面婚纱"
  | "法式蕾丝婚纱"
  | "A-line 婚纱"
  | "鱼尾婚纱"
  | "公主裙婚纱"
  | "轻婚纱"
  | "短款婚纱"
  | "晚宴礼服"
  | "自定义";

export type DressStyle =
  | "连衣裙"
  | "衬衫裙"
  | "针织裙"
  | "吊带裙"
  | "A字裙"
  | "半裙"
  | "度假长裙"
  | "通勤裙"
  | "自定义";

export type ImageType =
  | "产品上身图"
  | "对镜穿搭图"
  | "生活场景图"
  | "非产品氛围图"
  | "拍摄花絮 / 材质图"
  | "产品静物图";

export type ScenePreference =
  | "自动匹配"
  | "试纱间"
  | "婚纱店橱窗"
  | "酒店套房晨光"
  | "婚礼前化妆间"
  | "草坪婚礼"
  | "教堂门口"
  | "海边旅拍"
  | "登记照"
  | "订婚宴"
  | "晚宴礼服"
  | "入户镜前"
  | "咖啡馆"
  | "艺术馆"
  | "花店"
  | "城市街角"
  | "通勤写字楼"
  | "酒店门口"
  | "度假海边"
  | "晚餐约会"
  | "电梯镜拍"
  | "衣帽间"
  | "窗边阅读"
  | "材质工作台";

export type ModelChoice =
  | "亚洲新娘感模特 25–35"
  | "高级婚纱店真实试纱客户"
  | "轻熟风裙装模特 28–40"
  | "度假裙装自然模特"
  | "通勤裙装城市女性"
  | "晚宴礼服气质模特"
  | "不指定人物，仅产品静物";

export type Season = "春" | "夏" | "秋" | "冬";

export type LightPreference =
  | "自动匹配"
  | "清晨自然光"
  | "午后柔光"
  | "傍晚金色光"
  | "室内窗边光"
  | "酒店暖光"
  | "婚礼现场自然光";

export type PromptParams = {
  productCategory: ProductCategory;
  bridalStyle: BridalStyle;
  dressStyle: DressStyle;
  customProductName: string;
  imageType: ImageType;
  modelChoice: ModelChoice;
  season: Season;
  scenePreference: ScenePreference;
  lightPreference: LightPreference;
  extraRequirement: string;
  generationNonce: number;
  bridalKeywordProfileId?: BridalImageKeywordProfileId;
  /** 对齐后端 prompt.Params.GeneratedImageName（prompt.go:23），生图时由调用方填写 */
  generatedImageName?: string;
};
