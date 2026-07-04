import type { BridalImageKeywordProfileId } from "../data/bridalImageKeywordProfiles";
import {
  getXiaohongshuBridalContentProfile,
  xiaohongshuBridalCopyDrafts,
  xiaohongshuBridalTopicCopyKits,
  xiaohongshuBridalTopicOptions,
  type XiaohongshuBridalTopic
} from "../data/xiaohongshuBridalContentProfiles";
import { isSceneCompatibleWithImageType } from "../data/bridalDressSceneOptions";
import type { ImageType, ModelChoice, ProductCategory, PromptParams, ScenePreference } from "../types";
import { generatePrompt } from "./generatePrompt";

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
  prompt: string;
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

type FashionSeedingInput = {
  productCategory: ProductCategory;
  baseParams: PromptParams;
  imageCount?: 3 | 5;
  topic?: FashionSeedingTopic;
  date?: Date;
  dailySlot?: FashionSeedingDailySlot;
  contentNonce?: number;
};

type ImageDraft = {
  name: string;
  purpose: string;
  description: string;
  imageType: ImageType;
  scenePreference: ScenePreference;
  extraRequirement: string;
  bridalKeywordProfileId?: BridalImageKeywordProfileId;
};

type TopicCopyKit = {
  titles: string[];
  openings: string[];
  observations: string[];
  scenes: string[];
  closings: string[];
  tags: string[];
  note: string;
};

type TopicCopyDraft = {
  titles: string[];
  body: string;
  tags: string[];
  note: string;
  promptContext: CopyAlignmentContext;
};

type CopyVariationBank = {
  audiences: string[];
  focuses: string[];
  concerns: string[];
  proofs: string[];
  scenes: string[];
  materials: string[];
  services: string[];
  takeaways: string[];
  tones: string[];
  tagExtras: string[];
};

type VariantAxes = {
  primary: number;
  secondary: number;
  tertiary: number;
};

type CopyAlignmentContext = {
  topic: FashionSeedingTopic;
  audience: string;
  focus: string;
  concern: string;
  proof: string;
  scene: string;
  material: string;
  service: string;
  takeaway: string;
  tone: string;
};

const TOPIC_VARIANT_COUNT = 1000;
const VARIANT_AXIS_SIZE = 10;

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

function isXiaohongshuBridalTopic(topic: FashionSeedingTopic): topic is XiaohongshuBridalTopic {
  return xiaohongshuBridalTopicOptions.includes(topic as XiaohongshuBridalTopic);
}

