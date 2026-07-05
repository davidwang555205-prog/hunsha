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
    ],
    concerns: [
      "截图款穿上后是不是和想象一样",
      "手臂和肩颈会不会一直紧绷",
      "主纱会不会压住整个人",
      "试纱间灯光有没有让判断失真",
      "朋友视频里状态是不是自然",
      "坐下敬茶时腰部会不会卡住",
      "拖尾重量会不会影响走路",
      "价格高的那件是否真的更适合",
      "顾问建议和自己感受是否一致",
      "回家复盘时还能不能说清喜欢哪里"
    ],
    proofs: [
      "正面、侧面和背影三张对比",
      "顾问重新收腰后的前后变化",
      "低头看腰线时那几秒停顿",
      "朋友手机里的走动小视频",
      "坐下时裙摆和腰部的状态",
      "转身时拖尾有没有跟着身体走",
      "头纱叠上以后肩颈是否更轻",
      "试纱记录里写下的犹豫点",
      "同一光线下几件婚纱的差别",
      "自己不再反复问显不显胖的瞬间"
    ],
    scenes: [
      "试纱间镜前完整试穿",
      "顾问蹲下整理裙摆",
      "朋友坐在旁边回看视频",
      "客人低头确认腰线",
      "试穿夹临时调整的位置",
      "头纱和主纱一起上身",
      "坐下试敬茶动作的片刻",
      "试纱记录表旁边的面料小样",
      "衣架前重新对比上一件",
      "镜子里安静站住的那一刻"
    ],
    materials: [
      "缎面垂坠和腰部转折",
      "蕾丝花纹和肩颈留白",
      "拖尾边缘和裙摆重量",
      "领口弧度和手臂线条",
      "头纱长度和主纱层次",
      "试穿夹调整后的腰线",
      "坐下时腰腹处的余量",
      "背后拉链和背影完整度",
      "窗边光里的白纱纹理",
      "走动时裙摆的跟随感"
    ],
    services: [
      "让顾问解释版型为什么适合",
      "请朋友拍一段不美化的视频",
      "每件都记录一个喜欢和一个犹豫点",
      "把婚礼场地告诉顾问再试下一件",
      "同时看正面、侧面、背影和走动",
      "问清楚改尺寸和拖尾处理方式",
      "把头纱和鞋高一起纳入判断",
      "不要在特别累的时候立刻决定",
      "回家后用同角度照片再复盘",
      "把真实顾虑直接讲给顾问听"
    ],
    takeaways: [
      "知道该保存哪几张试纱图",
      "把焦虑从身材转回版型判断",
      "试纱不只是在选一张漂亮照片",
      "最后选择应该有过程而不是冲动",
      "舒服和自然比立刻惊艳更重要",
      "真实视频比单张正面照更诚实",
      "适合自己的婚纱会让身体先放松",
      "顾虑被解决比被夸好看更有用",
      "选婚纱时可以慢一点确认",
      "试纱记录应该帮自己回忆当时的感觉"
    ],
    tones: [
      "像试纱后回家复盘",
      "像真实顾客写给自己的备婚日记",
      "像朋友认真帮忙记录",
      "像婚纱店温和转述客照故事",
      "像把犹豫慢慢讲清楚",
      "像试完几件后终于放松下来",
      "像不急着下结论的选择记录",
      "像把身体感受写得很具体",
      "像客照背后的真实说明",
      "像备婚收藏夹里的经验笔记"
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
    ],
    concerns: [
      "她是不是一直回头问别人意见",
      "朋友夸好看会不会反而让她更乱",
      "妈妈在意的实用细节有没有被听见",
      "伴侣反应会不会被拍得太像剧情",
      "陪试的人有没有抢走新娘重点",
      "手机视频能不能留下真实状态",
      "几个人意见不一致时怎么判断",
      "她穿上以后有没有自然站直",
      "陪同者说实话会不会太直接",
      "回家复盘还能不能记起每件差别"
    ],
    proofs: [
      "她站在镜前安静了几秒",
      "朋友拍到她自然转身的画面",
      "妈妈先帮她理头纱而不是先评价",
      "伴侣提醒她刚才一直在笑",
      "同一个角度拍下几件婚纱对比",
      "陪试的人记录下她少问问题的瞬间",
      "旁边人看见她肩颈终于放松",
      "手机相册里最自然的那段视频",
      "朋友帮她补上看不到的背影",
      "几个人一起确认不再纠结的时刻"
    ],
    scenes: [
      "朋友视角的镜前全身",
      "妈妈坐在旁边看头纱",
      "伴侣安静听顾问解释",
      "试纱间沙发边的真实反应",
      "手机里回看上一件婚纱",
      "陪同者帮忙整理拖尾",
      "几个人一起看镜子的画面",
      "朋友从侧面拍走动视频",
      "试纱间桌面上的记录和发夹",
      "候场区里轻声讨论的片刻"
    ],
    materials: [
      "头纱边缘和肩线关系",
      "拖尾展开后的背影完整度",
      "裙摆重量和走动状态",
      "腰线调整后的侧面比例",
      "袖口和手臂的自然程度",
      "坐下时裙身有没有紧绷",
      "朋友视频里的面料垂坠",
      "妈妈会注意到的敬茶动作",
      "伴侣能看懂的场地适配",
      "几件婚纱同角度下的差别"
    ],
    services: [
      "帮她拍正面、侧面、背影和走动",
      "先问她自己的感受再给意见",
      "把每件的喜欢和犹豫点记下来",
      "提醒她不要只看试纱间灯光",
      "帮她确认坐下和转身是否舒服",
      "少说都好看，多说具体差别",
      "把伴侣或妈妈的真实反应留下来",
      "回家后一起看同角度视频",
      "帮她看自己看不到的背影",
      "把陪伴感留在动作里而不是台词里"
    ],
    takeaways: [
      "陪试的人负责记录真实状态",
      "旁边人的观察能补上试纱盲区",
      "关系感不需要被拍成夸张剧情",
      "朋友视角比精修照更容易看出放松",
      "妈妈的动作有时比评价更真实",
      "伴侣陪试可以安静但很有用",
      "陪同建议要具体而不是只夸漂亮",
      "几个人一起确认的过程值得留下",
      "真实记录能让回家复盘更轻松",
      "陪试纱的重点是帮她更像自己"
    ],
    tones: [
      "像朋友陪试后的认真复盘",
      "像妈妈视角里的温柔记录",
      "像伴侣安静陪在旁边",
      "像试纱间里自然发生的小片段",
      "像帮闺蜜说真话但不施压",
      "像回家后一起翻相册",
      "像关系感自己慢慢出现",
      "像陪同者写下的备婚旁白",
      "像把反应和细节都留住",
      "像不制造剧情的真实见证"
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
      "婚礼场地是否先告诉顾问",
      "最在意的身体位置是否提前写下",
      "每件婚纱是否同角度对比",
      "试纱当天体力是否留够",
      "鞋高和头发状态是否接近婚礼当天",
      "改尺寸和拖尾处理是否问清",
      "客照授权和隐私处理是否确认",
      "一天的预约数量是否太满",
      "回家后视频复盘是否保留",
      "问题是否带去了而不是只带焦虑"
    ],
    concerns: [
      "第一次去会不会什么都不懂",
      "试太多家会不会越试越乱",
      "没有准备鞋和胸贴会不会影响比例",
      "身材焦虑会不会带偏判断",
      "试纱间情绪会不会让人立刻上头",
      "照片好看但婚礼当天会不会累",
      "问题没问清会不会后面后悔",
      "客照授权和隐私有没有说明",
      "顾问推荐是不是适合自己的场地",
      "回家以后还能不能清楚对比"
    ],
    proofs: [
      "预约前写下场地、预算和顾虑",
      "胸贴、无痕内裤和接近婚礼高度的鞋",
      "每件婚纱同角度的照片和视频",
      "试完后立刻写下喜欢和犹豫",
      "坐下、转身和走动三组动作",
      "头纱、发型和鞋高一起试",
      "问清改尺寸、拖尾和档期",
      "确认客照发布前会再次授权",
      "一天少约几家保持判断力",
      "回家用视频复盘而不是只看精修"
    ],
    scenes: [
      "试纱前清单桌面",
      "预约卡和面料小样",
      "镜前正侧面对比",
      "顾问说明腰线和拖尾",
      "头纱、胸贴和鞋放在一起",
      "试纱间入口和衣架",
      "手机相册里的同角度记录",
      "坐下试敬茶动作的画面",
      "试穿夹和改尺寸标记",
      "回家复盘时的记录本"
    ],
    materials: [
      "胸贴和无痕内裤的干净线条",
      "鞋高对腰线比例的影响",
      "头纱长度和发型关系",
      "拖尾重量和行动空间",
      "试穿夹调整出的临时腰线",
      "蕾丝、缎面和白纱在光线下的差别",
      "坐下时腰腹处是否舒服",
      "改尺寸位置和背后拉链",
      "手机视频里的真实比例",
      "同角度照片里能看出的差别"
    ],
    services: [
      "把婚礼场地和预算说清楚",
      "每件都拍正面、侧面、背影和走动",
      "把最在意的身体位置直接告诉顾问",
      "不要饿着肚子连续试很多件",
      "问清楚改尺寸和拖尾处理方式",
      "确认客照授权和隐私处理",
      "试头纱时一起看发型和鞋高",
      "每试完一件立刻记两句话",
      "一天不要把店铺排得太满",
      "回家后再用视频做最后判断"
    ],
    takeaways: [
      "试纱准备是为了少一点慌",
      "攻略不该制造新的身材焦虑",
      "带着问题去比带着焦虑去更有用",
      "同角度记录能让对比更公平",
      "第一次试纱也可以慢慢确认",
      "问清服务细节不是麻烦",
      "准备物品是帮自己看清比例",
      "预约节奏比跑很多家更重要",
      "真实视频能帮人冷静下来",
      "避坑的重点是让选择更清楚"
    ],
    tones: [
      "像第一次试纱前的实用提醒",
      "像备婚收藏夹里的清单",
      "像朋友把踩过的坑讲清楚",
      "像不制造焦虑的预约攻略",
      "像试纱前一天的准备备注",
      "像顾问温和提醒注意事项",
      "像回家复盘后整理出的经验",
      "像把复杂选择拆小一点",
      "像写给第一次去试纱的人",
      "像让人安心出门的备忘录"
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
    ],
    concerns: [
      "新品是不是只剩漂亮口号",
      "适合谁有没有讲清楚",
      "面料近看会不会失真",
      "完整上身和细节图是否能互相证明",
      "场地适配有没有说具体",
      "系列里每件婚纱差异是否清楚",
      "品牌感会不会盖过真实参考",
      "拖尾和背影是否经得起近看",
      "极简款会不会只剩白色轮廓",
      "用户能不能判断自己适不适合"
    ],
    proofs: [
      "完整上身和侧面结构",
      "领口、腰线和拖尾的连续关系",
      "面料近景里的纹理和光泽",
      "挂装静物和上身图的对照",
      "系列 mood board 里的设计线索",
      "强光下白纱没有丢掉细节",
      "背影和拖尾展开后的比例",
      "不同场地里的同一件婚纱",
      "样衣调整前后的结构确认",
      "不是命定款口号而是适配理由"
    ],
    scenes: [
      "品牌 lookbook 完整上身",
      "婚纱店橱窗里的新品挂装",
      "材质工作台上的面料小样",
      "模特轻微转身看拖尾",
      "系列 mood board 和草图",
      "酒店晨光下的主纱比例",
      "草坪自然光里的轻婚纱",
      "教堂门口的背影和拖尾",
      "橱窗柔光里的静物细节",
      "发布前最后一次样衣确认"
    ],
    materials: [
      "缎面光泽和垂坠方向",
      "蕾丝花纹密度和透感",
      "珠绣、刺绣和白纱层次",
      "领口弧度和肩颈留白",
      "腰线位置和裙摆体量",
      "拖尾长度和仪式动线",
      "挂装状态下的廓形",
      "头纱与主纱的层次关系",
      "背后拉链和收腰结构",
      "近景里仍然真实的面料纹理"
    ],
    services: [
      "把适合场地写清楚",
      "用完整上身图说明比例",
      "补一张面料近景做证据",
      "说明这件不适合哪类需求",
      "让每张图承担不同信息",
      "把系列差异拆开讲",
      "保留挂装和 mood board",
      "避免把每件都叫命定款",
      "用侧面和背影补足参考",
      "把设计语言翻译成可判断细节"
    ],
    takeaways: [
      "新品发布应该帮人看懂选择",
      "品牌感要落在版型和面料上",
      "不是每件婚纱都需要被喊成命定",
      "系列差异越清楚越容易被收藏",
      "适合谁比单纯漂亮更重要",
      "细节图能让发布更可信",
      "克制发布反而更显专业",
      "lookbook 也要保留真实参考价值",
      "婚纱设计需要被讲得具体",
      "用户能排除不适合也是专业"
    ],
    tones: [
      "像品牌发布前的设计说明",
      "像克制的新品 lookbook 文案",
      "像把版型讲给备婚用户听",
      "像设计师解释一件婚纱",
      "像系列发布里的温和旁白",
      "像不喊口号的新品介绍",
      "像从面料证据开始讲",
      "像品牌把适配人群说清楚",
      "像一组可以慢慢看的发布笔记",
      "像高级但不空泛的系列说明"
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
    ],
    concerns: [
      "到店后会不会被一直催定",
      "顾问是否真的先听需求",
      "试纱间是不是只在照片里好看",
      "客照授权和隐私有没有被尊重",
      "预约流程会不会让人紧张",
      "店铺日常是不是只有空间美图",
      "试纱记录能不能帮人做决定",
      "配饰和头纱搭配是否专业",
      "真实客照有没有过度精修",
      "用户预约前能不能看懂体验"
    ],
    proofs: [
      "预约卡、试穿记录和授权说明",
      "顾问先听需求再拿款的过程",
      "试纱间镜子和真实光线",
      "顾问整理裙摆时的服务距离",
      "客人看镜子时的自然表情",
      "头纱和配饰区的有序细节",
      "衣架、面料小样和改尺寸记录",
      "不露隐私的手机记录桌面",
      "每张图对应一个体验节点",
      "试纱结束后的温和确认"
    ],
    scenes: [
      "试纱间主视觉",
      "顾问和客人一起看镜子",
      "婚纱店橱窗的第一印象",
      "头纱与配饰工作台",
      "客人授权后的真实试穿瞬间",
      "预约卡和面料小样桌面",
      "候场区里的衣架和纱帘",
      "顾问整理拖尾的服务过程",
      "朋友陪同回看照片",
      "试纱结束后记录选择理由"
    ],
    materials: [
      "试纱间镜子和灯光真实度",
      "衣架上婚纱的挂装状态",
      "头纱、耳饰和手套的搭配关系",
      "面料小样和裙摆近景",
      "预约卡和记录表的干净细节",
      "顾问调整腰线时的手部动作",
      "橱窗柔光下的礼服质感",
      "客照里保留的自然姿态",
      "试穿夹和改尺寸标记",
      "等待区是否干净但不空"
    ],
    services: [
      "听完需求再拿第一组款",
      "让顾问说明每件适合和不适合的原因",
      "提前确认客照授权和隐私边界",
      "把试纱流程拍成几个清楚节点",
      "保留整理裙摆和搭配头纱的过程",
      "避免只发一排漂亮裙子",
      "让空间图也能说明服务体验",
      "把预约前最担心的问题讲出来",
      "用真实客照补充完整上身参考",
      "让每张图都对应一个安心理由"
    ],
    takeaways: [
      "门店发布要让人预约前就安心",
      "真实过程比空间炫耀更有转化价值",
      "服务感应该落在小动作里",
      "用户想看的不只是漂亮裙子",
      "客照可信度来自授权和细节",
      "试纱体验从进店那刻开始",
      "店铺日常可以真实但不能杂乱",
      "顾问沟通方式本身就是内容",
      "预约理由应该被具体看见",
      "婚纱店专业度要让人能感受到"
    ],
    tones: [
      "像门店日常的温和记录",
      "像预约前能安心看的探店笔记",
      "像顾问把流程慢慢讲清楚",
      "像真实试纱间里的服务片段",
      "像不催定的婚纱店转述",
      "像把空间和体验一起拍出来",
      "像客照发布前的细节说明",
      "像给还没到店的人一颗定心丸",
      "像婚纱馆认真经营的日常",
      "像把信任感落到每个小动作"
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

function readableCue(value: string) {
  return toPhrase(value)
    .replace(/^内容可以保留/, "")
    .replace(/^画面可以有/, "")
    .replace(/^画面不需要拍成大片，/, "")
    .replace(/^配图适合出现/, "")
    .replace(/^配图可以有/, "")
    .replace(/^适合拍/, "")
    .replace(/^试纱间里可以保留/, "")
    .replace(/^如果是系列发布，最好让/, "系列发布时让")
    .replace(/^每张图要说明/, "每张图说明")
    .replace(/^不要把/, "不把")
    .replace(/内容/g, "笔记")
    .replace(/用户/g, "人")
    .replace(/读者/g, "看到的人")
    .replace(/是否/g, "有没有")
    .replace(/^让人知道/, "知道")
    .replace(/^让看到的人/, "让人")
    .replace(/^帮预约前的人/, "预约前的人")
    .replace(/^让品牌或门店/, "品牌或门店")
    .replace(/^让组图/, "组图")
    .replace(/^让最终选择/, "最终选择")
    .replace(/^让同一单品/, "同一单品")
    .replace(/^让场景/, "场景")
    .replace(/^让面料/, "面料")
    .replace(/^让裙装/, "裙装")
    .replace(/^，+/, "")
    .trim();
}

function titleCue(value: string, maxLength = 12) {
  const cue = readableCue(value)
    .replace(/第一次真实到店试纱的新娘/g, "第一次试纱的人")
    .replace(/第一次预约试纱的新娘/g, "第一次试纱的人")
    .replace(/带着截图但还没确定风格的人/g, "带截图试纱的人")
    .replace(/担心自己撑不起主纱的人/g, "担心主纱压身的人")
    .replace(/一直纠结手臂和腰线的人/g, "纠结手臂腰线的人")
    .replace(/想听真实客照反馈的备婚人/g, "想看真实客照的人")
    .replace(/试了很多件反而更乱的人/g, "越试越乱的人")
    .replace(/需要朋友帮忙拍视频的人/g, "需要朋友拍视频的人")
    .replace(/想确认婚礼当天舒适度的人/g, "在意当天舒适度的人")
    .replace(/不想被一句好看带着走的人/g, "不想只听好看的人")
    .replace(/想把顾虑说清楚再选择的人/g, "想先说清顾虑的人")
    .replace(/带妈妈一起看婚纱的人/g, "带妈妈试纱的人")
    .replace(/容易被精修图影响判断的人/g, "容易被精修带跑的人")
    .replace(/穿上后身体有没有先放松/g, "身体放松感")
    .replace(/截图款穿上后是不是和想象一样/g, "截图款上身落差")
    .replace(/截图款和真实上身有没有一致/g, "截图款上身落差")
    .replace(/镜前停顿是不是来自喜欢/g, "镜前那一下停顿")
    .replace(/走动视频里状态有没有自然/g, "走动视频状态")
    .replace(/手臂、肩颈和腰线的真实反应/g, "手臂肩颈腰线")
    .replace(/朋友随手拍有没有比精修更有参考/g, "朋友随手拍")
    .replace(/坐下和转身有没有仍然舒服/g, "坐下转身舒适度")
    .replace(/最后留下来的那一点确定感/g, "最后那点确定感")
    .replace(/手臂和肩颈会不会一直紧绷/g, "手臂肩颈紧绷感")
    .replace(/主纱会不会压住整个人/g, "主纱压身")
    .replace(/试纱间灯光有没有让判断失真/g, "灯光判断误差")
    .replace(/朋友视频里状态是不是自然/g, "朋友视频状态")
    .replace(/坐下敬茶时腰部会不会卡住/g, "坐下敬茶余量")
    .replace(/拖尾重量会不会影响走路/g, "拖尾走路负担")
    .replace(/价格高的那件有没有真的更适合/g, "高价款适配度")
    .replace(/顾问建议和自己感受有没有一致/g, "顾问建议和体感")
    .replace(/回家复盘时还能不能说清喜欢哪里/g, "回家还说得清")
    .replace(/正面、侧面和背影三张对比/g, "正侧背对比")
    .replace(/顾问重新收腰后的前后变化/g, "收腰前后变化")
    .replace(/低头看腰线时那几秒停顿/g, "低头看腰线")
    .replace(/朋友手机里的走动小视频/g, "朋友走动视频")
    .replace(/坐下时裙摆和腰部的状态/g, "坐下时腰裙状态")
    .replace(/转身时拖尾有没有跟着身体走/g, "转身拖尾状态")
    .replace(/头纱叠上以后肩颈有没有更轻/g, "头纱叠上肩颈")
    .replace(/试纱记录里写下的犹豫点/g, "试纱犹豫点")
    .replace(/同一光线下几件婚纱的差别/g, "同光线对比")
    .replace(/自己不再反复问显不显胖的瞬间/g, "不再问显胖那刻")
    .replace(/试纱间镜前完整试穿/g, "镜前完整试穿")
    .replace(/顾问蹲下整理裙摆/g, "顾问整理裙摆")
    .replace(/朋友坐在旁边回看视频/g, "朋友回看视频")
    .replace(/客人低头确认腰线/g, "低头确认腰线")
    .replace(/试穿夹临时调整的位置/g, "试穿夹位置")
    .replace(/头纱和主纱一起上身/g, "头纱主纱上身")
    .replace(/坐下试敬茶动作的片刻/g, "坐下敬茶动作")
    .replace(/试纱记录表旁边的面料小样/g, "记录表和面料")
    .replace(/衣架前重新对比上一件/g, "衣架前对比")
    .replace(/镜子里安静站住的那一刻/g, "镜前站住那刻")
    .replace(/缎面垂坠和腰部转折/g, "缎面腰线")
    .replace(/蕾丝花纹和肩颈留白/g, "蕾丝肩颈留白")
    .replace(/拖尾边缘和裙摆重量/g, "拖尾和裙摆重量")
    .replace(/领口弧度和手臂线条/g, "领口和手臂线")
    .replace(/头纱长度和主纱层次/g, "头纱主纱层次")
    .replace(/试穿夹调整后的腰线/g, "试穿夹后腰线")
    .replace(/坐下时腰腹处的余量/g, "坐下腰腹余量")
    .replace(/背后拉链和背影完整度/g, "背影完整度")
    .replace(/窗边光里的白纱纹理/g, "窗边白纱纹理")
    .replace(/走动时裙摆的跟随感/g, "裙摆跟随感")
    .replace(/有没有/g, "")
    .replace(/是不是/g, "")
    .replace(/会不会/g, "")
    .replace(/能不能/g, "")
    .replace(/是否/g, "")
    .replace(/穿上后/g, "")
    .replace(/一直/g, "")
    .replace(/真的/g, "")
    .replace(/，+/g, "，")
    .replace(/^，|，$/g, "")
    .trim();

  if (cue.length <= maxLength) return cue;

  return `${cue.slice(0, maxLength).replace(/[，、：:]+$/g, "")}…`;
}

function softenAction(value: string) {
  return readableCue(value)
    .replace(/^让顾问/, "可以让顾问")
    .replace(/^请朋友/, "记得请朋友")
    .replace(/^每件都/, "每件最好都")
    .replace(/^把/, "可以把")
    .replace(/^同时看/, "别忘了看")
    .replace(/^问清楚/, "提前问清楚")
    .replace(/^确认/, "提前确认")
    .replace(/^不要/, "尽量不要")
    .replace(/^回家后/, "回家后再")
    .replace(/^先用/, "先用")
    .replace(/^再补/, "再补")
    .replace(/^保留/, "保留")
    .replace(/^避免/, "避免")
    .replace(/^听完/, "听完")
    .trim();
}

const titleStarters = ["说实话", "别急着定", "试完才懂", "这点很容易忽略", "建议收藏", "别只看精修", "真的有差", "这组更像真实记录", "先别被大片带跑", "我会先看"];

const titleAngles = ["不是越惊艳越适合", "比好看更重要", "回家复盘才看出来", "一眼看懂差别", "不想踩坑先看这点", "拍照前先确认", "真实感在这些细节里", "别让情绪替你做决定", "收藏这几个判断点", "越具体越安心"];

const titleClosers = ["这点真的会影响判断", "别等试完才发现", "很多人第一眼会看错", "看懂就不容易乱", "适合比惊艳更重要", "这才是能收藏的原因", "不是广告感，是参考感", "细节会自己说话", "别被一句好看带走", "越真实越有说服力"];

const bodyOpeners = [
  "先说结论：",
  "这条想写得实在一点。",
  "如果只看第一眼，真的很容易选偏。",
  "我现在看这类图，会先看细节。",
  "这不是那种只夸漂亮的笔记。",
  "越到后面越觉得，判断不能只靠氛围。",
  "有些差别，只有上身以后才明显。",
  "这类内容最怕写得太满。",
  "真实记录里，最有用的反而是小细节。",
  "别急着下结论，先看这几个地方。"
];

const bodyTransitions = [
  "所以这组图里，我会先留这一点：",
  "真正有参考价值的，是",
  "比起大词，我更想把镜头放到",
  "如果要我选一张最该留下的图，我会选",
  "这比单纯说好看更具体：",
  "回头看最能说明问题的，其实是",
  "别小看这个画面：",
  "它能把判断从情绪拉回细节：",
  "很多人会忽略，但我觉得该拍下来：",
  "这一幕比精修照更诚实："
];

const bodyClosers = [
  "不用把话说得太满，能让人看懂为什么，就已经很值得收藏。",
  "好看的图很多，能帮人做判断的图更少。",
  "我会更喜欢这种有过程的记录，看完知道下一步该怎么选。",
  "真实感不是随便拍，是每张图都有一个能被验证的点。",
  "这类笔记不用喊口号，细节讲清楚就会有人停下来。",
  "如果看完能少一点纠结，这条内容就不是空的。",
  "比起制造惊艳，我更想保留这种能复盘的证据。",
  "它不需要特别热闹，但要让人觉得可信。",
  "收藏价值就在这里：不是替你决定，而是帮你看清楚。",
  "越真实的内容，越不需要把情绪推得很满。"
];

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
    focuses: ensureBankItems([...(override.focuses ?? []), ...categoryBank.focuses, ...kit.openings], [], `${topic}判断点`),
    concerns: ensureBankItems([...(override.concerns ?? []), ...categoryBank.concerns, ...kit.observations], [], `${topic}顾虑`),
    proofs: ensureBankItems([...(override.proofs ?? []), ...categoryBank.proofs, ...kitPhrases], [], `${topic}证据`),
    scenes: ensureBankItems([...(override.scenes ?? []), ...categoryBank.scenes, ...kit.scenes], [], `${topic}场景`),
    materials: ensureBankItems([...(override.materials ?? []), ...categoryBank.materials, ...kit.observations], [], `${topic}细节`),
    services: ensureBankItems(override.services ?? [], categoryBank.services, `${topic}动作`),
    takeaways: ensureBankItems([...(override.takeaways ?? []), ...categoryBank.takeaways, ...kit.closings], [], `${topic}收尾`),
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

function buildHumanPromptContext(
  topic: FashionSeedingTopic,
  audience: string,
  focus: string,
  concern: string,
  proof: string,
  scene: string,
  material: string,
  service: string,
  takeaway: string,
  tone: string
): CopyAlignmentContext {
  return {
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
}

function buildXiaohongshuDraftCopy(
  topic: XiaohongshuBridalTopic,
  kit: TopicCopyKit,
  bank: CopyVariationBank,
  axes: VariantAxes
): TopicCopyDraft {
  const draft = pick(xiaohongshuBridalCopyDrafts[topic], axes.primary);
  const audience = readableCue(pick(bank.audiences, axes.primary));
  const focus = readableCue(pick(bank.focuses, axes.secondary));
  const concern = readableCue(pick(bank.concerns, axes.tertiary));
  const proof = readableCue(pick(bank.proofs, axes.primary));
  const scene = readableCue(pick(bank.scenes, axes.secondary));
  const material = readableCue(pick(bank.materials, axes.tertiary));
  const service = softenAction(pick(bank.services, axes.primary));
  const takeaway = readableCue(pick(bank.takeaways, axes.secondary));
  const tone = readableCue(pick(bank.tones, axes.tertiary));
  const titleAudience = titleCue(audience, 11);
  const shortFocus = titleCue(focus, 11);
  const shortConcern = titleCue(concern, 11);
  const titleProof = titleCue(proof, 12);
  const titleScene = titleCue(scene, 10);
  const titleMaterial = titleCue(material, 10);
  const bodyAudience = titleCue(audience, 24);
  const bodyFocus = titleCue(focus, 24);
  const bodyConcern = titleCue(concern, 24);
  const bodyProof = titleCue(proof, 24);
  const bodyScene = titleCue(scene, 24);
  const bodyMaterial = titleCue(material, 24);
  const baseTitle = pick(draft.titles, axes.secondary);
  const titleStarter = pick(titleStarters, axes.primary);
  const titleCloser = pick(titleClosers, axes.tertiary);
  const paragraphs = draft.paragraphs.map(toPhrase);
  const [p0, p1, p2, p3] = paragraphs;
  const promptContext = buildHumanPromptContext(topic, audience, focus, concern, proof, scene, material, service, takeaway, tone);

  return {
    titles: [
      `${baseTitle}，${titleAudience}先看${shortFocus}，别急着纠结${shortConcern}`,
      `${titleStarter}，${titleScene}里的${titleProof}，比精修更能看出${titleMaterial}`,
      `${titleAudience}别被${shortConcern}带跑，先看${titleProof}和${shortFocus}`
    ],
    body: [
      `${p0}，对${bodyAudience}来说，我会先看${bodyFocus}，再看${bodyConcern}，因为这两点最容易被第一眼的氛围盖过去。`,
      `${p1}，这组最该留下的是${bodyProof}，放在${bodyScene}里看，${bodyMaterial}比精修图更能说明问题。`,
      `${p2}，现场${service}，顺手把${bodyProof}也拍下来，再补一眼${bodyFocus}和${bodyMaterial}，回家复盘时就不会只剩一句“好看”或“不好看”。`,
      `${p3}，对${bodyAudience}来说，${takeaway}就够实用了；${titleCloser}。`
    ].join("\n\n"),
    tags: buildVariantTags(kit, bank, axes),
    note: `这一版主打${tone}，用${proof}和${material}回应${audience}最在意的${concern}。`,
    promptContext
  };
}

function buildCopyFromKit(topic: FashionSeedingTopic, variantIndex: number): TopicCopyDraft {
  const kit = topicCopyKits[topic];
  const bank = buildCopyVariationBank(topic, kit);
  const axes = getVariantAxes(variantIndex);

  if (isXiaohongshuBridalTopic(topic)) {
    return buildXiaohongshuDraftCopy(topic, kit, bank, axes);
  }

  const audience = readableCue(pick(bank.audiences, axes.primary));
  const focus = readableCue(pick(bank.focuses, axes.secondary));
  const concern = readableCue(pick(bank.concerns, axes.tertiary));
  const proof = readableCue(pick(bank.proofs, axes.primary));
  const scene = readableCue(pick(bank.scenes, axes.secondary));
  const material = readableCue(pick(bank.materials, axes.tertiary));
  const service = softenAction(pick(bank.services, axes.primary));
  const takeaway = readableCue(pick(bank.takeaways, axes.secondary));
  const tone = readableCue(pick(bank.tones, axes.tertiary));
  const shortAudience = titleCue(audience, 11);
  const shortFocus = titleCue(focus, 11);
  const shortConcern = titleCue(concern, 11);
  const shortProof = titleCue(proof, 12);
  const shortScene = titleCue(scene, 10);
  const shortMaterial = titleCue(material, 10);
  const bodyAudience = titleCue(audience, 24);
  const bodyFocus = titleCue(focus, 24);
  const bodyConcern = titleCue(concern, 24);
  const bodyProof = titleCue(proof, 24);
  const bodyScene = titleCue(scene, 24);
  const bodyMaterial = titleCue(material, 24);
  const titleStarter = pick(titleStarters, axes.primary);
  const titleAngle = pick(titleAngles, axes.secondary);
  const titleCloser = pick(titleClosers, axes.tertiary);
  const openingHook = toPhrase(pick(bodyOpeners, axes.primary));
  const transitionHook = toPhrase(pick(bodyTransitions, axes.secondary));
  const closingHook = toPhrase(pick(bodyClosers, axes.tertiary));
  const promptContext = buildHumanPromptContext(topic, audience, focus, concern, proof, scene, material, service, takeaway, tone);

  return {
    titles: [
      `${titleStarter}，${shortAudience}先看${shortFocus}，别被${shortConcern}带跑`,
      `${shortScene}这张留好，${shortProof}能看出${shortMaterial}`,
      `${titleAngle}：${shortAudience}别忽略${shortConcern}，${titleCloser}`
    ],
    body: [
      `${openingHook}${bodyAudience}别只看第一眼，${bodyFocus}和${bodyConcern}才是后面会反复想起的点。`,
      `${transitionHook}${bodyProof}，放在${bodyScene}里，${bodyMaterial}会比精修更说明问题。`,
      `现场${service}，再补一眼${bodyFocus}和${bodyMaterial}，不要把判断全交给氛围。`,
      `${takeaway}就够了，${bodyAudience}看完能少一点纠结，${closingHook}`
    ].join("\n\n"),
    tags: buildVariantTags(kit, bank, axes),
    note: `本版面向${audience}，核心是${focus}，用${proof}和${material}回应${concern}；同主题共有 ${TOPIC_VARIANT_COUNT} 组组合文案。`,
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

const englishVisualAlignmentByTopic: Record<FashionSeedingTopic, string> = {
  试纱体验:
    "a realistic bridal fitting experience, focused on body comfort, silhouette confirmation, mirror records, and calm decision-making",
  真实客户试纱:
    "a real customer bridal fitting post, focused on authentic try-on evidence, fitting-room mirror moments, body comfort, and honest customer hesitation",
  试纱陪同视角:
    "a companion-view bridal fitting post, focused on subtle friend or family reactions, quiet support, and real relationship details in the fitting room",
  试纱避坑准备:
    "a bridal fitting preparation post, focused on practical physical preparation items, fitting notes, shoes, undergarment planning, and realistic appointment readiness",
  婚纱品牌发布:
    "a bridal brand release post, focused on new collection structure, silhouette clarity, fabric evidence, and restrained premium lookbook mood",
  婚纱店发布:
    "a bridal boutique publishing post, focused on store trust, appointment-ready space, service detail, clean fitting-room order, and real boutique atmosphere",
  极简新娘:
    "a minimalist bridal styling post, focused on satin structure, clean proportion, quiet luxury, and soft natural light",
  法式婚纱:
    "a French lace bridal post, focused on delicate lace texture, restrained romance, neckline detail, and breathable fabric evidence",
  草坪婚礼:
    "an outdoor lawn wedding post, focused on natural movement, greenery, soft daylight, and white gown detail without overexposure",
  酒店婚礼:
    "a hotel wedding post, focused on morning preparation, warm interior mood, suite details, and understated ceremony feeling",
  海边旅拍:
    "a seaside bridal travel shoot post, focused on gentle wind, low-saturation coast, natural movement, and clean dress proportion",
  登记照:
    "a registry-day bridal post, focused on clean documentation, simple styling, intimate milestone feeling, and natural light",
  晚宴礼服:
    "an evening gown post, focused on formal proportion, warm dinner light, restrained glamour, and polished event mood",
  婚礼前一天:
    "a pre-wedding-day detail post, focused on preparation stillness, veil, gown, shoes, bouquet, and quiet anticipation",
  新娘独处时刻:
    "a quiet solo bride post, focused on personal stillness, soft room light, natural posture, and breathable emotional space",
  通勤裙装:
    "a commuter dress post, focused on weekday polish, practical movement, clean waistline, and grounded city styling",
  约会裙装:
    "a date dress post, focused on natural femininity, warm social setting, comfortable fit, and not overly sweet styling",
  周末裙装:
    "a weekend dress post, focused on relaxed movement, cafe or flower-shop rhythm, soft daylight, and wearable ease",
  度假长裙:
    "a vacation maxi dress post, focused on light drape, resort daylight, wind movement, and low-saturation travel mood",
  艺术馆穿搭:
    "an art-gallery outfit post, focused on negative space, clean silhouette, quiet city mood, and restrained styling",
  下午茶:
    "an afternoon-tea dress post, focused on relaxed social mood, soft cafe light, clean proportion, and non-sugary femininity",
  晚餐约会:
    "a dinner-date dress post, focused on warm evening light, mature elegance, fabric detail, and comfortable formal mood",
  轻熟日常:
    "a refined daily dress post, focused on mature ease, stable proportion, low-saturation styling, and real wardrobe feeling",
  秋冬裙装:
    "an autumn-winter dress post, focused on tactile fabric, warmth, clear layering, and balanced lightness",
  一条裙子的多场景:
    "a multi-scene dress post, focused on one garment across commuting, cafe, gallery, and dinner moments with consistent structure"
};

function buildPromptAlignmentRequirement(draft: ImageDraft, context?: CopyAlignmentContext) {
  if (!context) return draft.extraRequirement;

  return [
    draft.extraRequirement,
    `Create it as part of ${englishVisualAlignmentByTopic[context.topic]}. Keep the result photographic and scene-based, not a text page, instruction sheet, UI screen, poster, or brochure layout. Do not render readable Chinese text, captions, labels, watermarks, or document-style blocks inside the image.`
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
    `# 小红书内容｜${content.dateKey}｜第 ${content.dailySlot} 篇｜${content.topic}｜${content.variantLabel}`,
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
    "## 配图方案",
    ...content.images.flatMap((image, index) => [
      "",
      `### ${index + 1}. ${image.name}`,
      `用途：${image.purpose}`,
      `配图建议：${image.description}`,
      `参数：${image.params.productCategory}｜${image.params.imageType}｜${image.params.scenePreference}｜${image.params.modelChoice}｜${image.params.lightPreference}`
    ])
  ].join("\n");
}

export function formatFashionSeedingKeywords(content: FashionSeedingContent) {
  return content.images.map((image, index) => `Prompt ${index + 1}\n${image.prompt}`).join("\n\n---\n\n");
}
