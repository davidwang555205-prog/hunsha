import type { ImageType, ProductCategory, ScenePreference } from "../types";

const autoScene: ScenePreference = "自动匹配";

export const bridalSceneOptions: ScenePreference[] = [
  "试纱间",
  "婚纱店橱窗",
  "酒店套房晨光",
  "婚礼前化妆间",
  "草坪婚礼",
  "教堂门口",
  "海边旅拍",
  "登记照",
  "订婚宴",
  "晚宴礼服",
  "材质工作台"
];

export const dressSceneOptions: ScenePreference[] = [
  "入户镜前",
  "咖啡馆",
  "艺术馆",
  "花店",
  "城市街角",
  "通勤写字楼",
  "酒店门口",
  "度假海边",
  "晚餐约会",
  "电梯镜拍",
  "衣帽间",
  "窗边阅读",
  "材质工作台"
];

const bridalScenesByImageType: Record<ImageType, ScenePreference[]> = {
  产品上身图: [
    "试纱间",
    "婚纱店橱窗",
    "酒店套房晨光",
    "婚礼前化妆间",
    "草坪婚礼",
    "教堂门口",
    "海边旅拍",
    "登记照",
    "订婚宴",
    "晚宴礼服"
  ],
  对镜穿搭图: ["试纱间", "酒店套房晨光", "婚礼前化妆间", "晚宴礼服"],
  生活场景图: [
    "试纱间",
    "婚纱店橱窗",
    "酒店套房晨光",
    "婚礼前化妆间",
    "草坪婚礼",
    "教堂门口",
    "海边旅拍",
    "登记照",
    "订婚宴",
    "晚宴礼服"
  ],
  非产品氛围图: [
    "试纱间",
    "婚纱店橱窗",
    "酒店套房晨光",
    "婚礼前化妆间",
    "草坪婚礼",
    "教堂门口",
    "海边旅拍",
    "订婚宴",
    "材质工作台"
  ],
  "拍摄花絮 / 材质图": ["试纱间", "婚纱店橱窗", "婚礼前化妆间", "材质工作台"],
  产品静物图: ["婚纱店橱窗", "酒店套房晨光", "试纱间", "材质工作台"]
};

const dressScenesByImageType: Record<ImageType, ScenePreference[]> = {
  产品上身图: [
    "入户镜前",
    "咖啡馆",
    "艺术馆",
    "花店",
    "城市街角",
    "通勤写字楼",
    "酒店门口",
    "度假海边",
    "晚餐约会",
    "窗边阅读"
  ],
  对镜穿搭图: ["入户镜前", "电梯镜拍", "衣帽间", "酒店门口"],
  生活场景图: ["咖啡馆", "艺术馆", "花店", "城市街角", "通勤写字楼", "酒店门口", "度假海边", "晚餐约会", "窗边阅读"],
  非产品氛围图: ["咖啡馆", "艺术馆", "花店", "城市街角", "酒店门口", "度假海边", "窗边阅读"],
  "拍摄花絮 / 材质图": ["衣帽间", "窗边阅读", "材质工作台"],
  产品静物图: ["衣帽间", "窗边阅读", "材质工作台", "花店"]
};

function uniqueScenes(scenes: ScenePreference[]) {
  return Array.from(new Set([autoScene, ...scenes]));
}

function getSceneMap(productCategory: ProductCategory) {
  return productCategory === "婚纱 / 礼服" ? bridalScenesByImageType : dressScenesByImageType;
}

export function getCompatibleSceneOptions(productCategory: ProductCategory, imageType: ImageType) {
  return uniqueScenes(getSceneMap(productCategory)[imageType]);
}

export function isSceneCompatibleWithImageType(
  productCategory: ProductCategory,
  imageType: ImageType,
  scene: ScenePreference
) {
  if (scene === autoScene) return true;
  return getCompatibleSceneOptions(productCategory, imageType).includes(scene);
}