function isBridalFashionTopic(topic: FashionSeedingTopic): topic is BridalFashionTopic {
  return bridalFashionTopicOptions.includes(topic as BridalFashionTopic);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_POST_COUNT = 2;

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

function getTopicVariantCount(topic: FashionSeedingTopic) {
  return TOPIC_VARIANT_COUNT;
}

export function getDailyFashionSeedingSelection(
  productCategory: ProductCategory,
  date = new Date(),
  dailySlot: FashionSeedingDailySlot = 1
) {
  const topicOptions = getTopicOptions(productCategory);
  const safeSlot = resolveDailySlot(dailySlot);
  const globalPostIndex = getDayNumber(date) * DAILY_POST_COUNT + (safeSlot - 1);
  const topic = topicOptions[globalPostIndex % topicOptions.length];
  const variantCount = getTopicVariantCount(topic);
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

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

const bridalVariationBank: CopyVariationBank = {
  audiences: [
    "第一次预约试纱的新娘",
    "带妈妈一起看婚纱的人",
    "担心手臂和肩颈的新娘",
    "正在对比主纱和轻婚纱的人",
    "想要酒店仪式感的新娘",
    "喜欢克制审美的备婚用户",
    "容易被精修图影响判断的人",
    "需要朋友陪着确认状态的人",
    "在意走路和坐下舒适度的人",
    "想提前了解婚纱店体验的人"
  ],
  focuses: [
    "肩颈线有没有被打开",
    "腰线落点是否托住比例",
    "裙摆体量会不会压住人",
    "拖尾长度和婚礼场地是否匹配",
    "领口弧度能不能修饰脸型",
    "手臂和背部有没有紧绷感",
    "白纱在自然光下是否保留纹理",
    "走动时裙摆是否跟得上身体",
    "头纱长度和主纱层次是否协调",
    "坐下、转身和敬茶动作是否方便"
  ],
  concerns: [
    "穿上后会不会一直想整理胸口",
    "侧面看是不是比正面更显真实比例",
    "朋友随手视频里状态是否自然",
    "顾问调整后版型有没有明显变顺",
    "照片好看但现场会不会太沉",
    "婚礼当天穿几个小时会不会累",
    "近看蕾丝和珠绣是否经得起放大",
    "背影在仪式动线里是否完整",
    "试纱间灯光有没有掩盖面料问题",
    "预算范围内是否真的适合自己"
  ],
  proofs: [
    "正面、侧面和背影三张对比",
    "顾问调整试穿夹的过程近景",
    "低头看腰线时的自然停顿",
    "朋友手机里的十秒走动视频",
    "坐下时裙摆和腰部的状态",
    "强光下白色面料的纹理细节",
    "头纱叠在肩颈处的层次",
    "拖尾展开后的完整比例",
    "衣架和面料小样的真实质感",
    "试纱记录表上的选择理由"
  ],
  scenes: [
    "镜前完整试穿",
    "顾问整理裙摆",
    "朋友坐在旁边看反应",
    "材质工作台上的面料近景",
    "候场区里的衣架和纱帘",
    "橱窗柔光下的挂装",
    "试纱间门口的预约细节",
    "酒店晨光里的主纱状态",
    "头纱和配饰搭配区",
    "回看手机记录的桌面"
  ],
  materials: [
    "缎面垂坠和腰部转折",
    "蕾丝花纹密度和透感",
    "珠绣、刺绣和白纱层次",
    "裙摆重量和拖尾边缘",
    "领口、袖口和肩线收口",
    "头纱边缘和主纱的衔接",
    "试穿夹留下的临时调整痕迹",
    "挂装状态下的廓形",
    "面料在窗边光里的细节",
    "配饰与婚纱主线的关系"
  ],
  services: [
    "让顾问解释版型为什么适合",
    "请朋友拍一段不美化的视频",
    "每件都记录一个喜欢和一个犹豫点",
    "把婚礼场地告诉顾问再试下一件",
    "同时看正面、侧面、背影和走动",
    "确认客照发布前会不会再次授权",
    "问清楚改尺寸和拖尾处理方式",
    "不要在特别累的时候立刻决定",
    "把头纱和鞋高一起纳入判断",
    "回家后用同角度照片再复盘"
  ],
  takeaways: [
    "让用户知道该保存哪几张试纱图",
    "把焦虑从身材转回版型判断",
    "帮预约前的人少一点紧张",
    "让品牌或门店专业感落在细节上",
    "把选择理由讲得比夸奖更可信",
    "让组图每一张都回答一个问题",
    "把真实体验和审美判断放在一起",
    "让用户知道到店后可以怎么沟通",
    "避免把婚纱内容写成硬广",
    "让最终选择看起来有过程而不是冲动"
  ],
  tones: [
    "像试纱后回家复盘",
    "像朋友认真帮忙记录",
    "像婚纱店顾问轻声解释",
    "像备婚用户写给自己的提醒",
    "像门店日常里截下来的真实片段",
    "像品牌发布前的细节说明",
    "像探店笔记里可被验证的经验",
    "像收藏夹里会反复看的攻略",
    "像客照授权后的温和转述",
    "像把选择过程慢慢讲清楚"
  ],
  tagExtras: [
    "#真实试纱",
    "#试纱记录",
    "#婚纱细节",
    "#备婚攻略",
    "#婚纱店日常",
    "#主纱选择",
    "#试纱避坑",
    "#婚纱新品",
    "#陪试纱",
    "#备婚收藏"
  ]
};

const dressVariationBank: CopyVariationBank = {
  audiences: [
    "通勤后还要直接赴约的人",
    "想把裙子穿进日常的人",
    "需要显利落但不紧绷的用户",
    "正在找周末出门裙装的人",
    "喜欢低饱和穿搭的人",
    "在意腰线和裙长比例的人",
    "想减少衣橱闲置的人",
    "需要办公室和晚餐都成立的人",
    "想让照片看起来不摆拍的人",
    "偏爱轻熟质感的用户"
  ],
  focuses: [
    "腰线位置是否干净",
    "裙长是否压身高",
    "面料垂坠是否顺",
    "走路时裙摆是否自然",
    "肩颈和领口是否利落",
    "坐下后腰腹会不会紧",
    "外套叠穿后比例是否稳定",
    "鞋包换掉后场景能不能迁移",
    "光线下颜色是否显廉价",
    "细节近看是否经得起放大"
  ],
  concerns: [
    "通勤场景会不会太用力",
    "约会场景会不会显得太正式",
    "周末穿会不会不够轻松",
    "面料皱了以后是否影响质感",
    "镜前照片和真实走动是否一致",
    "坐下时裙摆会不会卡住",
    "换一双鞋后比例会不会变乱",
    "深浅色背景里是否都能成立",
    "配饰一多会不会抢掉裙子本身",
    "同一条裙子能不能覆盖多个日程"
  ],
  proofs: [
    "全身比例和裙长对比",
    "入户镜前的真实试穿",
    "走路时裙摆摆动的瞬间",
    "坐下后面料和腰线状态",
    "办公室电梯镜里的干净线条",
    "咖啡馆桌边的自然姿态",
    "艺术馆留白里的廓形",
    "花店或街角的低饱和色彩",
    "衣帽间挂装和面料近景",
    "同一条裙子的鞋包替换"
  ],
  scenes: [
    "入户镜前确认比例",
    "写字楼大厅的通勤动线",
    "咖啡馆窗边坐下",
    "艺术馆白墙前停留",
    "花店门口的自然光",
    "城市街角的走动瞬间",
    "晚餐桌边的暖光",
    "度假海边的轻风",
    "衣帽间里的挂装细节",
    "电梯镜里的真实记录"
  ],
  materials: [
    "针织纹理和垂坠重量",
    "衬衫裙领口和袖口线条",
    "A 字裙摆的展开幅度",
    "吊带细节和肩颈留白",
    "半裙腰头和上衣衔接",
    "印花或纯色在光线下的层次",
    "裙摆边缘和褶裥细节",
    "外套叠穿后的面料关系",
    "鞋包与裙长的比例",
    "挂装状态下的廓形"
  ],
  services: [
    "先用同一镜头拍完整比例",
    "再补一张坐下和走动状态",
    "把鞋包变化控制在两组以内",
    "不要用夸张滤镜盖住面料",
    "让场景承担穿着理由",
    "用近景说明面料而不是堆道具",
    "保留一点真实动作",
    "每张图只讲一个穿搭判断点",
    "让用户看见通勤到约会的切换",
    "把收藏价值放在可复穿上"
  ],
  takeaways: [
    "让用户知道这条裙子能进入哪一天",
    "把好看落到可复穿和好行动",
    "让场景切换比单张美图更有说服力",
    "减少只靠氛围卖货的感觉",
    "让面料和比例成为购买理由",
    "让用户能直接套进自己的日程",
    "把轻熟感写得具体而不空泛",
    "让同一单品的生活范围更清楚",
    "把穿搭建议变成可保存的判断清单",
    "让裙装内容更像真实衣橱记录"
  ],
  tones: [
    "像出门前认真照镜子",
    "像朋友帮忙拍穿搭记录",
    "像衣橱复盘里的实用备注",
    "像品牌日常而不是硬广",
    "像城市女性自己的日程切片",
    "像通勤后顺路赴约的自然状态",
    "像周末慢下来的一组照片",
    "像把面料和比例讲清楚的笔记",
    "像轻熟穿搭的低声建议",
    "像一条裙子被反复穿过的证据"
  ],
  tagExtras: [
    "#裙装穿搭",
    "#通勤穿搭",
    "#轻熟风",
    "#一条裙子多场景",
    "#约会穿搭",
    "#周末穿搭",
    "#面料细节",
    "#衣橱灵感",
    "#日常穿搭",
    "#低饱和穿搭"
  ]
};

const xiaohongshuTopicOverrides: Partial<Record<FashionSeedingTopic, Partial<CopyVariationBank>>> = {
  真实客户试纱: {
    audiences: [
      "第一次真实到店试纱的新娘",
      "带着截图但还没确定风格的人",
      "担心自己撑不起主纱的人",
      "一直纠结手臂和腰线的人",
      "想听真实客照反馈的备婚用户",
      "试了很多件反而更乱的人",
      "需要朋友帮忙拍视频的人",
      "想确认婚礼当天舒适度的人",
      "不想被一句好看带着走的人",
      "想把顾虑说清楚再选择的人"
    ],
    focuses: [
      "穿上后身体有没有先放松",
      "截图款和真实上身是否一致",
      "镜前停顿是不是来自喜欢",
      "走动视频里状态是否自然",
      "顾问调整后的比例变化",
      "手臂、肩颈和腰线的真实反应",
      "朋友随手拍是否比精修更有参考",
      "坐下和转身是否仍然舒服",
      "价格之外的选择理由",
      "最后留下来的那一点确定感"
    ]
  },
  试纱陪同视角: {
    audiences: [
      "陪闺蜜试纱的人",
      "陪女儿看婚纱的妈妈",
      "陪伴侣一起确认婚纱的人",
      "负责拍试纱视频的朋友",
      "想给真实意见又怕说重的人",
      "能看到新娘小变化的人",
      "坐在试纱间旁边观察的人",
      "帮忙对比几件婚纱的人",
      "陪试后回家一起复盘的人",
      "不想把陪试拍成夸张剧情的人"
    ],
    focuses: [
      "她有没有不再反复问显不显胖",
      "旁边人的安静反应是否真实",
      "朋友视角里走动是否轻松",
      "妈妈先整理头纱而不是先评价",
      "伴侣听顾问解释时的停顿",
      "陪同者有没有抢走画面重点",
      "手机记录里哪一件最自然",
      "关系感是否比剧情更重要",
      "几个人一起确认的那一刻",
      "陪试意见是否真的帮她决策"
    ]
  },
  试纱避坑准备: {
    audiences: [
      "第一次预约试纱的人",
      "怕试纱当天紧张的人",
      "想提前做清单的备婚用户",
      "担心身材状态不够好的人",
      "一天想约好几家店的人",
      "不知道怎么拍试纱记录的人",
      "想问清服务细节的人",
      "容易被试纱间情绪带着走的人",
      "准备胸贴、鞋和发夹的人",
      "想少踩坑但不想焦虑的人"
    ],
    focuses: [
      "先把婚礼场地告诉顾问",
      "提前写下最在意的身体位置",
      "每件都拍同角度对比",
      "不要饿着肚子试很多件",
      "鞋高和头发状态要接近婚礼当天",
      "问清楚改尺寸和拖尾处理",
      "确认客照授权和隐私处理",
      "不要把一天安排得太满",
      "回家再看视频做决定",
      "把问题带去而不是带着焦虑去"
    ]
  },
  婚纱品牌发布: {
    audiences: [
      "正在对比新品系列的新娘",
      "想看懂主纱设计逻辑的人",
      "偏爱克制品牌审美的用户",
      "想知道一件婚纱适合谁的人",
      "关注面料证据而不是口号的人",
      "需要判断酒店和草坪适配的人",
      "想收藏婚纱细节的人",
      "看新品但怕被大片误导的人",
      "重视背影和拖尾的新娘",
      "想理解系列差异的备婚用户"
    ],
    focuses: [
      "新品为什么适合这一类新娘",
      "系列里每件婚纱的功能差异",
      "领口、腰线和拖尾的设计关系",
      "面料近看是否仍然耐看",
      "完整上身和挂装图是否互相补充",
      "品牌审美是否落在可判断细节上",
      "场地适配是否讲得清楚",
      "不是每件都喊命定款",
      "发布内容是否帮用户排除不适合",
      "lookbook 感和真实参考是否平衡"
    ]
  },
  婚纱店发布: {
    audiences: [
      "预约前想了解店铺体验的人",
      "担心进店后被催定的新娘",
      "想看真实试纱间的人",
      "在意顾问沟通方式的备婚用户",
      "想判断客照是否可信的人",
      "准备探店但还没下定的人",
      "关注隐私和授权的人",
      "想知道试纱流程是否舒服的人",
      "不只看装修漂亮的人",
      "需要一个安心预约理由的人"
    ],
    focuses: [
      "进店后会不会被理解",
      "顾问是否先听需求再拿款",
      "试纱间空间和镜子是否真实",
      "客照授权有没有被尊重",
      "预约卡和试穿记录是否清楚",
      "服务过程有没有压迫感",
      "每张图是否对应一个体验节点",
      "店铺日常是否干净但不空",
      "门店内容有没有真实过程",
      "用户能不能预约前就知道会被怎样对待"
    ]
  }
};

function toPhrase(value: string) {
  return value
    .replace(/[。！？!?；;]+/g, "，")
    .replace(/\.+/g, "，")
    .replace(/，+$/g, "")
    .trim();
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map(toPhrase).filter(Boolean)));
}

function ensureBankItems(items: string[], fallback: string[], fallbackLabel: string) {
  const unique = uniqueItems([...items, ...fallback]);
  const safeItems = unique.length > 0 ? unique : [fallbackLabel];

  return Array.from({ length: VARIANT_AXIS_SIZE }, (_, index) => safeItems[index % safeItems.length]);
}

function getDraftSourcePhrases(topic: FashionSeedingTopic) {
  if (!isXiaohongshuBridalTopic(topic)) return [];

  return xiaohongshuBridalCopyDrafts[topic].flatMap((draft) => [...draft.titles, ...draft.paragraphs]);
}

function buildCopyVariationBank(topic: FashionSeedingTopic, kit: TopicCopyKit): CopyVariationBank {
  const categoryBank = isBridalFashionTopic(topic) ? bridalVariationBank : dressVariationBank;
  const override = xiaohongshuTopicOverrides[topic] ?? {};
  const draftPhrases = getDraftSourcePhrases(topic);
  const kitPhrases = [...draftPhrases, ...kit.openings, ...kit.observations, ...kit.scenes, ...kit.closings];

  return {
    audiences: ensureBankItems(override.audiences ?? [], categoryBank.audiences, `${topic}用户`),
    focuses: ensureBankItems([...(override.focuses ?? []), ...kit.openings], categoryBank.focuses, `${topic}判断点`),
    concerns: ensureBankItems([...(override.concerns ?? []), ...kit.observations], categoryBank.concerns, `${topic}顾虑`),
    proofs: ensureBankItems([...(override.proofs ?? []), ...kitPhrases], categoryBank.proofs, `${topic}证据`),
    scenes: ensureBankItems([...(override.scenes ?? []), ...kit.scenes], categoryBank.scenes, `${topic}场景`),
    materials: ensureBankItems([...(override.materials ?? []), ...kit.observations], categoryBank.materials, `${topic}细节`),
    services: ensureBankItems(override.services ?? [], categoryBank.services, `${topic}动作`),
    takeaways: ensureBankItems([...(override.takeaways ?? []), ...kit.closings], categoryBank.takeaways, `${topic}收尾`),
    tones: ensureBankItems(override.tones ?? [], categoryBank.tones, `${topic}语气`),
    tagExtras: ensureBankItems(override.tagExtras ?? [], categoryBank.tagExtras, `#${topic}`)
  };
}

function getVariantAxes(variantIndex: number): VariantAxes {
  const safeIndex = ((variantIndex % TOPIC_VARIANT_COUNT) + TOPIC_VARIANT_COUNT) % TOPIC_VARIANT_COUNT;

  return {
    primary: safeIndex % VARIANT_AXIS_SIZE,
    secondary: Math.floor(safeIndex / VARIANT_AXIS_SIZE) % VARIANT_AXIS_SIZE,
    tertiary: Math.floor(safeIndex / (VARIANT_AXIS_SIZE * VARIANT_AXIS_SIZE)) % VARIANT_AXIS_SIZE
  };
}

function buildVariantTags(kit: TopicCopyKit, bank: CopyVariationBank, axes: VariantAxes) {
  return uniqueItems([
    ...kit.tags,
    pick(bank.tagExtras, axes.primary),
    pick(bank.tagExtras, axes.secondary),
    pick(bank.tagExtras, axes.tertiary)
  ]).slice(0, 7);
}

function buildCopyFromKit(topic: FashionSeedingTopic, variantIndex: number): TopicCopyDraft {
  const kit = topicCopyKits[topic];
  const bank = buildCopyVariationBank(topic, kit);
  const axes = getVariantAxes(variantIndex);
  const audience = pick(bank.audiences, axes.primary);
  const focus = pick(bank.focuses, axes.secondary);
  const concern = pick(bank.concerns, axes.tertiary);
  const proof = pick(bank.proofs, axes.primary);
  const scene = pick(bank.scenes, axes.secondary);
  const material = pick(bank.materials, axes.tertiary);
  const service = pick(bank.services, axes.primary);
  const takeaway = pick(bank.takeaways, axes.secondary);
  const tone = pick(bank.tones, axes.tertiary);
  const promptContext: CopyAlignmentContext = {
    topic,
    audience,
    focus,
    concern,
    proof,
    scene,
    material,
    service,
    takeaway,
    tone
  };

  return {
    titles: [
      `${topic}｜${audience}先看「${focus}」和「${concern}」`,
      `别只看「${proof}」，也要确认「${scene}」里的${material}`,
      `用「${scene}」这一组，帮${audience}回应「${concern}」并讲清「${takeaway}」`
    ],
    body: [
      `这篇${topic}写给${audience}，不急着把重点放在好不好看，而是先用「${focus}」「${concern}」和「${scene}」建立判断入口。`,
      `正文中围绕「${proof}」补充证据，再接上${material}、${service}和「${focus}」，让读者能看见具体变化，而不是只读到一句漂亮。`,
      `组图里保留「${scene}」这一类信息，接着放「${proof}」相关画面，再用${material}收住节奏；同一篇内容围绕${audience}的真实疑问展开，信息不会互相抢。`,
      `结尾落在「${takeaway}」，语气保持${tone}，并回应${audience}对「${focus}」的判断需求，让${topic}既有真实感，也保留店铺或品牌的专业度。`
    ].join("\n\n"),
    tags: buildVariantTags(kit, bank, axes),
    note: `遵循「${toPhrase(kit.note)}」的方向，本版围绕${audience}，用「${proof}」验证「${focus}」，并通过${material}回应「${concern}」；同主题共有 ${TOPIC_VARIANT_COUNT} 组组合文案。`,
    promptContext
  };
}

const topicCopyKits: Record<FashionSeedingTopic, TopicCopyKit> = {
  ...xiaohongshuBridalTopicCopyKits,
  试纱体验: {
    titles: ["试纱这件事，不用急着被夸", "一件婚纱合不合适，身体会先知道", "好的试纱，是慢慢确认自己"],
    openings: [
      "试纱最重要的，不是第一眼有多惊艳。",
      "很多新娘真正松下来，是在试到一件不需要用力解释的婚纱时。"
    ],
    observations: [
      "腰线、领口、裙摆和面料贴合身体的方式，会比一句夸奖更诚实。",
      "镜子里的状态如果自然，拍照多年以后也不容易过时。"
    ],
    scenes: [
      "画面可以安静一点，有镜子、纱帘、衣架和一点自然光就够了。",
      "试纱间不需要拍得很热闹，保留一点真实的停顿感反而更动人。"
    ],
    closings: [
      "婚纱不是为了讨好所有人，是为了让那一天的自己被好好记住。",
      "这类内容适合把选择过程拍得克制一点，才更像真实新娘会保存的照片。"
    ],
    tags: ["#试纱", "#婚纱试穿", "#新娘日记", "#婚纱馆", "#备婚灵感"],
    note: "围绕试纱情绪和新娘自我确认，不写成硬卖货。"
  },
  极简新娘: {
    titles: ["极简婚纱不是没细节", "缎面婚纱的高级感，在光里", "越简单，越需要比例刚好"],
    openings: ["极简婚纱看起来安静，其实最考验版型。", "缎面和干净线条，不太适合用夸张场景去盖住。"],
    observations: [
      "领口、腰线、垂坠和裙摆的重量，都会决定照片里的气质。",
      "如果光线太硬，白色面料很容易只剩一片亮，看不见真正的质感。"
    ],
    scenes: [
      "酒店套房晨光、窗边和一面干净的镜子，就能把极简婚纱拍得很完整。",
      "画面留白多一点，反而能让缎面的层次和身体比例更清楚。"
    ],
    closings: ["极简不是冷淡，是多年后再看也不过度。", "一件耐看的婚纱，通常不需要太大声。"],
    tags: ["#极简婚纱", "#缎面婚纱", "#高级婚纱", "#新娘造型", "#备婚审美"],
    note: "突出比例、缎面光泽和耐看，不写浮夸奢华感。"
  },
  法式婚纱: {
    titles: ["法式蕾丝要轻，不要满", "蕾丝婚纱最怕拍得太用力", "浪漫可以很安静"],
    openings: ["法式婚纱的浪漫，不一定来自很大的裙摆。", "蕾丝好不好看，近一点看纹理就知道。"],
    observations: [
      "真正耐看的蕾丝，需要有呼吸感，也需要让身体线条保持自然。",
      "花纹、袖长、领口和腰线如果都温柔，整体就不容易显得甜腻。"
    ],
    scenes: [
      "适合放在试纱间、教堂门口或婚纱店橱窗里，用柔光把纹理拍清楚。",
      "不需要堆太多花，几处面料细节和一个安静表情就够了。"
    ],
    closings: ["浪漫不是越满越好，而是刚好让人记住。", "把蕾丝拍真实，比把它拍梦幻更重要。"],
    tags: ["#法式婚纱", "#蕾丝婚纱", "#婚纱细节", "#备婚", "#婚纱灵感"],
    note: "强调蕾丝纹理、呼吸感和克制浪漫。"
  },
  草坪婚礼: {
    titles: ["草坪婚礼，婚纱要能被风吹动", "户外婚礼最需要真实的轻盈感", "绿色背景里，白纱不要过曝"],
    openings: ["草坪婚礼的照片，最怕看起来像样板间。", "户外的光和风，会把婚纱的状态放大。"],
    observations: [
      "裙摆需要有自然的重量，不能飘得假，也不能白到没有细节。",
      "仪式感可以来自走动、回头和纱面层次，不一定靠复杂布景。"
    ],
    scenes: [
      "草坪、木椅、花艺和自然光都保持低饱和，让人先看到新娘状态。",
      "画面里可以有一点婚礼现场，但不要让背景抢走婚纱。"
    ],
    closings: ["这一天应该难忘，但不必被拍得很夸张。", "好的草坪婚礼图，是多年后还能看见那阵风。"],
    tags: ["#草坪婚礼", "#户外婚礼", "#婚纱摄影", "#新娘造型", "#婚礼灵感"],
    note: "关注户外自然光、风和不过曝的白纱细节。"
  },
  酒店婚礼: {
    titles: ["酒店婚礼的婚纱，不需要太满", "晨光里的婚纱，比灯光更诚实", "婚礼当天，从房间里开始"],
    openings: ["酒店婚礼很容易拍得华丽，但新娘自己的状态更重要。", "婚礼当天早上，房间里的光通常最安静。"],
    observations: [
      "床边、窗边、挂着的婚纱和化妆台细节，可以把仪式感讲得很轻。",
      "礼服需要在暖光里保留面料层次，不要被拍成一片白。"
    ],
    scenes: [
      "酒店套房晨光适合拍准备、独处和穿上婚纱前的几分钟。",
      "晚宴礼服可以放在酒店门廊或宴会厅边缘，保持克制的正式感。"
    ],
    closings: ["不是所有婚礼内容都要热闹，安静的开始也很值得记录。", "酒店场景越克制，婚纱本身越容易被看见。"],
    tags: ["#酒店婚礼", "#婚礼晨袍", "#婚纱照", "#新娘准备", "#婚礼记录"],
    note: "围绕酒店晨光、准备感和克制仪式感。"
  },
  海边旅拍: {
    titles: ["海边婚纱照，不一定要很用力", "风和裙摆刚好，就够了", "旅拍也可以低饱和一点"],
    openings: ["海边旅拍最怕把人和婚纱都拍得太满。", "真正好看的海边婚纱图，通常有一点风，也有一点留白。"],
    observations: [
      "裙摆、头纱和发丝可以动，但身体比例和腰线要稳。",
      "海边不需要很蓝，低饱和的天空和水面更耐看。"
    ],
    scenes: [
      "让婚纱在海风里有轻微动作，背景保持干净，不要变成旅游打卡。",
      "如果是轻婚纱，画面可以更像一次私密旅行记录。"
    ],
    closings: ["海边的浪漫不靠滤镜，靠真实的光和风。", "旅拍内容越自然，越容易让人代入自己的那一天。"],
    tags: ["#海边旅拍", "#轻婚纱", "#婚纱旅拍", "#新娘日记", "#备婚灵感"],
    note: "强调低饱和海边、风和真实旅拍感。"
  },
  登记照: {
    titles: ["登记照也可以很有自己的样子", "不盛大，但很重要", "把这一天拍得干净一点"],
    openings: ["登记那天不一定要穿得很复杂。", "有些人生节点，是越简单越清楚。"],
    observations: [
      "短款婚纱、轻礼服或干净连衣裙，都适合留下一个不夸张的版本。",
      "白墙、手捧花和自然光，比过度布置更像真实纪念。"
    ],
    scenes: [
      "登记照画面要干净，重点放在两个人的状态和服装比例上。",
      "如果只拍新娘，也可以像一张很安静的纪念照。"
    ],
    closings: ["不是每个重要时刻都需要盛大表达。", "这样的照片，很多年后再看也不会觉得用力。"],
    tags: ["#登记照", "#领证穿搭", "#轻婚纱", "#人生节点", "#备婚"],
    note: "强调人生节点和简单纪念感。"
  },
  晚宴礼服: {
    titles: ["晚宴礼服，重点不是闪", "正式场合也可以很克制", "一条礼服撑起晚上的状态"],
    openings: ["晚宴礼服不一定要靠夸张设计才有存在感。", "正式场合里，最耐看的通常是比例和姿态。"],
    observations: [
      "领口、腰线、裙长和面料光泽都要被控制在舒服范围里。",
      "暖光可以让礼服更有情绪，但不能拍成廉价影楼感。"
    ],
    scenes: [
      "酒店门口、宴会厅边缘或晚餐场景，都适合保留一点真实环境。",
      "配图可以有杯盘、花艺和门廊，但不要让礼服失焦。"
    ],
    closings: ["好的晚宴图，应该是正式但不紧绷。", "礼服内容越克制，越容易显得有分寸。"],
    tags: ["#晚宴礼服", "#礼服穿搭", "#宴会造型", "#轻熟风", "#正式场合"],
    note: "强调正式场合、暖光和不夸张的礼服状态。"
  },
  婚礼前一天: {
    titles: ["婚礼前一天，也值得被拍下来", "还没穿上婚纱之前的安静", "准备中的细节，比想象中动人"],
    openings: ["婚礼前一天的情绪，常常比婚礼当天更安静。", "真正属于自己的时刻，可能是在穿上婚纱之前。"],
    observations: [
      "头纱、挂在衣架上的婚纱、鞋盒、手捧花和化妆台，都能讲出准备感。",
      "画面不需要完整出现人物，也可以很有仪式感。"
    ],
    scenes: [
      "酒店房间或化妆间适合拍未完成的状态，像一段马上开始之前的停顿。",
      "材质图可以把蕾丝、缎面和珠绣拍清楚，让内容更有可信度。"
    ],
    closings: ["不是所有内容都要拍结果，准备本身也很有记忆。", "这类图适合做婚纱馆的温柔铺垫。"],
    tags: ["#婚礼前一天", "#新娘准备", "#婚纱细节", "#备婚日记", "#婚礼记录"],
    note: "围绕婚礼前准备、材质和情绪铺垫。"
  },
  新娘独处时刻: {
    titles: ["成为新娘之前，先做自己", "一个人的婚纱照，也可以很完整", "安静的新娘状态最耐看"],
    openings: ["新娘内容不一定要一直围绕热闹和祝福。", "有时候，一个人坐在窗边，就已经很像那一天。"],
    observations: [
      "独处画面更需要真实的姿态，不能像摆拍，也不能太忧伤。",
      "婚纱和人之间要有呼吸感，让面料、光和情绪自然发生。"
    ],
    scenes: [
      "窗边阅读、酒店晨光或试纱间角落，都适合拍安静的新娘状态。",
      "镜头可以离远一点，给裙摆和房间留出空间。"
    ],
    closings: ["婚礼是人生节点，但这一天也仍然属于自己。", "安静的照片，往往最容易被反复打开。"],
    tags: ["#新娘独处", "#婚纱照", "#备婚情绪", "#新娘状态", "#婚纱馆"],
    note: "突出属于自己的那一天和安静自我感。"
  },
  通勤裙装: {
    titles: ["通勤裙装，要舒服但不随便", "一条裙子撑住工作日状态", "好穿的通勤裙，不需要很用力"],
    openings: ["通勤裙装最重要的，是早上穿上不用反复调整。", "工作日的裙子，不一定要很正式才体面。"],
    observations: [
      "腰线、裙长、垂坠和面料厚度，会决定一整天的松弛感。",
      "舒服不是随便，比例清楚才会显得有精神。"
    ],
    scenes: [
      "写字楼、电梯镜或城市街角，都适合拍真实工作日的状态。",
      "画面不要太像硬广，像出门前或午休路上的一眼更自然。"
    ],
    closings: ["一条通勤裙的价值，是让身体和场合都不别扭。", "日常内容不用喊卖点，把状态拍出来就够了。"],
    tags: ["#通勤裙装", "#通勤穿搭", "#轻熟风", "#上班穿搭", "#裙装搭配"],
    note: "围绕日常女性状态、比例修饰和通勤场合感。"
  },
  约会裙装: {
    titles: ["约会裙装，不必过度甜", "好看的约会感，是自然的", "一条裙子让人松下来"],
    openings: ["约会穿搭不用把自己打扮成另一个人。", "真正耐看的约会裙装，是舒服、合身、有一点场合感。"],
    observations: [
      "裙摆可以有动作，颜色可以柔和，但整体不要太用力。",
      "适合自己的腰线和长度，比所谓氛围感更重要。"
    ],
    scenes: [
      "晚餐、咖啡馆或花店都可以，但画面要像真实的一天。",
      "配图可以有桌面、花和一点暖光，不要拍成模板约会照。"
    ],
    closings: ["好看的裙子，是让人先觉得自己很自在。", "约会内容越真实，越容易被收藏。"],
    tags: ["#约会穿搭", "#裙装", "#晚餐约会", "#轻熟穿搭", "#女性状态"],
    note: "强调约会但不甜腻，克制真实。"
  },
  周末裙装: {
    titles: ["周末裙装，要有一点松弛", "不是出片，是舒服地出门", "一条裙子的周末状态"],
    openings: ["周末穿裙子，最怕为了好看牺牲行动感。", "好看的日常裙装，应该能陪人走路、坐下、买花、喝咖啡。"],
    observations: [
      "面料有垂坠，腰线不紧绷，画面自然就会松下来。",
      "周末感不等于随意，干净比例会让内容更耐看。"
    ],
    scenes: [
      "花店、咖啡馆、艺术馆或城市街角都适合一条裙子的周末。",
      "让裙摆有轻微动作，场景保持安静一点。"
    ],
    closings: ["这类内容适合讲生活，不适合硬讲卖点。", "一条好穿的裙子，会自然进入很多普通周末。"],
    tags: ["#周末穿搭", "#裙装穿搭", "#花店穿搭", "#咖啡馆穿搭", "#轻熟日常"],
    note: "强调身体松弛、生活场景和周末节奏。"
  },
  度假长裙: {
    titles: ["度假长裙，轻一点才好看", "海边不需要高饱和滤镜", "裙摆和风刚好就够了"],
    openings: ["度假裙装最怕用力过猛。", "海边长裙不一定要很艳，低饱和反而更耐看。"],
    observations: [
      "长裙要有自然垂坠和走动时的空气感，不能像摆拍道具。",
      "面料、裙长和肩颈比例，比背景有多漂亮更重要。"
    ],
    scenes: [
      "度假海边、酒店门口或窗边都可以，重点是轻松但不廉价。",
      "画面可以有风和阳光，但不要让裙子失去细节。"
    ],
    closings: ["好的度假图，是让人想穿着它慢一点生活。", "自然的裙摆，比夸张姿势更有吸引力。"],
    tags: ["#度假长裙", "#海边穿搭", "#裙装", "#度假穿搭", "#松弛感"],
    note: "围绕度假、长裙垂坠和低饱和自然光。"
  },
  艺术馆穿搭: {
    titles: ["艺术馆穿搭，不要抢画", "干净裙装和留白最合拍", "一条裙子也可以很安静"],
    openings: ["艺术馆场景很适合裙装，但不能拍得太像打卡。", "越干净的空间，越能看出裙子的线条。"],
    observations: [
      "裙长、肩颈和腰线需要清楚，背景最好有足够留白。",
      "颜色不必追求特别，低饱和更容易和空间相处。"
    ],
    scenes: [
      "可以在展墙前走过、停下或侧身看作品，姿态要自然。",
      "构图留出空间，让裙子和人都不紧张。"
    ],
    closings: ["艺术馆穿搭不是为了拍得高级，是为了让状态安静下来。", "这样的内容适合讲审美，不适合讲爆款。"],
    tags: ["#艺术馆穿搭", "#裙装穿搭", "#轻熟风", "#低饱和穿搭", "#周末穿搭"],
    note: "强调留白、低饱和和克制审美。"
  },
  下午茶: {
    titles: ["下午茶穿搭，可以不甜", "一条裙子的轻松社交感", "温柔但不腻的裙装状态"],
    openings: ["下午茶场景很容易拍得过甜。", "真正适合日常分享的裙装，不需要太多滤镜和摆拍。"],
    observations: [
      "舒服的肩颈、自然的腰线和面料垂坠，会让整个人更放松。",
      "桌面细节可以出现，但不要让甜点和花抢走服装。"
    ],
    scenes: [
      "咖啡馆或花店旁边都可以，光线柔一点，动作简单一点。",
      "画面像朋友顺手拍的一张，会比硬凹姿势更可信。"
    ],
    closings: ["女性日常的好看，很多时候是不紧绷。", "一条舒服的裙子，会让社交场合变轻一点。"],
    tags: ["#下午茶穿搭", "#裙装", "#轻熟日常", "#咖啡馆穿搭", "#约会穿搭"],
    note: "避免甜腻，突出轻松社交和真实日常。"
  },
  晚餐约会: {
    titles: ["晚餐约会，裙子要有分寸", "正式一点，但不用紧绷", "一条裙子的夜晚状态"],
    openings: ["晚餐穿搭不一定要很隆重。", "有些裙子适合把日常轻轻往正式推一步。"],
    observations: [
      "暖光里要保留面料细节，不能只剩轮廓和滤镜。",
      "裙摆、腰线和肩颈如果都自然，整个人就会显得轻松。"
    ],
    scenes: [
      "晚餐桌边、酒店门口或城市夜晚入口都适合，但背景要干净。",
      "姿态可以简单，像刚到餐厅或准备离开的一瞬间。"
    ],
    closings: ["好的晚餐裙装，是有场合感，但不把人包住。", "越克制的画面，越容易显得耐看。"],
    tags: ["#晚餐约会", "#约会穿搭", "#裙装穿搭", "#轻熟风", "#晚间穿搭"],
    note: "围绕晚餐约会、正式度和不紧绷。"
  },
  轻熟日常: {
    titles: ["轻熟日常，不需要装得很用力", "一条裙子让状态更稳", "舒服但有比例，是日常高级感"],
    openings: ["轻熟风不是年龄感，而是一种不着急的状态。", "日常裙装如果太用力，反而不容易被代入。"],
    observations: [
      "颜色、面料和比例都安静一点，身体会先松下来。",
      "一条裙子最好能从白天穿到晚上，不需要频繁换风格。"
    ],
    scenes: [
      "入户镜前、窗边阅读、城市街角都能拍出轻熟日常。",
      "配图不要过度精致，保留一点真实生活的空隙。"
    ],
    closings: ["日常内容最打动人的，是看起来真的会穿。", "舒服但不随便，本身就是很好的裙装表达。"],
    tags: ["#轻熟日常", "#裙装", "#日常穿搭", "#低饱和穿搭", "#女性状态"],
    note: "强调身体松弛、比例和真实日常。"
  },
  秋冬裙装: {
    titles: ["秋冬裙装，不能只靠厚", "有温度的裙子，也要有轻盈感", "秋冬穿裙子，比例更重要"],
    openings: ["秋冬裙装最怕看起来沉。", "天气变冷以后，裙子的面料和层次会更明显。"],
    observations: [
      "针织、羊毛感、衬衫裙或半裙都需要保持清楚的腰线。",
      "温暖不等于厚重，颜色和面料可以低调一点。"
    ],
    scenes: [
      "窗边、写字楼、咖啡馆和酒店门口都适合秋冬裙装。",
      "暖光可以出现，但画面不要变成浓重咖啡色。"
    ],
    closings: ["秋冬裙装的好看，是保暖和比例一起成立。", "把面料拍真实，比堆氛围更重要。"],
    tags: ["#秋冬裙装", "#针织裙", "#通勤穿搭", "#轻熟穿搭", "#裙装搭配"],
    note: "突出秋冬面料、温度和比例。"
  },
  一条裙子的多场景: {
    titles: ["一条裙子，不只适合一个场景", "从通勤到约会，换的是状态", "真正好穿的裙子，会进入很多生活"],
    openings: ["判断一条裙子好不好穿，不只看单张图。", "如果一条裙子只能服务一个场景，日常价值其实不高。"],
    observations: [
      "通勤、咖啡、艺术馆、晚餐，都需要同一条裙子保持比例和舒适度。",
      "同一件衣服在不同场景里成立，才更像真实衣柜会留下的单品。"
    ],
    scenes: [
      "配图可以做成三到五张小系列，场景变化但模特状态和裙子结构保持一致。",
      "不要每张都换成新的风格，让用户看到一条裙子的生活范围。"
    ],
    closings: ["这类内容适合做收藏向，也适合让用户想象自己的日程。", "一条裙子的多场景，不是堆图，是让生活线索变清楚。"],
    tags: ["#一条裙子多场景", "#裙装穿搭", "#通勤到约会", "#轻熟日常", "#穿搭灵感"],
    note: "强调一条裙子的多种生活和场景迁移。"
  }
};

const bridalMainSceneByTopic: Partial<Record<BridalFashionTopic, ScenePreference>> = {
  试纱体验: "试纱间",
  极简新娘: "酒店套房晨光",
  法式婚纱: "婚纱店橱窗",
  草坪婚礼: "草坪婚礼",
  酒店婚礼: "酒店套房晨光",
  海边旅拍: "海边旅拍",
  登记照: "登记照",
  晚宴礼服: "晚宴礼服",
  婚礼前一天: "婚礼前化妆间",
  新娘独处时刻: "酒店套房晨光"
};

const dressMainSceneByTopic: Record<DressFashionTopic, ScenePreference> = {
  通勤裙装: "通勤写字楼",
  约会裙装: "晚餐约会",
  周末裙装: "花店",
  度假长裙: "度假海边",
  艺术馆穿搭: "艺术馆",
  下午茶: "咖啡馆",
  晚餐约会: "晚餐约会",
  轻熟日常: "入户镜前",
  秋冬裙装: "窗边阅读",
  一条裙子的多场景: "城市街角"
};

function getBridalImageDrafts(topic: BridalFashionTopic): ImageDraft[] {
  if (isXiaohongshuBridalTopic(topic)) {
    return getXiaohongshuBridalContentProfile(topic).imageBlueprints.map((blueprint) => ({
      name: blueprint.name,
      purpose: blueprint.purpose,
      description: blueprint.description,
      imageType: blueprint.imageType,
      scenePreference: blueprint.scenePreference,
      extraRequirement: blueprint.extraRequirement,
      bridalKeywordProfileId: blueprint.keywordProfileId
    }));
  }

  const mainScene = bridalMainSceneByTopic[topic] ?? "试纱间";
  return [
    {
      name: "图1｜主图｜完整状态",
      purpose: "作为内容封面，展示婚纱或礼服的整体比例。",
      description: "人物、场景和服装结构同时清楚，保留真实新娘状态。",
      imageType: "产品上身图",
      scenePreference: mainScene,
      extraRequirement:
        "Create the cover image with the full gown clearly visible, preserving neckline, waistline, skirt volume, hemline, and fabric detail from the reference."
    },
    {
      name: "图2｜情绪｜同一模特风格",
      purpose: "补充更接近真实试纱或婚礼前状态的情绪图。",
      description: "延续同一模特气质，动作更轻，重点是新娘状态。",
      imageType: topic === "试纱体验" ? "对镜穿搭图" : "生活场景图",
      scenePreference: topic === "试纱体验" ? "试纱间" : mainScene,
      extraRequirement:
        "Keep a consistent model style with the cover image if a person appears. Capture a quieter emotional moment, not a commercial pose."
    },
    {
      name: "图3｜细节｜面料与工艺",
      purpose: "展示蕾丝、缎面、珠绣、裙摆或头纱细节。",
      description: "可用于说明材质质感，让内容更可信。",
      imageType: "拍摄花絮 / 材质图",
      scenePreference: "材质工作台",
      extraRequirement:
        "Focus on fabric close-up, lace pattern, satin drape, veil texture, embroidery, beadwork, hanger, dress rack, sketch notes, and refined tactile details."
    },
    {
      name: "图4｜氛围｜场景铺垫",
      purpose: "不强制产品出现，建立婚纱馆或婚礼场景情绪。",
      description: "适合做组图过渡，不像广告硬切。",
      imageType: "非产品氛围图",
      scenePreference: topic === "法式婚纱" ? "婚纱店橱窗" : mainScene,
      extraRequirement:
        "Create a non-product atmosphere image that may show boutique space, veil, flowers, mirror reflection, morning light, garment rack, or quiet ceremony details."
    },
    {
      name: "图5｜静物｜挂装与配件",
      purpose: "收尾展示婚纱静物、衣架、头纱或配件。",
      description: "形成可收藏的品牌细节图。",
      imageType: "产品静物图",
      scenePreference: "材质工作台",
      extraRequirement:
        "Create a refined still life with the dress on a hanger or dress rack, veil, satin, lace, bouquet detail, mood board, and soft daylight. Keep the garment structure accurate."
    }
  ];
}

function getDressImageDrafts(topic: DressFashionTopic): ImageDraft[] {
  const mainScene = dressMainSceneByTopic[topic];
  const mirrorScene: ScenePreference = topic === "通勤裙装" ? "电梯镜拍" : "入户镜前";
  return [
    {
      name: "图1｜主图｜完整穿搭",
      purpose: "作为内容封面，展示裙装完整比例和场合感。",
      description: "人物状态自然，裙长、腰线和面料垂坠清楚。",
      imageType: "产品上身图",
      scenePreference: mainScene,
      extraRequirement:
        "Create the cover image with the dress clearly visible, preserving silhouette, waist shape, skirt length, drape, texture, hemline, fit, and styling proportion from the reference."
    },
    {
      name: "图2｜对镜｜比例确认",
      purpose: "补充真实穿搭视角，强调比例修饰。",
      description: "延续同一模特风格，像出门前确认穿搭。",
      imageType: "对镜穿搭图",
      scenePreference: mirrorScene,
      extraRequirement:
        "Keep a consistent model style with the cover image if a person appears. Show a realistic mirror outfit moment with clear waistline and skirt length."
    },
    {
      name: "图3｜生活｜场景代入",
      purpose: "把裙子放进真实日常或约会场景。",
      description: "画面像朋友记录，不要硬凹姿势。",
      imageType: "生活场景图",
      scenePreference: mainScene,
      extraRequirement:
        "Create a natural lifestyle image with relaxed movement, real-camera composition, and the dress integrated into the setting without over-styling."
    },
    {
      name: "图4｜细节｜面料与垂坠",
      purpose: "展示面料、褶裥、裙摆或纹理。",
      description: "让用户看清衣服本身，而不是只看氛围。",
      imageType: "拍摄花絮 / 材质图",
      scenePreference: "材质工作台",
      extraRequirement:
        "Focus on fabric drape, pleats, texture, hemline, print or solid color, hanger, dress rack, swatches, and calm daylight."
    },
    {
      name: "图5｜静物｜衣橱与搭配",
      purpose: "收尾展示裙装静物和搭配线索。",
      description: "适合做收藏图，提示一条裙子的生活范围。",
      imageType: "产品静物图",
      scenePreference: "衣帽间",
      extraRequirement:
        "Create a refined still life with the dress on a hanger or dress rack, neutral accessories, fabric close-up, mood board, and organized wardrobe setting."
    }
  ];
}

function getImageDrafts(productCategory: ProductCategory, topic: FashionSeedingTopic): ImageDraft[] {
  return productCategory === "婚纱 / 礼服"
    ? getBridalImageDrafts(topic as BridalFashionTopic)
    : getDressImageDrafts(topic as DressFashionTopic);
}

function getCompatibleSceneOrFallback(baseParams: PromptParams, draft: ImageDraft, scene: ScenePreference) {
  if (isSceneCompatibleWithImageType(baseParams.productCategory, draft.imageType, scene)) return scene;
  if (isSceneCompatibleWithImageType(baseParams.productCategory, draft.imageType, draft.scenePreference)) return draft.scenePreference;
  return "自动匹配";
}

function resolveAlignedScenePreference(baseParams: PromptParams, draft: ImageDraft, context?: CopyAlignmentContext): ScenePreference {
  if (!context) return getCompatibleSceneOrFallback(baseParams, draft, draft.scenePreference);

  const text = context.scene;
  const isMaterialImage = draft.imageType === "拍摄花絮 / 材质图" || draft.imageType === "产品静物图";

  if (isMaterialImage) {
    if (text.includes("衣帽间")) return getCompatibleSceneOrFallback(baseParams, draft, "衣帽间");
    if (text.includes("材质") || text.includes("面料") || text.includes("桌面") || text.includes("挂装")) {
      return getCompatibleSceneOrFallback(baseParams, draft, "材质工作台");
    }
    return getCompatibleSceneOrFallback(baseParams, draft, draft.scenePreference);
  }

  if (text.includes("试纱") || text.includes("镜前") || text.includes("顾问") || text.includes("头纱") || text.includes("候场")) {
    return getCompatibleSceneOrFallback(baseParams, draft, "试纱间");
  }
  if (text.includes("橱窗")) return getCompatibleSceneOrFallback(baseParams, draft, "婚纱店橱窗");
  if (text.includes("酒店晨光") || text.includes("酒店套房")) {
    return getCompatibleSceneOrFallback(baseParams, draft, "酒店套房晨光");
  }
  if (text.includes("草坪")) return getCompatibleSceneOrFallback(baseParams, draft, "草坪婚礼");
  if (text.includes("教堂")) return getCompatibleSceneOrFallback(baseParams, draft, "教堂门口");
  if (text.includes("登记")) return getCompatibleSceneOrFallback(baseParams, draft, "登记照");
  if (text.includes("海边") || text.includes("度假")) {
    return getCompatibleSceneOrFallback(
      baseParams,
      draft,
      baseParams.productCategory === "婚纱 / 礼服" ? "海边旅拍" : "度假海边"
    );
  }
  if (text.includes("入户")) return getCompatibleSceneOrFallback(baseParams, draft, "入户镜前");
  if (text.includes("写字楼")) return getCompatibleSceneOrFallback(baseParams, draft, "通勤写字楼");
  if (text.includes("咖啡")) return getCompatibleSceneOrFallback(baseParams, draft, "咖啡馆");
  if (text.includes("艺术馆")) return getCompatibleSceneOrFallback(baseParams, draft, "艺术馆");
  if (text.includes("花店")) return getCompatibleSceneOrFallback(baseParams, draft, "花店");
  if (text.includes("城市街角")) return getCompatibleSceneOrFallback(baseParams, draft, "城市街角");
  if (text.includes("晚餐")) return getCompatibleSceneOrFallback(baseParams, draft, "晚餐约会");
  if (text.includes("电梯")) return getCompatibleSceneOrFallback(baseParams, draft, "电梯镜拍");
  if (text.includes("衣帽间")) return getCompatibleSceneOrFallback(baseParams, draft, "衣帽间");

  return getCompatibleSceneOrFallback(baseParams, draft, draft.scenePreference);
}

function resolveImageModelChoice(baseParams: PromptParams, draft: ImageDraft): ModelChoice {
  if (baseParams.productCategory !== "婚纱 / 礼服") return baseParams.modelChoice;
  if (draft.imageType !== "产品上身图" && draft.imageType !== "对镜穿搭图" && draft.imageType !== "生活场景图") {
    return baseParams.modelChoice;
  }

  if (
    draft.bridalKeywordProfileId === "realCustomerFitting" ||
    draft.bridalKeywordProfileId === "companionFitting" ||
    draft.bridalKeywordProfileId === "fittingServiceDetail" ||
    draft.bridalKeywordProfileId === "storePublishing"
  ) {
    return "高级婚纱店真实试纱客户";
  }

  return baseParams.modelChoice;
}

function buildPromptAlignmentRequirement(draft: ImageDraft, context?: CopyAlignmentContext) {
  if (!context) return draft.extraRequirement;

  return [
    draft.extraRequirement,
    `Content alignment: match the generated Xiaohongshu copy context. Topic: ${context.topic}. Audience: ${context.audience}. Main focus: ${context.focus}. User concern: ${context.concern}. Visual proof to support: ${context.proof}. Scene evidence: ${context.scene}. Material/detail cue: ${context.material}. Service/action cue: ${context.service}. Takeaway: ${context.takeaway}. Tone: ${context.tone}. Make this image read as part of the same post, not a separate generic prompt.`
  ].join(" ");
}

function buildImagePlan(
  baseParams: PromptParams,
  draft: ImageDraft,
  index: number,
  contentNonce: number,
  context?: CopyAlignmentContext
): FashionSeedingImagePlan {
  const params: PromptParams = {
    ...baseParams,
    imageType: draft.imageType,
    modelChoice: resolveImageModelChoice(baseParams, draft),
    scenePreference: resolveAlignedScenePreference(baseParams, draft, context),
    extraRequirement: buildPromptAlignmentRequirement(draft, context),
    generationNonce: baseParams.generationNonce + contentNonce * 10 + index + 1,
    bridalKeywordProfileId: draft.bridalKeywordProfileId
  };

  return {
    name: draft.name,
    purpose: draft.purpose,
    description: draft.description,
    params,
    prompt: generatePrompt(params).prompt
  };
}

export function generateFashionSeedingContent(input: FashionSeedingInput): FashionSeedingContent {
  const imageCount = input.imageCount === 3 ? 3 : 5;
  const daily = getDailyFashionSeedingSelection(input.productCategory, input.date, input.dailySlot);
  const topicOptions = getTopicOptions(input.productCategory);
  const safeTopic =
    input.topic && topicOptions.includes(input.topic) ? input.topic : daily.topic;
  const variantCount = getTopicVariantCount(safeTopic);
  const contentNonce = input.contentNonce ?? 0;
  const variantIndex =
    input.topic && input.topic !== daily.topic
      ? contentNonce % variantCount
      : (daily.variantIndex + contentNonce) % variantCount;
  const copy = buildCopyFromKit(safeTopic, variantIndex);
  const images = getImageDrafts(input.productCategory, safeTopic)
    .slice(0, imageCount)
    .map((draft, index) => buildImagePlan(input.baseParams, draft, index, contentNonce, copy.promptContext));

  return {
    topic: safeTopic,
    dateKey: daily.dateKey,
    dailySlot: daily.dailySlot,
    variantIndex,
    variantCount,
    variantLabel: `第 ${variantIndex + 1} / ${variantCount} 版`,
    titles: copy.titles,
    body: copy.body,
    images,
    tags: copy.tags,
    note: copy.note
  };
}

export function formatFashionSeedingContent(content: FashionSeedingContent) {
  return [
    `# Bridal & Dress Content Studio 小红书内容｜${content.dateKey}｜第 ${content.dailySlot} 篇｜${content.topic}｜${content.variantLabel}`,
    "",
    "## 标题备选",
    ...content.titles.map((title, index) => `${index + 1}. ${title}`),
    "",
    "## 正文",
    content.body,
    "",
    "## 标签",
    content.tags.join(" "),
    "",
    "## 内容逻辑",
    content.note,
    "",
    "## 配图方案与独立英文 Prompt",
    ...content.images.flatMap((image, index) => [
      "",
      `### ${index + 1}. ${image.name}`,
      `用途：${image.purpose}`,
      `配图建议：${image.description}`,
      `参数：${image.params.productCategory}｜${image.params.imageType}｜${image.params.scenePreference}｜${image.params.modelChoice}｜${image.params.lightPreference}`,
      "英文 Prompt：",
      image.prompt
    ])
  ].join("\n");
}
