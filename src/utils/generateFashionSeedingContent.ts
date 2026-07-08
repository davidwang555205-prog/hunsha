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

type VisualRecipe = {
  camera: string;
  evidence: string;
  detail: string;
};

type VariantAxes = {
  variantIndex: number;
  primary: number;
  secondary: number;
  tertiary: number;
  audience: number;
  focus: number;
  concern: number;
  proof: number;
  scene: number;
  material: number;
  service: number;
  takeaway: number;
  tone: number;
  tagA: number;
  tagB: number;
  tagC: number;
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
  visualRecipe: VisualRecipe;
};

type NarrativeTemplateContext = CopyAlignmentContext & {
  audienceCue: string;
  focusCue: string;
  concernCue: string;
  proofCue: string;
  sceneCue: string;
  materialCue: string;
  serviceCue: string;
  takeawayCue: string;
};

type NarrativeTemplate = (context: NarrativeTemplateContext) => string;
type NarrativeType = "bridal" | "phone" | "prep" | "companion" | "brand" | "store" | "dress";
type NarrativePool = Partial<Record<NarrativeType, NarrativeTemplate[]>> & Record<"bridal" | "dress", NarrativeTemplate[]>;

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
    "顾问用钉珠道具调整腰线的过程近景",
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
    "钉珠道具留下的临时调整痕迹",
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
      "钉珠道具临时调整的位置",
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
      "钉珠道具调整后的腰线",
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
  手机对镜自拍试纱: {
    audiences: [
      "第一次想用手机记录试纱的人",
      "不想只靠店里精修图的人",
      "担心对镜自拍比例失真的新娘",
      "想回家慢慢复盘试纱的人",
      "容易被试纱间灯光带走的人",
      "需要同角度对比几件婚纱的人",
      "想看真实手机镜头状态的人",
      "担心手机挡住婚纱细节的人",
      "想把试纱记录拍得自然的人",
      "不想被广角和滤镜骗到的人"
    ],
    focuses: [
      "手机对镜全身有没有拍到腰线",
      "手机有没有挡住领口和肩颈",
      "正常镜头里比例是否自然",
      "正面、侧面和背影是否同角度",
      "手拿手机时肩颈是否紧张",
      "裙摆在手机画面里是否压人",
      "自拍里能不能看清拖尾长度",
      "同一位置前后调整是否明显",
      "手机视频里走动是否轻松",
      "回家复盘时是否还能看懂差别"
    ],
    concerns: [
      "手机自拍会不会把比例拍歪",
      "开广角会不会误导真实身高",
      "店拍好看但手机里会不会普通",
      "手机挡住胸口会不会影响判断",
      "试纱间镜子会不会让比例失真",
      "自拍太随手会不会看不出细节",
      "回家只剩精修会不会难判断",
      "同角度对比会不会没有留够",
      "滤镜和拉腿会不会骗到自己",
      "手机屏幕会不会露出隐私信息"
    ],
    proofs: [
      "手持手机的镜前全身自拍",
      "同一镜子里的正侧背对比",
      "顾问收腰前后的同角度自拍",
      "手机里十秒自然走动视频",
      "不拉腿的正常镜头比例",
      "手机没挡住领口和腰线的画面",
      "侧身自拍里的拖尾重量",
      "低头看腰线时的手机近拍",
      "回家相册里的几件婚纱对照",
      "自拍和店拍放在一起复盘"
    ],
    scenes: [
      "试纱间全身镜前自拍",
      "手机拿在胸口旁边的镜前画面",
      "侧身看裙摆体量的自拍",
      "同一个镜子前对比几件婚纱",
      "顾问调整后重新自拍",
      "手机近拍腰线和钉珠道具",
      "试纱间角落的自然手机记录",
      "回家看手机相册的桌面",
      "镜前轻轻走两步的视频感",
      "自拍前整理裙摆的片刻"
    ],
    materials: [
      "手机画面里的腰线和领口",
      "镜子反射里的裙摆体量",
      "手机近拍下的缎面垂坠",
      "蕾丝在普通镜头里的纹理",
      "钉珠道具调整后的临时腰线",
      "拖尾边缘在镜子里的长度",
      "手臂拿手机时的肩颈线条",
      "侧身自拍里的腰腹余量",
      "正常镜头下的白纱细节",
      "手机相册里同角度的差别"
    ],
    services: [
      "用同一个镜子拍正面、侧面和背影",
      "把手机放到不挡腰线的位置",
      "尽量不要开广角和拉腿滤镜",
      "让顾问调整后再拍一张同角度",
      "补一段十秒自然走动视频",
      "近拍腰线、领口和钉珠道具",
      "不要露出手机里的聊天和隐私",
      "每件都保留一张最普通的自拍",
      "回家把自拍和店拍放在一起看",
      "拍完先写下当时的身体感受"
    ],
    takeaways: [
      "手机自拍是给自己复盘的证据",
      "真实比例比当下出片更重要",
      "普通镜头能帮人冷静下来",
      "同角度记录让几件婚纱更好比较",
      "不拉腿的自拍反而更有参考",
      "试纱记录不需要完美但要诚实",
      "手机别挡住婚纱关键结构",
      "自拍和店拍一起看才更完整",
      "回家复盘时能少一点上头",
      "真实手机镜头能看出身体是否放松"
    ],
    tones: [
      "像试纱后翻手机相册复盘",
      "像真实新娘提醒自己别上头",
      "像朋友教你怎么留试纱证据",
      "像不加滤镜的备婚日记",
      "像把手机自拍拍得有用而不是漂亮",
      "像回家后冷静比较几件婚纱",
      "像试纱间里顺手留下的真实记录",
      "像给第一次试纱的人一条提醒",
      "像把自拍误区说清楚",
      "像收藏夹里的试纱记录方法"
    ],
    tagExtras: [
      "#手机对镜自拍",
      "#试纱自拍",
      "#试纱记录",
      "#对镜自拍",
      "#备婚日记",
      "#真实试纱",
      "#试纱攻略",
      "#婚纱试穿",
      "#试纱复盘",
      "#婚纱馆"
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
      "试纱间桌面上的记录和发饰",
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
      "准备胸贴、鞋和发饰的人",
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
      "钉珠道具和改尺寸标记",
      "回家复盘时的记录本"
    ],
    materials: [
      "胸贴和无痕内裤的干净线条",
      "鞋高对腰线比例的影响",
      "头纱长度和发型关系",
      "拖尾重量和行动空间",
      "钉珠道具调整出的临时腰线",
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
      "钉珠道具和改尺寸标记",
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
    .replace(/把收藏价值放在可复穿上/g, "把重点放在可复穿")
    .replace(/收藏价值/g, "可复穿")
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
    .replace(/第一次想用手机记录试纱的人/g, "手机记录试纱的人")
    .replace(/不想只靠店里精修图的人/g, "不只看店拍的人")
    .replace(/担心对镜自拍比例失真的新娘/g, "怕自拍比例失真的人")
    .replace(/想回家慢慢复盘试纱的人/g, "想回家复盘的人")
    .replace(/容易被试纱间灯光带走的人/g, "容易被灯光带跑的人")
    .replace(/需要同角度对比几件婚纱的人/g, "需要同角度对比的人")
    .replace(/想看真实手机镜头状态的人/g, "想看手机真实状态的人")
    .replace(/担心手机挡住婚纱细节的人/g, "怕手机挡细节的人")
    .replace(/想把试纱记录拍得自然的人/g, "想自然记录试纱的人")
    .replace(/不想被广角和滤镜骗到的人/g, "怕被广角滤镜骗的人")
    .replace(/正在对比新品系列的新娘/g, "对比新品的人")
    .replace(/想看懂主纱设计逻辑的人/g, "想看懂版型的人")
    .replace(/偏爱克制品牌审美的人/g, "喜欢克制款的人")
    .replace(/想知道一件婚纱适合谁的人/g, "想知道适合谁的人")
    .replace(/关注面料证据而不是口号的人/g, "想看面料证据的人")
    .replace(/看新品但怕被大片误导的人/g, "怕被大片带跑的人")
    .replace(/想理解系列差异的备婚人/g, "想看系列差异的人")
    .replace(/预约前想了解店铺体验的人/g, "想先了解店的人")
    .replace(/担心进店后被催定的新娘/g, "怕进店被催的人")
    .replace(/在意顾问沟通方式的备婚人/g, "在意顾问沟通的人")
    .replace(/准备探店但还没下定的人/g, "准备探店的人")
    .replace(/想知道试纱流程是否舒服的人/g, "想看试纱流程的人")
    .replace(/需要一个安心预约理由的人/g, "想安心预约的人")
    .replace(/穿上后身体有没有先放松/g, "身体放松感")
    .replace(/截图款穿上后是不是和想象一样/g, "截图款上身落差")
    .replace(/截图款和真实上身有没有一致/g, "截图款上身落差")
    .replace(/新品为什么适合这一类新娘/g, "适合哪类新娘")
    .replace(/穿上后会不会一直想整理胸口/g, "胸口总想整理")
    .replace(/系列里每件婚纱的功能差异/g, "系列差异")
    .replace(/领口、腰线和拖尾的设计关系/g, "领腰拖尾关系")
    .replace(/完整上身和挂装图是否互相补充/g, "上身挂装对照")
    .replace(/品牌审美是否落在可判断细节上/g, "细节能否判断")
    .replace(/发布内容是否帮用户排除不适合/g, "能否排除不适合")
    .replace(/lookbook 感和真实参考是否平衡/g, "lookbook参考感")
    .replace(/进店后会不会被理解/g, "进店被理解")
    .replace(/顾问是否先听需求再拿款/g, "先听需求再拿款")
    .replace(/试纱间空间和镜子是否真实/g, "试纱间和镜子")
    .replace(/客照授权有没有被尊重/g, "客照授权")
    .replace(/预约卡和试穿记录是否清楚/g, "预约卡和记录")
    .replace(/服务过程有没有压迫感/g, "服务压迫感")
    .replace(/每张图是否对应一个体验节点/g, "每张图有节点")
    .replace(/门店内容有没有真实过程/g, "门店真实过程")
    .replace(/用户能不能预约前就知道会被怎样对待/g, "预约前看懂体验")
    .replace(/手机对镜全身有没有拍到腰线/g, "手机镜前腰线")
    .replace(/手机有没有挡住领口和肩颈/g, "手机挡领口肩颈")
    .replace(/正常镜头里比例是否自然/g, "正常镜头比例")
    .replace(/正面、侧面和背影是否同角度/g, "正侧背同角度")
    .replace(/手拿手机时肩颈是否紧张/g, "手持手机肩颈")
    .replace(/裙摆在手机画面里是否压人/g, "手机里裙摆压身")
    .replace(/自拍里能不能看清拖尾长度/g, "自拍拖尾长度")
    .replace(/同一位置前后调整是否明显/g, "同位置前后变化")
    .replace(/手机视频里走动是否轻松/g, "手机走动视频")
    .replace(/回家复盘时是否还能看懂差别/g, "回家看得懂差别")
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
    .replace(/手机自拍会不会把比例拍歪/g, "自拍比例拍歪")
    .replace(/开广角会不会误导真实身高/g, "广角误导身高")
    .replace(/店拍好看但手机里会不会普通/g, "店拍和手机落差")
    .replace(/手机挡住胸口会不会影响判断/g, "手机挡胸口")
    .replace(/试纱间镜子会不会让比例失真/g, "镜子比例失真")
    .replace(/自拍太随手会不会看不出细节/g, "自拍看不出细节")
    .replace(/回家只剩精修会不会难判断/g, "只剩精修难判断")
    .replace(/同角度对比会不会没有留够/g, "同角度没留够")
    .replace(/滤镜和拉腿会不会骗到自己/g, "滤镜拉腿骗自己")
    .replace(/手机屏幕会不会露出隐私信息/g, "手机隐私信息")
    .replace(/正面、侧面和背影三张对比/g, "正侧背对比")
    .replace(/手持手机的镜前全身自拍/g, "手机镜前全身")
    .replace(/同一镜子里的正侧背对比/g, "同镜正侧背")
    .replace(/顾问收腰前后的同角度自拍/g, "收腰前后自拍")
    .replace(/手机里十秒自然走动视频/g, "十秒走动视频")
    .replace(/不拉腿的正常镜头比例/g, "不拉腿比例")
    .replace(/手机没挡住领口和腰线的画面/g, "不挡领口腰线")
    .replace(/侧身自拍里的拖尾重量/g, "侧身拖尾重量")
    .replace(/低头看腰线时的手机近拍/g, "手机近拍腰线")
    .replace(/回家相册里的几件婚纱对照/g, "相册婚纱对照")
    .replace(/自拍和店拍放在一起复盘/g, "自拍店拍复盘")
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
    .replace(/钉珠道具临时调整的位置/g, "钉珠道具位置")
    .replace(/头纱和主纱一起上身/g, "头纱主纱上身")
    .replace(/坐下试敬茶动作的片刻/g, "坐下敬茶动作")
    .replace(/试纱记录表旁边的面料小样/g, "记录表和面料")
    .replace(/衣架前重新对比上一件/g, "衣架前对比")
    .replace(/镜子里安静站住的那一刻/g, "镜前站住那刻")
    .replace(/试纱间全身镜前自拍/g, "全身镜前自拍")
    .replace(/手机拿在胸口旁边的镜前画面/g, "手机不挡胸口")
    .replace(/侧身看裙摆体量的自拍/g, "侧身裙摆自拍")
    .replace(/同一个镜子前对比几件婚纱/g, "同镜对比婚纱")
    .replace(/顾问调整后重新自拍/g, "调整后再自拍")
    .replace(/手机近拍腰线和钉珠道具/g, "近拍腰线钉珠")
    .replace(/试纱间角落的自然手机记录/g, "自然手机记录")
    .replace(/回家看手机相册的桌面/g, "手机相册复盘")
    .replace(/镜前轻轻走两步的视频感/g, "镜前走动视频")
    .replace(/自拍前整理裙摆的片刻/g, "自拍前整理裙摆")
    .replace(/缎面垂坠和腰部转折/g, "缎面腰线")
    .replace(/手机画面里的腰线和领口/g, "手机里腰线领口")
    .replace(/镜子反射里的裙摆体量/g, "镜中裙摆体量")
    .replace(/手机近拍下的缎面垂坠/g, "手机近拍缎面")
    .replace(/蕾丝在普通镜头里的纹理/g, "普通镜头蕾丝")
    .replace(/拖尾边缘在镜子里的长度/g, "镜中拖尾长度")
    .replace(/手臂拿手机时的肩颈线条/g, "手持手机肩颈线")
    .replace(/侧身自拍里的腰腹余量/g, "侧身腰腹余量")
    .replace(/正常镜头下的白纱细节/g, "正常镜头白纱")
    .replace(/手机相册里同角度的差别/g, "相册同角度差别")
    .replace(/蕾丝花纹和肩颈留白/g, "蕾丝肩颈留白")
    .replace(/拖尾边缘和裙摆重量/g, "拖尾和裙摆重量")
    .replace(/领口弧度和手臂线条/g, "领口和手臂线")
    .replace(/头纱长度和主纱层次/g, "头纱主纱层次")
    .replace(/钉珠道具调整后的腰线/g, "钉珠调整腰线")
    .replace(/坐下时腰腹处的余量/g, "坐下腰腹余量")
    .replace(/背后拉链和背影完整度/g, "背影完整度")
    .replace(/窗边光里的白纱纹理/g, "窗边白纱纹理")
    .replace(/走动时裙摆的跟随感/g, "裙摆跟随感")
    .replace(/完整上身和侧面结构/g, "上身侧面结构")
    .replace(/领口、腰线和拖尾的连续关系/g, "领腰拖尾")
    .replace(/面料近景里的纹理和光泽/g, "面料纹理光泽")
    .replace(/挂装静物和上身图的对照/g, "挂装上身对照")
    .replace(/系列 mood board 里的设计线索/g, "mood board线索")
    .replace(/强光下白纱没有丢掉细节/g, "强光白纱细节")
    .replace(/背影和拖尾展开后的比例/g, "背影拖尾比例")
    .replace(/不同场地里的同一件婚纱/g, "不同场地上身")
    .replace(/样衣调整前后的结构确认/g, "样衣调整前后")
    .replace(/不是命定款口号而是适配理由/g, "不是命定口号")
    .replace(/品牌 lookbook 完整上身/g, "lookbook上身")
    .replace(/婚纱店橱窗里的新品挂装/g, "橱窗新品挂装")
    .replace(/材质工作台上的面料小样/g, "面料小样")
    .replace(/模特轻微转身看拖尾/g, "转身看拖尾")
    .replace(/系列 mood board 和草图/g, "mood board草图")
    .replace(/酒店晨光下的主纱比例/g, "酒店晨光主纱")
    .replace(/草坪自然光里的轻婚纱/g, "草坪轻婚纱")
    .replace(/教堂门口的背影和拖尾/g, "教堂背影拖尾")
    .replace(/橱窗柔光里的静物细节/g, "橱窗静物细节")
    .replace(/发布前最后一次样衣确认/g, "样衣最后确认")
    .replace(/到店后会不会被一直催定/g, "到店被催定")
    .replace(/试纱间是不是只在照片里好看/g, "试纱间只会拍照")
    .replace(/客照授权和隐私有没有被尊重/g, "客照授权隐私")
    .replace(/预约流程会不会让人紧张/g, "预约流程紧张")
    .replace(/店铺日常是不是只有空间美图/g, "只有空间美图")
    .replace(/试纱记录能不能帮人做决定/g, "试纱记录有用")
    .replace(/配饰和头纱搭配是否专业/g, "配饰头纱搭配")
    .replace(/真实客照有没有过度精修/g, "客照过度精修")
    .replace(/用户预约前能不能看懂体验/g, "预约前看懂体验")
    .replace(/预约卡、试穿记录和授权说明/g, "预约卡和记录")
    .replace(/顾问先听需求再拿款的过程/g, "先听需求拿款")
    .replace(/试纱间镜子和真实光线/g, "试纱间真实光")
    .replace(/顾问整理裙摆时的服务距离/g, "整理裙摆距离")
    .replace(/客人看镜子时的自然表情/g, "镜前自然表情")
    .replace(/头纱和配饰区的有序细节/g, "头纱配饰区")
    .replace(/衣架、面料小样和改尺寸记录/g, "衣架面料记录")
    .replace(/不露隐私的手机记录桌面/g, "不露隐私桌面")
    .replace(/试纱结束后的温和确认/g, "试后确认")
    .replace(/顾问和客人一起看镜子/g, "顾问一起看镜")
    .replace(/婚纱店橱窗的第一印象/g, "橱窗第一眼")
    .replace(/头纱与配饰工作台/g, "头纱配饰台")
    .replace(/客人授权后的真实试穿瞬间/g, "授权客照瞬间")
    .replace(/预约卡和面料小样桌面/g, "预约卡桌面")
    .replace(/候场区里的衣架和纱帘/g, "候场衣架纱帘")
    .replace(/顾问整理拖尾的服务过程/g, "整理拖尾过程")
    .replace(/朋友陪同回看照片/g, "陪同回看照片")
    .replace(/试纱结束后记录选择理由/g, "试后记录理由")
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

  return cue.slice(0, maxLength).replace(/[，、：:]+$/g, "");
}

function narrativeCue(value: string, maxLength = 24) {
  return titleCue(value, maxLength)
    .replace(/走动视频状态/g, "走动状态")
    .replace(/头纱主纱上身/g, "头纱上身后的层次")
    .replace(/手机挡领口肩颈/g, "手机有没有挡住领口")
    .replace(/手机里裙摆压身/g, "手机里裙摆会不会压身")
    .replace(/鞋包换掉后场景迁移/g, "换鞋包后的比例")
    .replace(/花店门口的自然光/g, "花店门口那束自然光")
    .replace(/正常镜头白纱/g, "普通镜头里的白纱")
    .replace(/回家后再用同角度照片再复盘/g, "回家同角度复盘")
    .replace(/每件最好都记录一个喜欢和一个犹豫点/g, "记录喜欢和犹豫点")
    .replace(/可以把婚礼场地告诉顾问再试下一件/g, "把场地先告诉顾问")
    .replace(/可以把真实顾虑直接讲给顾问听/g, "把真实顾虑讲出来")
    .replace(/手机挡没挡住领口/g, "手机有没有挡住领口")
    .replace(/知道该保存哪几张试纱图/g, "哪几张试纱图该留")
    .replace(/新品发布应该帮人看懂选择/g, "看懂这件适合谁")
    .replace(/门店发布要让人预约前就安心/g, "预约前能安心一点")
    .replace(/让人预约前就安心/g, "预约前能安心一点")
    .replace(/试纱准备是为了少一点慌/g, "出门前少一点慌")
    .replace(/真实比例比当下出片更重要/g, "先看真实比例")
    .replace(/场景切换比单张美图更有说服力/g, "不同场景都说得通")
    .replace(/A 字/g, "A字")
    .replace(/，+/g, "，")
    .replace(/^，|，$/g, "")
    .trim();
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

const titleStarters = ["先别急", "试完再说", "我会多看一眼", "这张别删", "回家再看才明显", "别只看店拍", "那天我注意到", "这一点很容易漏", "留一张普通的", "先看身体反应"];

const titleAngles = ["别只听一句好看", "普通照片反而有用", "镜子前那几秒很说明问题", "看细节比看氛围稳", "先把顾虑拍下来", "有些答案在侧面", "别让灯光替你决定", "试纱可以慢一点", "上身以后再判断", "越普通越能复盘"];

const titleClosers = ["回家还能看懂", "当场别急着定", "比精修更诚实", "这张我会留下", "先别删手机照", "能少纠结一点", "看完再换下一件", "比口头夸奖有用", "适合自己最要紧", "这次别被氛围带走"];

type TitleContext = {
  topic: FashionSeedingTopic;
  baseTitle?: string;
  audienceCue: string;
  focusCue: string;
  concernCue: string;
  proofCue: string;
  sceneCue: string;
  materialCue: string;
  starter: string;
  angle: string;
  closer: string;
};

function cleanTitle(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/，+/g, "，")
    .replace(/：+/g, "：")
    .replace(/^，|，$/g, "")
    .slice(0, 34);
}

function buildNaturalTitles(context: TitleContext) {
  const { topic, baseTitle, audienceCue, focusCue, concernCue, proofCue, sceneCue, materialCue, starter, angle, closer } = context;

  if (topic === "婚纱品牌发布") {
    return [
      cleanTitle(`${materialCue}先看清，别急着喊命定`),
      cleanTitle(`${proofCue}放前面，回应${concernCue}`),
      cleanTitle(`${sceneCue}看${focusCue}，${closer}`)
    ];
  }

  if (topic === "婚纱店发布") {
    return [
      cleanTitle(`${baseTitle || "婚纱店日常"}，今天拍了${sceneCue}`),
      cleanTitle(`预约前我会先看${proofCue}`),
      cleanTitle(`${starter}，别只看装修，也看${focusCue}`)
    ];
  }

  if (topic === "手机对镜自拍试纱") {
    return [
      cleanTitle(`${baseTitle || "试纱自拍"}，手机这张别急着删`),
      cleanTitle(`${starter}，先看${focusCue}`),
      cleanTitle(`${proofCue}留好，${closer}`)
    ];
  }

  if (topic === "试纱避坑准备") {
    return [
      cleanTitle(`${baseTitle || "试纱前一天"}，出门前看一遍`),
      cleanTitle(`${sceneCue}这张留好，明天会用到`),
      cleanTitle(`${audienceCue}别怕${concernCue}`)
    ];
  }

  if (topic === "试纱陪同视角") {
    return [
      cleanTitle(baseTitle || "陪她试纱，旁边人先看见变化"),
      cleanTitle(`${sceneCue}别删，${proofCue}能对上`),
      cleanTitle(`${audienceCue}看${materialCue}，少说都好看`)
    ];
  }

  if (isBridalFashionTopic(topic)) {
    return [
      cleanTitle(`${baseTitle || starter}，试纱时先看${focusCue}`),
      cleanTitle(`${sceneCue}这张别删，${proofCue}很有用`),
      cleanTitle(`${audienceCue}先别纠结${concernCue}`)
    ];
  }

  return [
    cleanTitle(`${starter}，今天先看${focusCue}`),
    cleanTitle(`${sceneCue}这张我会留下`),
    cleanTitle(`${angle}，尤其是${materialCue}`)
  ];
}

const characterMoodOpenings: NarrativePool = {
  bridal: [
    ({ concernCue }) => `她刚换好衣服时没有马上看镜头，先低头把裙摆往前拨了一点，说自己其实还是担心${concernCue}。`,
    ({ audienceCue }) => `如果是我在店里记录这组图，我会从${audienceCue}站到镜子前那几秒开始写。她手还扶着腰线，眼神没有立刻放松。`,
    ({ focusCue }) => `那天她进试纱间前一直在翻手机相册，截图看了很多遍，真正上身后反而先摸了摸肩带，说想再看清${focusCue}。`,
    ({ concernCue }) => `她不是一进来就说要哪件的人，换好婚纱以后先安静站了一会儿，像是在确认${concernCue}会不会真的影响自己。`,
    ({ audienceCue }) => `这位${audienceCue}的状态很真实，嘴上说都可以试，身体却一直有点紧，手指会下意识去碰肩带和腰侧。`,
    ({ focusCue }) => `我记得她走出来的时候没有笑得很夸张，只是先看镜子里的${focusCue}，然后轻轻问了一句这样会不会太满。`,
    ({ concernCue }) => `试纱最容易被第一眼带走，但她那天没有急着说喜欢，先让顾问等等，自己低头看了看${concernCue}相关的位置。`,
    ({ audienceCue }) => `有些${audienceCue}不是不确定审美，是还没找到身体放松的那一下。她站出来的时候，肩膀还是微微提着。`,
    ({ focusCue }) => `这组记录我不想从“好美”开始写，想从她慢慢转身那一刻开始。那一下，${focusCue}比表情更先被看见。`,
    ({ concernCue }) => `她说自己来之前做了很多功课，但换上以后第一个反应不是拍照，而是站在镜子前停住，看${concernCue}有没有被放大。`
  ],
  phone: [
    ({ concernCue }) => `她拿起手机时先往旁边挪了一点，不是为了找最好看的角度，是怕${concernCue}。`,
    ({ focusCue }) => `这组自拍没有开广角。她站到镜子前，先确认手机没有挡住${focusCue}，才按下第一张。`,
    ({ audienceCue }) => `给${audienceCue}看的试纱记录，开头就应该普通一点。手机举起来，裙摆还没完全铺好，这反而像真的。`,
    ({ concernCue }) => `她说店拍当然好看，但回家真正反复看的，还是手机里那几张能看清${concernCue}的照片。`,
    ({ focusCue }) => `第一张自拍有点歪，她没删。因为那张刚好拍到了${focusCue}，比摆好的照片更能复盘。`,
    ({ audienceCue }) => `${audienceCue}很容易在试纱间上头，所以我会先让她拍一张最普通的镜前全身。`,
    ({ concernCue }) => `她把手机从胸口旁边移开一点，又重新站直。这个小动作，是为了别让${concernCue}干扰判断。`,
    ({ focusCue }) => `试纱自拍不需要像大片。手机拿稳、脚别往前伸，先把${focusCue}留下来。`,
    ({ concernCue }) => `她原本担心${concernCue}，所以没有只拍正面，又补了一张侧身和一段走动。`,
    ({ audienceCue }) => `如果是${audienceCue}第一次试纱，我会提醒她：先拍给自己看，不是拍给别人夸。`
  ],
  prep: [
    ({ concernCue }) => `试纱前一天，她把胸贴、鞋和发圈都放到包旁边，才发现自己最担心的其实是${concernCue}。`,
    ({ focusCue }) => `这类准备不用写得很吓人。先把${focusCue}记下来，第二天到店就不会全靠临场反应。`,
    ({ audienceCue }) => `${audienceCue}出门前最需要的不是一长串攻略，是几件真的会用到的小东西。`,
    ({ concernCue }) => `她本来想一天约三家，写清${concernCue}以后，反而把行程删掉了一半。`,
    ({ focusCue }) => `准备清单摊在桌上时，最有用的不是东西多，而是${focusCue}有没有先想好。`,
    ({ audienceCue }) => `给${audienceCue}的提醒可以简单一点：吃点东西，穿舒服的鞋，把问题写下来。`,
    ({ concernCue }) => `很多慌乱不是因为不懂婚纱，是到店后才想起${concernCue}还没问。`,
    ({ focusCue }) => `她把手机备忘录打开，只写了三行：场地、预算、${focusCue}。够用了。`,
    ({ concernCue }) => `试纱当天情绪很容易满，提前面对${concernCue}，到店后会轻一点。`,
    ({ audienceCue }) => `${audienceCue}不用把自己准备成完美状态，只要带着问题去。`
  ],
  companion: [
    () => `陪她试纱那天，我先看见的不是裙摆，是她一直回头确认大家的反应。`,
    ({ focusCue }) => `朋友坐在旁边其实很容易看出来，${focusCue}出现时，她整个人会先松一下。`,
    ({ audienceCue }) => `${audienceCue}不要急着给答案，先看她站到镜子前有没有自然一点。`,
    ({ concernCue }) => `妈妈没有马上评价好不好看，只是先帮她理头纱。那一下，${concernCue}反而没那么重。`,
    ({ focusCue }) => `我负责拍视频，所以会比她更清楚${focusCue}是不是只在正面成立。`,
    ({ audienceCue }) => `给${audienceCue}的记录，不用拍成剧情。旁边人的安静反应就够真实。`,
    ({ concernCue }) => `她一开始很在意${concernCue}，后来走了两步，自己先笑了一下。`,
    ({ focusCue }) => `陪试的人最好少说“都好看”，多帮她看${focusCue}这种具体地方。`,
    () => `伴侣坐在旁边没有插话，只在她反复问意见时提醒她刚才一直在笑。`,
    ({ audienceCue }) => `${audienceCue}其实是帮她留证据的人，不是替她决定的人。`
  ],
  brand: [
    ({ focusCue }) => `这组新品我不想从“高级”两个字开始。先把${focusCue}放出来，能看懂再谈喜欢。`,
    ({ concernCue }) => `拍发布图前，我们先把${concernCue}拿出来看了一遍，避免一组图只剩漂亮。`,
    ({ materialCue }) => `样衣挂在架子上时很安静，真正需要说清的是${materialCue}，不是给它套一句命定。`,
    ({ focusCue }) => `这件上身以后，团队先看${focusCue}，没有急着定主图。婚纱发布不能只靠第一眼。`,
    ({ concernCue }) => `如果一组新品让人看完还在想${concernCue}，那文案再漂亮也没用。`,
    ({ materialCue }) => `我会先发一张没那么热闹的图，让${materialCue}自己露出来，少一点口号。`,
    ({ focusCue }) => `这一季的线条不复杂，所以更要把${focusCue}拍清楚。简单款最怕说空话。`,
    ({ concernCue }) => `发布前我们删掉了几句太满的描述，留下能回答${concernCue}的画面。`,
    ({ materialCue }) => `近看${materialCue}时，才知道这件该怎么讲。远景负责好看，近景负责诚实。`,
    ({ focusCue }) => `这不是一组只求氛围的新品图。第一张要让人看见${focusCue}，后面才接得住。`
  ],
  store: [
    ({ concernCue }) => `今天店里第一组图没有拍满墙婚纱，先拍了她说起自己怕${concernCue}的那几分钟。`,
    ({ focusCue }) => `顾问没有急着拿最贵的款，先坐下来听她说完。这个过程里，${focusCue}比空间图更值得拍。`,
    ({ audienceCue }) => `给${audienceCue}看的门店记录，开头不用太热闹。预约卡、镜子和一段沟通就够了。`,
    ({ concernCue }) => `她进门前其实有点担心${concernCue}，所以顾问先把流程说清楚，没有马上推进试穿。`,
    ({ focusCue }) => `这组想记录的不是店有多大，而是${focusCue}有没有发生在真实服务里。`,
    ({ audienceCue }) => `${audienceCue}最想知道的不是橱窗有多美，是进店以后会不会被好好听见。`,
    ({ concernCue }) => `拍到一半我停了一下，把会露出隐私的东西移开。门店日常再真实，也要照顾${concernCue}。`,
    ({ focusCue }) => `客人站在镜前时，顾问退后了半步。这个距离感，刚好能说明${focusCue}。`,
    ({ concernCue }) => `她没有被催着马上定，先把${concernCue}讲出来。这个片段比一排裙子更像店里的真实一天。`,
    ({ audienceCue }) => `如果我是${audienceCue}，我会想先看到试纱间的光、镜子和顾问怎么说话。`
  ],
  dress: [
    ({ concernCue }) => `她出门前在入户镜前站了一会儿，没有急着拎包，先低头看裙摆和鞋子的距离，像是在确认${concernCue}。`,
    ({ audienceCue }) => `这条记录更像${audienceCue}出门前的自检，不是摆好姿势拍一张，而是穿上以后先走两步。`,
    ({ focusCue }) => `她把外套搭在手臂上，又回到镜子前看了一眼${focusCue}，表情不是惊喜，是终于不用再调整。`,
    ({ concernCue }) => `很多日常裙装不是第一眼决定的，她那天先坐下，再站起来，才开始判断${concernCue}会不会打扰自己。`,
    ({ audienceCue }) => `${audienceCue}最真实的状态，是早上没有太多时间纠结。她把头发随手别到耳后，先看裙子能不能跟上今天的日程。`,
    ({ focusCue }) => `拍这组的时候，她没有故意凹姿势，只是在门口停了一下，用手顺了顺${focusCue}附近的线条。`,
    ({ concernCue }) => `她原本担心${concernCue}，所以没有直接出门，先在镜子前转了半圈，看裙摆有没有跟着身体走。`,
    ({ audienceCue }) => `如果写给${audienceCue}看，我会从换鞋那一步写起。鞋跟一变，裙长和腰线的感觉马上就不一样。`,
    ({ focusCue }) => `这条裙子不是靠第一眼热闹留住人的，她站在窗边整理袖口时，反而更能看清${focusCue}。`,
    ({ concernCue }) => `她试完没有马上说好看，只是把包换到另一边肩上，看${concernCue}在真实动作里还会不会出现。`
  ]
};

const environmentDetails: NarrativePool = {
  bridal: [
    ({ sceneCue }) => `试纱间里很安静，窗帘只拉到一半，软光落在镜子边缘。这一版要留住的${sceneCue}，不需要拍得很满。`,
    ({ sceneCue }) => `顾问把灯调低了一点，镜子旁边只留了衣架和一张小凳子。${sceneCue}在这种环境里会更像真实记录。`,
    ({ sceneCue }) => `窗边那一角有一点柔光，珠片轻轻反光，但不是刺眼的亮。站近了看，${sceneCue}也没有被环境抢走。`,
    ({ sceneCue }) => `试纱间门关上以后，外面的声音变小，只剩裙摆拖过地毯的声音。${sceneCue}就在这个安静里慢慢出现。`,
    ({ sceneCue }) => `镜子旁边的纱帘有一点褶，空间没有被收拾成样板间。这样看${sceneCue}，反而更像真实预约。`,
    ({ sceneCue }) => `旁边的椅子上放着头纱和鞋，没有多余装饰。视线自然回到她身上，也回到${sceneCue}。`,
    ({ sceneCue }) => `窗边光从侧面进来，白纱不会糊成一片，钉珠和蕾丝都有细小阴影。${sceneCue}也因此更清楚。`,
    ({ sceneCue }) => `朋友坐在沙发边没有说话，房间里有一小段停顿。比起热闹地夸，${sceneCue}在这种时候更真实。`,
    ({ sceneCue }) => `顾问蹲下整理拖尾时，镜面刚好照到侧面比例。这个角度适合看${sceneCue}，也比正面更诚实。`,
    ({ sceneCue }) => `桌上有预约卡、面料小样和一束没拆开的头纱，都是很小的东西。它们让${sceneCue}像真的发生过。`
  ],
  phone: [
    ({ sceneCue }) => `镜子旁边有一点窗帘影子，地面线也在，没有被修得太干净。${sceneCue}放在这样的画面里才有参考。`,
    ({ sceneCue }) => `试纱间灯光偏软，手机拍出来不是特别亮，但腰线和裙摆还清楚。${sceneCue}不用追求完美。`,
    ({ sceneCue }) => `她把手机举到胸口旁边，镜子里能看到完整拖尾。${sceneCue}看起来很普通，却适合回家慢慢看。`,
    ({ sceneCue }) => `背景里能看到衣架和纱帘，空间不乱，也不像刻意布景。${sceneCue}因此更像真实试纱。`,
    ({ sceneCue }) => `顾问退到画面外，只留一点手部整理裙摆的痕迹。${sceneCue}还是主角，手机也没有挡住结构。`,
    ({ sceneCue }) => `镜前那块地毯没有被裁掉，脚和裙摆的位置都能看见。判断${sceneCue}时，这些小地方很有用。`,
    ({ sceneCue }) => `手机相册里的缩略图排在一起，正面、侧面和走动都有。${sceneCue}不是为了出片，是为了对比。`,
    ({ sceneCue }) => `那天店里不算吵，只有顾问整理拖尾的声音。${sceneCue}就在这种很日常的间隙里留下来。`,
    ({ sceneCue }) => `镜子边缘有一点反光，手机画面没有开滤镜。这样看${sceneCue}，比例比较接近真实。`,
    ({ sceneCue }) => `她拍完没有立刻发出去，而是坐到旁边翻了几张。${sceneCue}在相册里并排看，差别会更明显。`
  ],
  prep: [
    ({ sceneCue }) => `桌面上没有摆太多东西，只有预约卡、鞋、胸贴和一支笔。${sceneCue}放在这里，很像出门前最后看一遍。`,
    ({ sceneCue }) => `试纱前的房间很安静，手机备忘录还亮着。${sceneCue}不是攻略封面，是明天真的要用的记录。`,
    ({ sceneCue }) => `鞋盒开着，头纱照片存在相册里，包还没拉上。${sceneCue}就停在这个出门前的小空隙。`,
    ({ sceneCue }) => `她把清单写在便签纸上，没有做得很精致。${sceneCue}越普通，越像真的会被带去店里。`,
    ({ sceneCue }) => `桌角有一杯水，旁边是无痕内裤和接近婚礼高度的鞋。${sceneCue}看起来琐碎，但很实用。`,
    ({ sceneCue }) => `预约时间、预算和场地被写在同一页上。${sceneCue}让试纱当天少一点临时慌乱。`,
    ({ sceneCue }) => `镜前先试了一下鞋高，裙子还没穿上，比例问题已经能提前想一遍。${sceneCue}就从这里开始。`,
    ({ sceneCue }) => `包里留了一个小文件夹，放试纱记录和面料小样。${sceneCue}不漂亮，但会帮上忙。`,
    ({ sceneCue }) => `她没有把一天排得很满，日历上只留了两家店。${sceneCue}看起来松一点，判断也会清楚一点。`,
    ({ sceneCue }) => `试纱间入口还没出现，准备已经开始了。${sceneCue}不是焦虑，是给自己留一点余地。`
  ],
  companion: [
    ({ sceneCue }) => `试纱间沙发不大，朋友坐在侧面，手机一直横着拿。${sceneCue}就在这种角度里更真实。`,
    ({ sceneCue }) => `妈妈坐在旁边，没有急着说话，手里还拿着刚取下来的头纱。${sceneCue}不需要很热闹。`,
    ({ sceneCue }) => `顾问整理裙摆时，陪试的人刚好能看到背影。${sceneCue}比正面照多了一层判断。`,
    ({ sceneCue }) => `镜子里除了她，还有旁边人安静看着的影子。${sceneCue}像真实试纱，不像排练好的剧情。`,
    ({ sceneCue }) => `手机里回放上一件婚纱时，几个人都凑近了一点。${sceneCue}让意见变得具体。`,
    ({ sceneCue }) => `候场区的灯不亮，声音也低。${sceneCue}在这种环境里不会被夸张情绪盖掉。`,
    ({ sceneCue }) => `朋友从侧面拍她走两步，脚下地毯和拖尾都在画面里。${sceneCue}能看出真实行动感。`,
    ({ sceneCue }) => `配饰台上头纱还没收回去，旁边放着试纱记录表。${sceneCue}看起来像刚刚发生。`,
    ({ sceneCue }) => `伴侣坐得有点拘谨，但看得很认真。${sceneCue}里那一点不熟练，反而很真实。`,
    ({ sceneCue }) => `几个人一起看镜子时，没有人抢着下结论。${sceneCue}就在这个停顿里。`
  ],
  brand: [
    ({ sceneCue }) => `拍摄台上只放了样衣、面料卡和一张草图，东西不多。${sceneCue}留一点空，系列线索反而更清楚。`,
    ({ sceneCue }) => `窗边光落在挂装上，白纱没有糊成一片。${sceneCue}不需要布置得很华丽，先把结构拍准。`,
    ({ sceneCue }) => `lookbook 的背景压得很干净，但没有把房间修到失真。${sceneCue}要看得出是婚纱，不是海报。`,
    ({ sceneCue }) => `样衣最后确认时，桌上还有没收起来的钉珠道具和线剪。${sceneCue}在这种过程里更可信。`,
    ({ sceneCue }) => `橱窗光很轻，挂装的影子落在地面上。${sceneCue}不吵，适合把新品慢慢看完。`,
    ({ sceneCue }) => `拍完整上身前，团队先看了侧面和背影。${sceneCue}不是补充图，它会影响这件怎么被理解。`,
    ({ sceneCue }) => `mood board 没有占满画面，只露出一点纸张边缘。${sceneCue}还是围着衣服走。`,
    ({ sceneCue }) => `酒店晨光那组保留了窗框和地毯线，婚纱的比例没有被拉长。${sceneCue}因此更像可参考的新品图。`,
    ({ sceneCue }) => `草坪那张没有把绿色调得很浓，白纱边缘还能看见层次。${sceneCue}也没有被背景吞掉。`,
    ({ sceneCue }) => `发布图里可以有一点安静，不必每张都像封面。${sceneCue}留给人慢慢看就好。`
  ],
  store: [
    ({ sceneCue }) => `试纱间门半开着，里面能看到镜子、纱帘和一排衣架。${sceneCue}不豪华，但看着让人知道会怎么开始。`,
    ({ sceneCue }) => `桌上放着预约卡和面料小样，手机屏幕被避开了。${sceneCue}看起来普通，反而让人安心。`,
    ({ sceneCue }) => `顾问整理裙摆时没有贴得太近，画面里留了距离。${sceneCue}能看见服务，也不会让人紧张。`,
    ({ sceneCue }) => `候场区的椅子、鞋盒和头纱都在原位，干净但没有装成样板间。${sceneCue}像真实营业的一天。`,
    ({ sceneCue }) => `橱窗那一面光很柔，挂着的婚纱没有被拍成一片白。${sceneCue}让人先看清款式。`,
    ({ sceneCue }) => `朋友坐在旁边翻视频，顾问在等客人自己开口。${sceneCue}里那点停顿很重要。`,
    ({ sceneCue }) => `配饰台上有头纱、耳饰和手套，摆得清楚，不抢画面。${sceneCue}是服务的一部分。`,
    ({ sceneCue }) => `试纱结束后，记录表还放在桌边。${sceneCue}不是摆拍道具，是刚刚用过的东西。`,
    ({ sceneCue }) => `镜子前的光没有过曝，白纱和人的肤色都正常。${sceneCue}能让预约前的人少猜一点。`,
    ({ sceneCue }) => `这家店的日常不需要拍得很忙。${sceneCue}干净、具体，就比空口说专业更好。`
  ],
  dress: [
    ({ sceneCue }) => `窗边的光不强，有一点灰调，裙子的颜色在日常光里反而更容易看准。${sceneCue}不用被拍成大片。`,
    ({ sceneCue }) => `她没有把背景收得太干净，桌角、包带和鞋尖都留了一点生活痕迹。这样看${sceneCue}更可信。`,
    ({ sceneCue }) => `地面线条和镜子边框都还在，比例没有被修得太完美。${sceneCue}在这种画面里更接近真实出门前。`,
    ({ sceneCue }) => `咖啡杯放在手边，下午的光慢慢落下来。${sceneCue}有一点松弛，但没有甜到失真。`,
    ({ sceneCue }) => `电梯门快合上时她看了一眼镜子，金属反光让线条更清楚，也让${sceneCue}像随手记录。`,
    ({ sceneCue }) => `画面里没有太多道具，只有窗光、椅背和一小块地毯。少一点布置，${sceneCue}反而被看见。`,
    ({ sceneCue }) => `街角风有一点轻，裙摆不是刻意甩起来的，是走路时自然晃了一下。${sceneCue}也跟着变得轻。`,
    ({ sceneCue }) => `她坐下的时候没有刻意挺直，桌边高度刚好能看出腰腹会不会紧。${sceneCue}只是背景，真实动作才是这一段的重点。`,
    ({ sceneCue }) => `衣帽间的门半开着，挂装和上身状态放在一起。这样看${sceneCue}，不像只为拍照存在。`,
    ({ sceneCue }) => `白墙和留白很多，反而能把肩颈、腰线和裙长看得更稳。${sceneCue}不用靠复杂背景。`
  ]
};

const productObservationDetails: NarrativePool = {
  bridal: [
    ({ materialCue, focusCue }) => `上身后先看方领和细肩带，领口没有顶住脖子，肩带也没有勒进肩膀。再回头看${focusCue}，会比第一眼更准。`,
    ({ materialCue, focusCue }) => `腰线的位置比想象中重要，裙摆从腰侧往下落，没有立刻膨出去。${materialCue}也要放在这个比例里一起看。`,
    ({ materialCue }) => `近一点会发现，白纱不是一整片平的白。蕾丝、钉珠和花朵层次在光里有起伏，${materialCue}也更容易被看见。`,
    ({ focusCue }) => `她用手摸了一下肩带，又低头看拖尾边缘。${focusCue}不是靠修图判断的，站在那里就能看出一点。`,
    ({ materialCue }) => `裙摆展开时没有很夸张，拖尾的长度刚好留在镜子里。灯光没有把${materialCue}吃掉，这点很重要。`,
    ({ focusCue, materialCue }) => `顾问用钉珠道具调整腰线后，前后差别很明显。再看${focusCue}和${materialCue}，就不只是口头解释。`,
    ({ materialCue }) => `如果只看远景会漏掉很多细节，胸口弧度、腰后的余量、钉珠和${materialCue}，都要近一点才看得出来。`,
    ({ focusCue }) => `她转身的时候，背后拉链、腰线和拖尾会一起进入镜子。${focusCue}在这个动作里比站定时更真实。`,
    ({ materialCue }) => `这件最耐看的地方不是裙摆多大，而是肩颈、腰线和${materialCue}之间有呼吸感，没有把人压住。`,
    ({ focusCue }) => `手机拍到的那张没有特别精致，但领口、腰线、裙摆和拖尾都在。${focusCue}反而更容易回家复盘。`
  ],
  phone: [
    ({ focusCue }) => `手机别举得太中间，领口和腰线要露出来。${focusCue}如果被手机挡住，回家就很难判断。`,
    ({ materialCue }) => `普通镜头下，缎面和蕾丝不会像店拍那么亮，但${materialCue}还在，这张就值得留。`,
    ({ focusCue, materialCue }) => `侧身自拍会把${focusCue}和${materialCue}一起带出来，尤其是拖尾有没有压人，一眼就能看见。`,
    ({ materialCue }) => `近拍腰线时能看到钉珠道具的位置，也能看到${materialCue}。这些小细节比滤镜更有用。`,
    ({ focusCue }) => `她补了一段十秒走动，裙摆有没有跟着身体走，${focusCue}会比静态自拍更清楚。`,
    ({ materialCue }) => `自拍里不要把裙摆裁掉，拖尾边缘和${materialCue}都要留在画面里。`,
    ({ focusCue }) => `如果开广角，腿会被拉长，${focusCue}也会跟着失真。正常镜头虽然普通，但更接近现场。`,
    ({ materialCue }) => `手机相册里几张放在一起看，${materialCue}的差别会比单独看一张明显很多。`,
    ({ focusCue }) => `她把手机换到另一只手，又拍了一张不挡胸口的。${focusCue}终于完整了。`,
    ({ materialCue }) => `屏幕不要露聊天，也不要露预约信息。画面只需要留下婚纱、镜子和${materialCue}。`
  ],
  prep: [
    ({ focusCue, materialCue }) => `清单里最该写清的是${focusCue}，旁边再放${materialCue}，到店后顾问会更快理解你。`,
    ({ materialCue }) => `鞋高、胸贴和无痕内裤不是小事，${materialCue}会直接影响试出来的比例。`,
    ({ focusCue }) => `每件婚纱都拍同角度，才看得出${focusCue}有没有变化，不然回家很容易乱。`,
    ({ materialCue }) => `头纱、发型和鞋一起试，${materialCue}会更接近婚礼当天，不会只停在试纱间。`,
    ({ focusCue }) => `先把预算和场地说清楚，再看款式。${focusCue}不写下来，到店很容易被漂亮裙子带走。`,
    ({ materialCue }) => `近看蕾丝、缎面和白纱，不是挑刺，是确认${materialCue}在现场也能成立。`,
    ({ focusCue }) => `坐下、转身、走两步都要试。${focusCue}如果只靠站定判断，会漏掉很多。`,
    ({ materialCue }) => `钉珠道具调整出的临时腰线可以拍下来，${materialCue}和最终改尺寸会有关。`,
    ({ focusCue }) => `每试完一件写两句话就够：喜欢哪里，犹豫哪里。${focusCue}会慢慢浮出来。`,
    ({ materialCue }) => `客照授权和隐私边界也提前问，${materialCue}之外，这些细节也会影响体验。`
  ],
  companion: [
    () => `陪试的人更容易看到背影和侧面，头纱、肩线和拖尾不能只靠她自己在镜子里猜。`,
    ({ materialCue }) => `妈妈会先注意头纱、敬茶动作和${materialCue}，这些往往比一句好看更实际。`,
    ({ focusCue }) => `朋友拍的走动视频很有用，${focusCue}在动作里会比站定时清楚。`,
    ({ materialCue }) => `伴侣可能说不出专业词，但能看见${materialCue}是不是和场地搭。`,
    ({ focusCue }) => `她自己看不到背后的拉链和拖尾，${focusCue}就需要旁边的人补一眼。`,
    ({ materialCue }) => `同一角度拍几件以后，${materialCue}的差别不用争，翻相册就能看出来。`,
    ({ focusCue }) => `如果她一直整理肩带，${focusCue}大概率还没让她真正放松。`,
    ({ materialCue }) => `头纱叠上去以后，肩颈和${materialCue}会一起变化，陪试的人最好也拍下来。`,
    ({ focusCue }) => `少说“显瘦”，多说${focusCue}。具体一点，她才不会越听越乱。`,
    ({ materialCue }) => `坐下那一刻很容易被漏掉，${materialCue}在这个动作里会变得很诚实。`
  ],
  brand: [
    ({ focusCue, materialCue }) => `这件的重点在${focusCue}，不是把裙摆拍大。近景里的${materialCue}要接得上完整上身。`,
    ({ materialCue }) => `挂装时先看${materialCue}，上身后再看腰线。两张图能对上，发布才不空。`,
    ({ focusCue }) => `方领、细肩带、收腰和拖尾要连着看。${focusCue}如果只靠一句形容，很快就会飘。`,
    ({ materialCue }) => `蕾丝和钉珠不能只在远处闪一下，${materialCue}近看也要干净。`,
    ({ focusCue }) => `侧面图保留下来，是因为${focusCue}在正面不一定看得全。`,
    ({ materialCue }) => `强光下白纱最容易糊掉，所以这组把${materialCue}压在柔光里拍。`,
    ({ focusCue }) => `新品不需要每件都说适合所有人。看完${focusCue}，适不适合其实会清楚很多。`,
    ({ materialCue }) => `样衣调整后的腰线和${materialCue}放在一起，能看出这件不是只为封面存在。`,
    ({ focusCue }) => `背影不是补图。拉链、肩线和拖尾展开以后，${focusCue}才算完整。`,
    ({ materialCue }) => `如果一组发布没有${materialCue}，只剩氛围，备婚的人很难拿它做判断。`
  ],
  store: [
    ({ focusCue }) => `顾问拿款前先问场地和预算，${focusCue}不是写在文案里的，是这几分钟里发生的。`,
    ({ materialCue }) => `试纱间的光要正常，镜子也要正常。${materialCue}如果在现场看不清，照片再美都没用。`,
    ({ focusCue, materialCue }) => `整理裙摆时，顾问会顺手检查${materialCue}。这个动作能看出${focusCue}是不是落到细节里。`,
    ({ materialCue }) => `头纱、耳饰和手套放在台面上，不需要堆满。${materialCue}清楚，搭配就不会乱。`,
    ({ focusCue }) => `客照发布前确认授权，这一步很小，但${focusCue}会让人放心很多。`,
    ({ materialCue }) => `面料小样和改尺寸记录留在桌上，${materialCue}不是摆设，是沟通时真的会用到。`,
    ({ focusCue }) => `如果店铺只拍空间，${focusCue}就会缺一块。顾问怎么听、怎么调整，都要被看见一点。`,
    ({ materialCue }) => `橱窗图负责第一眼，${materialCue}负责让人知道进店后能看到什么。`,
    ({ focusCue }) => `朋友回看视频时，顾问没有插话催单。${focusCue}有时候就在这种安静里。`,
    ({ materialCue }) => `试完以后记录理由，比只说好看更实在。${materialCue}和选择原因放在一起，才像真实门店。`
  ],
  dress: [
    ({ materialCue, focusCue }) => `上身后先看${materialCue}，再看${focusCue}，这两个地方决定它是日常好穿，还是只适合拍一张图。`,
    ({ focusCue }) => `她低头顺了一下裙摆，腰线没有往上跑，${focusCue}在走路时也没有乱掉。`,
    ({ materialCue }) => `${materialCue}不是那种很用力的质感，坐下以后还有自然褶皱，反而更像会被经常穿出门。`,
    ({ focusCue, materialCue }) => `领口和肩线都很干净，${focusCue}没有抢掉人的状态，${materialCue}在窗边光里也不显廉价。`,
    ({ materialCue }) => `裙长刚好露出鞋面一点，${materialCue}垂下来时没有贴得太死，走动会有很小的摆幅。`,
    ({ focusCue }) => `换一双鞋再看，${focusCue}的差别就出来了，这比单独夸显瘦更有用。`,
    ({ materialCue }) => `近景里能看见${materialCue}，线头和褶裥没有被过度磨皮，日常感保留得比较好。`,
    ({ focusCue }) => `她坐下时没有一直拉裙摆，${focusCue}说明这条不是只能站着好看。`,
    ({ materialCue }) => `外套搭上去以后，${materialCue}没有被压没，裙子的轮廓还在，场景就能自然切换。`,
    ({ focusCue }) => `镜前那张最普通，但肩颈、腰线、裙长都清楚，${focusCue}比精修氛围更能说明问题。`
  ]
};

const emotionalTurns: NarrativePool = {
  bridal: [
    ({ proofCue }) => `后来她没有急着换下一件，而是让朋友帮她拍了${proofCue}，看完才慢慢笑了一下。`,
    ({ serviceCue }) => `顾问没有急着评价，只是把裙摆铺平，又提醒她按自己的节奏看。她后来记住的不是一句夸奖，而是${serviceCue}。`,
    ({ proofCue }) => `真正变化是在她转身以后，${proofCue}让她自己也看见了，不用别人一直解释。`,
    ({ concernCue }) => `她原本还在问${concernCue}，但走了两步以后，语气就轻了很多。`,
    ({ serviceCue }) => `现场没有人催她决定，顾问只是陪她把正面、侧面和背影都看了一遍。${serviceCue}也变成了很具体的一步。`,
    ({ proofCue }) => `看到${proofCue}那一刻，她没有说命定，只是很小声地说，这件好像不用一直调整。`,
    ({ concernCue }) => `前面几件她都在纠结${concernCue}，这一件穿上后，她先问的是能不能再试一下头纱。`,
    ({ proofCue }) => `${proofCue}留下来以后，朋友的意见也变具体了，不再只是“好看”两个字。`,
    ({ serviceCue }) => `顾问蹲下整理拖尾的时候，她低头看了很久。比起一句夸奖，${serviceCue}留下的过程更能说明状态。`,
    ({ concernCue }) => `她从镜子里看了正面，又侧过身看背影，关于${concernCue}的紧张慢慢少了一点。`
  ],
  phone: [
    ({ proofCue }) => `拍到${proofCue}以后，她没有马上发给朋友，而是自己先看了一遍，语气明显稳了。`,
    ({ concernCue }) => `原本一直担心${concernCue}，等正面和侧身放在一起看，她反而没那么慌。`,
    ({ serviceCue }) => `顾问调整完以后，她按${serviceCue}又补了一张。前后差别不用别人解释。`,
    ({ proofCue }) => `${proofCue}留下来以后，店拍和自拍终于能一起看，不会只记得哪张最漂亮。`,
    ({ concernCue }) => `她前面还在问${concernCue}，走动视频拍完以后，自己先说这件好像轻一点。`,
    ({ serviceCue }) => `手机位置换了两次，最后按${serviceCue}拍出来的那张最普通，却最能说明问题。`,
    ({ proofCue }) => `看到${proofCue}时，她才发现刚才站得太僵，于是又放松肩膀拍了一张。`,
    ({ concernCue }) => `关于${concernCue}的判断，不是在镜子前立刻有答案，是回到相册里慢慢变清楚。`,
    ({ serviceCue }) => `她没有忙着修图，先按${serviceCue}把该留的角度补齐。这个顺序挺重要。`,
    ({ proofCue }) => `${proofCue}不一定最好看，但后来回家复盘，她反而最常打开这一张。`
  ],
  prep: [
    ({ proofCue }) => `后来她把${proofCue}也写进备忘录，第二天试纱时少问了很多重复问题。`,
    ({ concernCue }) => `原本担心${concernCue}，但东西收好以后，那种慌张少了一半。`,
    ({ serviceCue }) => `她没有把清单做得很复杂，只提醒自己${serviceCue}。到店后反而更能听进去顾问的话。`,
    ({ proofCue }) => `${proofCue}留下来以后，回家复盘不再只靠记忆。`,
    ({ concernCue }) => `关于${concernCue}，提前想一遍，不是制造焦虑，是给现场留一点余地。`,
    ({ serviceCue }) => `试纱当天她真的按${serviceCue}做了，最直接的变化是没那么容易被第一件带跑。`,
    ({ proofCue }) => `看到${proofCue}那一页时，顾问也更快知道她在意什么。`,
    ({ concernCue }) => `她以前觉得${concernCue}很丢脸，写下来以后，反而能正常说出口。`,
    ({ serviceCue }) => `准备到最后，最有用的不是塞满包，而是记得${serviceCue}。`,
    ({ proofCue }) => `${proofCue}不是为了显得专业，是为了试完以后还能想起当时的判断。`
  ],
  companion: [
    ({ proofCue }) => `后来看到${proofCue}，她自己也安静了一下，不再急着问我们哪件更好。`,
    ({ concernCue }) => `前面她总问${concernCue}，但这件走出来以后，先看镜子的人变成了她自己。`,
    ({ serviceCue }) => `朋友没有急着夸，只是按${serviceCue}补了一段视频，意见就具体多了。`,
    ({ proofCue }) => `${proofCue}留下来以后，妈妈的那句“这件舒服吗”终于有了画面。`,
    ({ concernCue }) => `关于${concernCue}，旁边人看得出来她什么时候是真的放松，不用说太满。`,
    ({ serviceCue }) => `伴侣后来也学会了${serviceCue}，虽然动作有点笨，但她笑了。`,
    ({ proofCue }) => `比起大家一起喊好看，${proofCue}更能让她回家后继续判断。`,
    ({ concernCue }) => `她前面一直绕着${concernCue}打转，朋友把视频递过去以后，她反而没再追问。`,
    ({ serviceCue }) => `陪试到后面，最有用的事就是${serviceCue}，少一点情绪，多一点证据。`,
    ({ proofCue }) => `${proofCue}放进相册以后，那天的变化就不只存在大家的记忆里。`
  ],
  brand: [
    ({ proofCue }) => `后来我们把${proofCue}放到第二张，主图反而不用说太多。看的人会自己接上。`,
    ({ concernCue }) => `原本担心${concernCue}，所以这组没有只留远景。细节补上以后，发布才站得住。`,
    ({ serviceCue }) => `拍完第一轮，团队又按${serviceCue}补了一组。不是为了更满，是为了更清楚。`,
    ({ proofCue }) => `${proofCue}出现以后，这件的适配人群就好讲了，不必硬写成所有人都适合。`,
    ({ concernCue }) => `如果${concernCue}没有被回答，再温柔的标题也会显得虚。`,
    ({ serviceCue }) => `这组最后保留了${serviceCue}，因为它能让新品从“好看”落到“我能不能穿”。`,
    ({ proofCue }) => `${proofCue}让侧面和背影有了位置，不再只是封面图的陪衬。`,
    ({ concernCue }) => `关于${concernCue}，最好的回答不是形容词，是一张不修得太狠的近景。`,
    ({ serviceCue }) => `发布前删掉了几句过满的卖点，改成${serviceCue}。读起来轻多了。`,
    ({ proofCue }) => `等${proofCue}排进去以后，这组图才像一个系列，而不是几张漂亮婚纱。`
  ],
  store: [
    ({ proofCue }) => `后来客人看到${proofCue}，才开始把自己的顾虑说得更具体。顾问也就能接住。`,
    ({ concernCue }) => `她一开始担心${concernCue}，试完第一件后发现没人催，肩膀才慢慢放下来。`,
    ({ serviceCue }) => `顾问按${serviceCue}做完以后，没有马上推进下一件，只是等她自己看镜子。`,
    ({ proofCue }) => `${proofCue}被拍下来以后，这条门店日常就不只是在展示空间。`,
    ({ concernCue }) => `关于${concernCue}，一张试纱间照片不够，流程里的停顿也要看见。`,
    ({ serviceCue }) => `那天最让人放松的不是夸奖，是${serviceCue}这一步做得很自然。`,
    ({ proofCue }) => `看到${proofCue}，预约前的人至少能知道进店后不是只站着被评价。`,
    ({ concernCue }) => `她把${concernCue}问出口以后，顾问没有打断。这个小反应，我会留下。`,
    ({ serviceCue }) => `服务感不是喊出来的，${serviceCue}这类动作拍到一点就够。`,
    ({ proofCue }) => `${proofCue}放进组图里，店铺的信任感就不靠装修撑着了。`
  ],
  dress: [
    ({ proofCue }) => `后来她没有换姿势，只是自然走到门口，${proofCue}在这个动作里比摆拍更清楚。`,
    ({ serviceCue }) => `拍到一半她停下来整理了一下包带，再抬头时整个人松了一点。${serviceCue}，也不需要写得太复杂。`,
    ({ concernCue }) => `原本担心${concernCue}，但坐下又站起来以后，她没有再伸手去整理。`,
    ({ proofCue }) => `${proofCue}留下来以后，这条裙子就不只是好看，而是知道能穿去哪里。`,
    ({ serviceCue }) => `她没有马上下单式地夸自己，只是换了鞋再看一眼。${serviceCue}之后，她说今天这样就能出门。`,
    ({ concernCue }) => `走到楼下时她又看了一眼玻璃反光，${concernCue}没有出现，表情就自然很多。`,
    ({ proofCue }) => `比起正面照，${proofCue}更像真正会被保存的那张，因为动作没有被设计过。`,
    ({ serviceCue }) => `朋友在旁边提醒她多走两步，她试了一下，发现裙摆没有卡住脚步。${serviceCue}这类细节，现场看更清楚。`,
    ({ concernCue }) => `她之前一直问${concernCue}，后来换了包再看，反而没有那么纠结了。`,
    ({ proofCue }) => `等到${proofCue}出现时，这条裙子的日常感才落下来，不像只为一张照片存在。`
  ]
};

const humanClosings: NarrativePool = {
  bridal: [
    ({ takeawayCue }) => `所以我会停在这里。能记住${takeawayCue}，就够一个人回家慢慢想了。`,
    ({ audienceCue }) => `给${audienceCue}看的记录，不一定要替她做决定，至少要让她记得自己在镜子前的那个反应。`,
    ({ takeawayCue }) => `最后她也没有当场说死，只是把这组照片存下来。${takeawayCue}，有时候就是从这种小停顿开始的。`,
    ({ audienceCue }) => `我更想保留这种不着急的试纱记录，${audienceCue}看完会知道，适合不是被夸出来的。`,
    ({ takeawayCue }) => `如果只剩一句漂亮，回家很快就忘了；但${takeawayCue}，以后再翻相册也能看懂。`,
    ({ audienceCue }) => `这不是热闹的客照，但对${audienceCue}来说，真实身体感受比热闹更有用。`,
    ({ takeawayCue }) => `到这里就够了，不需要把情绪推到很高，${takeawayCue}才是这组图该留下的原因。`,
    ({ audienceCue }) => `${audienceCue}其实很需要这种慢一点的记录，不催她喜欢，也不催她立刻确定。`,
    ({ takeawayCue }) => `最后那张手机照有点普通，但我会留下。因为${takeawayCue}，往往就藏在普通照片里。`,
    ({ audienceCue }) => `如果${audienceCue}试纱时能少一点慌，多看一眼自己的身体状态，就够了。`
  ],
  phone: [
    ({ takeawayCue }) => `所以这组自拍不用修得太漂亮。能留下${takeawayCue}，就已经够回家看了。`,
    ({ audienceCue }) => `给${audienceCue}的小提醒：拍给自己复盘的照片，普通一点没关系。`,
    ({ takeawayCue }) => `最后我会留那张没开滤镜的，因为${takeawayCue}，比一张很好看的店拍更实在。`,
    () => `试纱时别只等别人发图，自己的手机也要有几张能看懂的。`,
    ({ takeawayCue }) => `这组到这里就够了。${takeawayCue}，回家再看时会感谢自己多拍了一张。`,
    ({ audienceCue }) => `如果${audienceCue}看完记得关掉广角、别挡腰线，就很有用了。`,
    ({ takeawayCue }) => `试纱那天情绪很容易满，${takeawayCue}能把人稍微拉回来一点。`,
    ({ audienceCue }) => `别嫌手机照太普通。对${audienceCue}来说，普通照片常常最诚实。`,
    ({ takeawayCue }) => `收尾不讲大道理，留好正面、侧面和走动。${takeawayCue}就藏在这里。`,
    ({ audienceCue }) => `下次${audienceCue}进试纱间，先拍一张正常镜头的全身，再慢慢选。`
  ],
  prep: [
    ({ takeawayCue }) => `准备做到这里就够了。${takeawayCue}，比临时抱佛脚有用。`,
    ({ audienceCue }) => `给${audienceCue}一句很小的提醒：别饿着去，也别把一天排太满。`,
    ({ takeawayCue }) => `如果这张清单能留下${takeawayCue}，试纱当天就会轻一点。`,
    ({ audienceCue }) => `${audienceCue}不用带着完美状态出门，带着问题就可以。`,
    ({ takeawayCue }) => `最后把鞋和手机充电器放进包里。${takeawayCue}，很多时候就靠这些小事。`,
    ({ audienceCue }) => `下次${audienceCue}预约试纱前，先写三句话：场地、预算、最担心哪里。`,
    ({ takeawayCue }) => `这不是让人更紧张的攻略。${takeawayCue}，才是准备的目的。`,
    ({ audienceCue }) => `如果${audienceCue}到店后能慢慢说出顾虑，这份准备就够了。`,
    ({ takeawayCue }) => `试纱准备不用做得很漂亮。能带走${takeawayCue}，就已经很好。`,
    ({ audienceCue }) => `收尾就到这里。${audienceCue}记得留点体力给真正上身的那一刻。`
  ],
  companion: [
    () => `陪试纱的人不用负责拍板，能把真实反应和走动视频留下来就已经很帮忙。`,
    ({ audienceCue }) => `给${audienceCue}一句提醒：先听她怎么说，再说自己看见了什么。`,
    ({ takeawayCue }) => `最后我会留那段走动视频。${takeawayCue}，回家看时比口头意见稳。`,
    ({ audienceCue }) => `${audienceCue}别急着把气氛推高，安静陪她看完也很好。`,
    ({ takeawayCue }) => `这组陪试记录不用写得很满。${takeawayCue}，就藏在旁边人的小动作里。`,
    ({ audienceCue }) => `如果${audienceCue}能少说“都好看”，多说一个具体差别，她会轻松很多。`,
    ({ takeawayCue }) => `几个人一起确认的过程很小，但${takeawayCue}，以后翻相册会想起来。`,
    ({ audienceCue }) => `陪${audienceCue}试纱，不是替她喜欢，是帮她看见自己有没有放松。`,
    ({ takeawayCue }) => `收尾就停在这里。${takeawayCue}，比一场夸张见证更像真实试纱。`,
    ({ audienceCue }) => `下次${audienceCue}陪试，记得拍侧面和背影，也记得问她自己舒服吗。`
  ],
  brand: [
    ({ takeawayCue }) => `这组发布我会写到这里。${takeawayCue}，比把每件都夸满更有分寸。`,
    ({ audienceCue }) => `给${audienceCue}看的新品图，最好能帮她少翻几遍，也少猜一点。`,
    ({ takeawayCue }) => `如果看完能记住${takeawayCue}，这件婚纱就不用靠口号撑着。`,
    ({ audienceCue }) => `${audienceCue}不缺漂亮图，缺的是能判断自己适不适合的那几张。`,
    ({ takeawayCue }) => `最后一张留给面料近景。${takeawayCue}，往往就是从近处看出来的。`,
    ({ audienceCue }) => `新品发布不用替${audienceCue}下结论，把该看的地方拍清楚就够。`,
    ({ takeawayCue }) => `这组不急着喊命定。${takeawayCue}，比热闹的形容词更耐看。`,
    ({ audienceCue }) => `如果${audienceCue}看完能排除一件不适合的，也算这组图有用。`,
    ({ takeawayCue }) => `发布到最后，还是回到衣服本身。${takeawayCue}，别让氛围盖过去。`,
    ({ audienceCue }) => `我更愿意让${audienceCue}慢一点看完，而不是被第一张图推着立刻喜欢。`
  ],
  store: [
    ({ takeawayCue }) => `所以门店日常不用拍得很吵。${takeawayCue}，比一句欢迎预约实在。`,
    ({ audienceCue }) => `给${audienceCue}看的东西，先让她知道进店后会被怎么对待。`,
    ({ takeawayCue }) => `这组图到这里就够了。${takeawayCue}，藏在顾问的小动作里。`,
    ({ audienceCue }) => `${audienceCue}预约前会紧张，那就把流程拍清楚一点，别只拍漂亮角落。`,
    ({ takeawayCue }) => `最后我会留一张记录表和面料小样。${takeawayCue}，比空间照更有用。`,
    ({ audienceCue }) => `如果${audienceCue}看完愿意把顾虑说出来，这条门店记录就没有白发。`,
    ({ takeawayCue }) => `店铺的可信度不是靠热闹堆出来的。${takeawayCue}，慢慢看得见。`,
    ({ audienceCue }) => `给还没到店的${audienceCue}留一点真实流程，比只发客片更安心。`,
    ({ takeawayCue }) => `这组不需要夸自己专业。${takeawayCue}，画面里已经有答案。`,
    ({ audienceCue }) => `下次${audienceCue}翻到这类门店笔记，先看服务过程，再看装修。`
  ],
  dress: [
    ({ takeawayCue }) => `这条记录不用写成种草，${takeawayCue}，比把话说得漂亮更重要。`,
    ({ audienceCue }) => `给${audienceCue}看的裙装记录，最好像出门前随手拍下来的备注，真实一点就够了。`,
    ({ takeawayCue }) => `最后她还是穿这条出了门。没有特别隆重，但${takeawayCue}，这就是日常裙子的意义。`,
    ({ audienceCue }) => `${audienceCue}不会只因为一句高级就保存，她们更想知道这条裙子能不能进入自己的生活。`,
    ({ takeawayCue }) => `如果看完只记得氛围，其实不够；能记住${takeawayCue}，才有用。`,
    ({ audienceCue }) => `这组图不需要太满，留一点真实动作，${audienceCue}反而更容易代入。`,
    ({ takeawayCue }) => `收尾就写到这里，不拔高，也不催人买。${takeawayCue}，比口号更耐看。`,
    ({ audienceCue }) => `我会把它发得像一条普通日程，给${audienceCue}一个可以照着判断的画面。`,
    ({ takeawayCue }) => `有些裙子不是第一眼赢，是穿过一天以后还舒服。${takeawayCue}，这点就够具体。`,
    ({ audienceCue }) => `如果${audienceCue}看完能想起自己衣柜里缺的那一种状态，就没有写空。`
  ]
};

const bridalVisualRecipes = {
  cameras: [
    "full-length front mirror framing with enough floor line to judge gown proportion",
    "three-quarter body angle that keeps the waistline, neckline, and train visible",
    "normal-lens phone-camera distance with no wide-angle leg stretching",
    "side-profile framing for checking arm line, waist fit, and skirt volume",
    "quiet consultant-distance view that shows adjustment without crowding the client",
    "low-clutter boutique documentary crop with garment rack context kept secondary",
    "soft window-light full-body crop that preserves white gown fabric detail",
    "slight movement frame showing walking comfort and train response",
    "back-view or over-shoulder frame for veil, zipper, and train relationship",
    "detail-to-full-body sequence logic, with close fabric proof supporting the main image"
  ],
  evidence: [
    "same-angle front, side, and back comparison as the decision evidence",
    "visible beading adjustment tools or consultant adjustment proving the fit process",
    "honest mirror reflection that shows the client posture before heavy styling",
    "phone album review feeling, as if the image helps the bride compare later",
    "waistline and hemline kept unobstructed so the dress structure can be judged",
    "fabric close-up evidence connected to the worn gown, not a detached product shot",
    "natural sitting, turning, or walking comfort clue included when possible",
    "companion or consultant presence used only as quiet context, not the main subject",
    "store appointment detail such as rack, curtain, veil, or fitting table kept believable",
    "non-retouched real-client mood with calm hesitation and clear selection logic"
  ],
  details: [
    "satin drape, lace texture, embroidery, and beadwork remain readable in soft light",
    "neckline, shoulder, sleeve, and arm line are visible enough for fitting judgement",
    "train length, skirt volume, and hem edge are not cropped out",
    "veil, hair, shoes, and accessories support the gown instead of stealing focus",
    "white fabric keeps layered texture without blown-out highlights",
    "temporary beading-tool adjustment marks feel realistic and respectful",
    "background mirror, curtain, rack, and waiting area stay clean but not showroom-fake",
    "body proportion stays natural, with realistic hands and no beauty-filter distortion",
    "scene details answer the copy's concern rather than acting as decoration",
    "the image feels like a useful fitting record, not a luxury advertisement"
  ]
};

const dressVisualRecipes = {
  cameras: [
    "full-length mirror framing with shoes and hemline visible for outfit proportion",
    "normal walking-distance street or lobby crop that keeps the dress shape clear",
    "seated lifestyle angle showing waist comfort and fabric behavior",
    "three-quarter city view with clean shoulder, neckline, and skirt length",
    "entryway mirror snapshot with believable home light and stable floor line",
    "close-to-mid fabric proof frame connected to the full outfit",
    "side-step movement frame showing drape, pleats, and skirt swing",
    "quiet cafe or dinner-table crop where the dress remains readable",
    "gallery or city negative-space frame that protects silhouette clarity",
    "wardrobe-review sequence logic, pairing worn image with hanger or detail proof"
  ],
  evidence: [
    "waistline, skirt length, and shoe proportion used as the main styling evidence",
    "sitting and walking comfort shown through natural body posture",
    "fabric drape and wrinkle behavior visible under real daily light",
    "same dress shown with practical scene clues instead of empty mood styling",
    "bag, shoes, and outerwear kept secondary so the dress remains the decision point",
    "mirror proof used to make the outfit feel repeatable, not over-produced",
    "city, cafe, gallery, or dinner context chosen to match the copy's use case",
    "low-saturation color relationship that keeps the garment premium but wearable",
    "one clear lifestyle action included to explain why the dress fits the day",
    "hanger or wardrobe detail used only when it helps prove material and structure"
  ],
  details: [
    "neckline, waist seam, sleeve edge, and hem finish stay sharp enough to inspect",
    "knit, pleat, print, or solid-color texture remains realistic in natural light",
    "skirt movement looks relaxed and not artificially wind-blown",
    "body proportions stay believable, with no stretched legs or over-filtered skin",
    "background props stay useful and sparse, never competing with the dress",
    "outerwear, shoes, and bag support the scene while preserving dress silhouette",
    "fabric weight and drape explain the outfit more than decorative styling",
    "the crop leaves enough negative space for a real Xiaohongshu lifestyle record",
    "the image answers the copy's practical concern with visible outfit evidence",
    "the result feels like a saved wardrobe note, not a glossy campaign poster"
  ]
};

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
  const primary = safeIndex % VARIANT_AXIS_SIZE;
  const secondary = Math.floor(safeIndex / VARIANT_AXIS_SIZE) % VARIANT_AXIS_SIZE;
  const tertiary = Math.floor(safeIndex / (VARIANT_AXIS_SIZE * VARIANT_AXIS_SIZE)) % VARIANT_AXIS_SIZE;

  return {
    variantIndex: safeIndex,
    primary,
    secondary,
    tertiary,
    audience: primary,
    focus: secondary,
    concern: tertiary,
    proof: (primary + secondary * 3 + tertiary * 7) % VARIANT_AXIS_SIZE,
    scene: (primary * 7 + secondary + tertiary * 3) % VARIANT_AXIS_SIZE,
    material: (primary * 3 + secondary * 7 + tertiary) % VARIANT_AXIS_SIZE,
    service: (primary * 5 + secondary * 2 + tertiary) % VARIANT_AXIS_SIZE,
    takeaway: (primary * 2 + secondary + tertiary * 5) % VARIANT_AXIS_SIZE,
    tone: (primary * 3 + secondary * 2 + tertiary) % VARIANT_AXIS_SIZE,
    tagA: primary,
    tagB: (secondary + tertiary) % VARIANT_AXIS_SIZE,
    tagC: (primary + tertiary) % VARIANT_AXIS_SIZE
  };
}

function buildVariantTags(kit: TopicCopyKit, bank: CopyVariationBank, axes: VariantAxes) {
  return uniqueItems([
    ...kit.tags,
    pick(bank.tagExtras, axes.tagA),
    pick(bank.tagExtras, axes.tagB),
    pick(bank.tagExtras, axes.tagC)
  ]).slice(0, 7);
}

function buildVisualRecipe(topic: FashionSeedingTopic, axes: VariantAxes): VisualRecipe {
  const recipes = isBridalFashionTopic(topic) ? bridalVisualRecipes : dressVisualRecipes;

  return {
    camera: pick(recipes.cameras, axes.primary),
    evidence: pick(recipes.evidence, axes.secondary),
    detail: pick(recipes.details, axes.tertiary)
  };
}

function buildNarrativeTemplateContext(context: CopyAlignmentContext): NarrativeTemplateContext {
  return {
    ...context,
    audienceCue: narrativeCue(context.audience, 24),
    focusCue: narrativeCue(context.focus, 24),
    concernCue: narrativeCue(context.concern, 24),
    proofCue: narrativeCue(context.proof, 24),
    sceneCue: narrativeCue(context.scene, 24),
    materialCue: narrativeCue(context.material, 24),
    serviceCue: narrativeCue(context.service, 24),
    takeawayCue: narrativeCue(context.takeaway, 24)
  };
}

function getNarrativeType(topic: FashionSeedingTopic): NarrativeType {
  if (topic === "手机对镜自拍试纱") return "phone";
  if (topic === "试纱避坑准备") return "prep";
  if (topic === "试纱陪同视角") return "companion";
  if (topic === "婚纱品牌发布") return "brand";
  if (topic === "婚纱店发布") return "store";
  return isBridalFashionTopic(topic) ? "bridal" : "dress";
}

function buildNarrativeBody(context: CopyAlignmentContext, axes: VariantAxes) {
  const narrativeType = getNarrativeType(context.topic);
  const narrativeContext = buildNarrativeTemplateContext(context);
  const openingTemplates = characterMoodOpenings[narrativeType] ?? characterMoodOpenings.bridal;
  const environmentTemplates = environmentDetails[narrativeType] ?? environmentDetails.bridal;
  const productTemplates = productObservationDetails[narrativeType] ?? productObservationDetails.bridal;
  const turnTemplates = emotionalTurns[narrativeType] ?? emotionalTurns.bridal;
  const closingTemplates = humanClosings[narrativeType] ?? humanClosings.bridal;

  return [
    pick(openingTemplates, axes.primary)(narrativeContext),
    pick(environmentTemplates, axes.secondary)(narrativeContext),
    pick(productTemplates, axes.tertiary)(narrativeContext),
    pick(turnTemplates, axes.proof)(narrativeContext),
    pick(closingTemplates, axes.takeaway)(narrativeContext)
  ].join("\n\n");
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
  tone: string,
  visualRecipe: VisualRecipe
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
    tone,
    visualRecipe
  };
}

function buildXiaohongshuDraftCopy(
  topic: XiaohongshuBridalTopic,
  kit: TopicCopyKit,
  bank: CopyVariationBank,
  axes: VariantAxes
): TopicCopyDraft {
  const draft = pick(xiaohongshuBridalCopyDrafts[topic], axes.primary);
  const audience = readableCue(pick(bank.audiences, axes.audience));
  const focus = readableCue(pick(bank.focuses, axes.focus));
  const concern = readableCue(pick(bank.concerns, axes.concern));
  const proof = readableCue(pick(bank.proofs, axes.proof));
  const scene = readableCue(pick(bank.scenes, axes.scene));
  const material = readableCue(pick(bank.materials, axes.material));
  const service = softenAction(pick(bank.services, axes.service));
  const takeaway = readableCue(pick(bank.takeaways, axes.takeaway));
  const tone = readableCue(pick(bank.tones, axes.tone));
  const visualRecipe = buildVisualRecipe(topic, axes);
  const titleAudience = titleCue(audience, 10);
  const shortFocus = titleCue(focus, 10);
  const shortConcern = titleCue(concern, 10);
  const titleProof = titleCue(proof, 12);
  const titleScene = titleCue(scene, 10);
  const titleMaterial = titleCue(material, 10);
  const baseTitle = pick(draft.titles, axes.secondary);
  const titleStarter = pick(titleStarters, axes.primary);
  const titleAngle = pick(titleAngles, axes.secondary);
  const titleCloser = pick(titleClosers, axes.tertiary);
  const promptContext = buildHumanPromptContext(
    topic,
    audience,
    focus,
    concern,
    proof,
    scene,
    material,
    service,
    takeaway,
    tone,
    visualRecipe
  );

  return {
    titles: buildNaturalTitles({
      topic,
      baseTitle,
      audienceCue: titleAudience,
      focusCue: shortFocus,
      concernCue: shortConcern,
      proofCue: titleProof,
      sceneCue: titleScene,
      materialCue: titleMaterial,
      starter: titleStarter,
      angle: titleAngle,
      closer: titleCloser
    }),
    body: buildNarrativeBody(promptContext, axes),
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

  const audience = readableCue(pick(bank.audiences, axes.audience));
  const focus = readableCue(pick(bank.focuses, axes.focus));
  const concern = readableCue(pick(bank.concerns, axes.concern));
  const proof = readableCue(pick(bank.proofs, axes.proof));
  const scene = readableCue(pick(bank.scenes, axes.scene));
  const material = readableCue(pick(bank.materials, axes.material));
  const service = softenAction(pick(bank.services, axes.service));
  const takeaway = readableCue(pick(bank.takeaways, axes.takeaway));
  const tone = readableCue(pick(bank.tones, axes.tone));
  const visualRecipe = buildVisualRecipe(topic, axes);
  const shortAudience = titleCue(audience, 10);
  const shortFocus = titleCue(focus, 10);
  const shortConcern = titleCue(concern, 10);
  const shortProof = titleCue(proof, 12);
  const shortScene = titleCue(scene, 10);
  const shortMaterial = titleCue(material, 10);
  const titleStarter = pick(titleStarters, axes.primary);
  const titleAngle = pick(titleAngles, axes.secondary);
  const titleCloser = pick(titleClosers, axes.tertiary);
  const promptContext = buildHumanPromptContext(
    topic,
    audience,
    focus,
    concern,
    proof,
    scene,
    material,
    service,
    takeaway,
    tone,
    visualRecipe
  );

  return {
    titles: buildNaturalTitles({
      topic,
      audienceCue: shortAudience,
      focusCue: shortFocus,
      concernCue: shortConcern,
      proofCue: shortProof,
      sceneCue: shortScene,
      materialCue: shortMaterial,
      starter: titleStarter,
      angle: titleAngle,
      closer: titleCloser
    }),
    body: buildNarrativeBody(promptContext, axes),
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
    draft.bridalKeywordProfileId === "phoneMirrorSelfieFitting" ||
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
  手机对镜自拍试纱:
    "a phone mirror selfie bridal fitting post, focused on handheld phone-camera records, full-length fitting-room mirror reflection, real body proportion, clear waistline, hemline, and honest non-retouched review value",
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

function englishCueFromChinese(value: string) {
  const cues: string[] = [];

  if (/手机|自拍|相册/.test(value)) cues.push("handheld phone-camera evidence");
  if (/对镜|镜前|镜子|反射/.test(value)) cues.push("full-length mirror reflection");
  if (/广角|滤镜|拉腿|失真/.test(value)) cues.push("normal lens perspective without beauty-filter distortion");
  if (/主纱|婚纱|白纱|礼服|裙子|裙身|上身|试穿|穿上/.test(value)) cues.push("worn garment fit evidence");
  if (/压身|压人|撑不起|体量|显胖|显高|身高/.test(value)) cues.push("skirt volume and body-scale relationship");
  if (/喜欢|确定|选择|判断|顾虑|犹豫|排除|适合/.test(value)) cues.push("clear visual decision evidence");
  if (/腰线|收腰|腰腹|比例/.test(value)) cues.push("clear waistline and real body proportion");
  if (/领口|肩颈|手臂|胸口/.test(value)) cues.push("visible neckline, shoulder, and arm line");
  if (/裙摆|拖尾|走动|视频/.test(value)) cues.push("skirt volume, train length, and natural walking evidence");
  if (/侧面|背影|正面|同角度/.test(value)) cues.push("same-angle front, side, and back comparison");
  if (/顾问|钉珠|调整|整理/.test(value)) cues.push("consultant adjustment and beading-tool evidence");
  if (/缎面|蕾丝|白纱|面料|材质|珠绣|刺绣/.test(value)) cues.push("accurate fabric texture and white-gown detail");
  if (/头纱|配饰|耳饰|手套/.test(value)) cues.push("veil and accessory relationship");
  if (/坐下|敬茶|转身/.test(value)) cues.push("sitting, turning, and ceremony-movement comfort");
  if (/隐私|屏幕|聊天|授权/.test(value)) cues.push("no readable phone screen or private information");
  if (/精修|店拍|漂亮|出片/.test(value)) cues.push("honest non-retouched review value");
  if (/放松|紧张|自然|舒服/.test(value)) cues.push("relaxed real-client posture");
  if (/场地|酒店|草坪|教堂|海边|登记|晚宴/.test(value)) cues.push("wedding-scene suitability");
  if (/通勤|咖啡|艺术馆|花店|城市|约会|周末|度假|衣橱/.test(value)) cues.push("wearable lifestyle context");

  return Array.from(new Set(cues)).slice(0, 4).join(", ") || "specific visual evidence from the generated post";
}

function buildEnglishVariantAlignment(context: CopyAlignmentContext) {
  return [
    `Variant-specific cues: focus on ${englishCueFromChinese(context.focus)}.`,
    `Resolve the viewer concern through ${englishCueFromChinese(context.concern)}.`,
    `Use visual proof such as ${englishCueFromChinese(context.proof)} in ${englishCueFromChinese(context.scene)}.`,
    `Emphasize detail cues including ${englishCueFromChinese(context.material)}.`,
    `Visual recipe: ${context.visualRecipe.camera}; ${context.visualRecipe.evidence}; ${context.visualRecipe.detail}.`
  ].join(" ");
}

function buildPromptAlignmentRequirement(draft: ImageDraft, context?: CopyAlignmentContext) {
  if (!context) return draft.extraRequirement;

  return [
    draft.extraRequirement,
    buildEnglishVariantAlignment(context),
    `Create it as part of ${englishVisualAlignmentByTopic[context.topic]}. Keep the result photographic and scene-based, not a text page, instruction sheet, UI screen, poster, or brochure layout. Do not render readable Chinese text, captions, labels, watermarks, or document-style blocks inside the image.`
  ].join(" ");
}

function buildImagePlan(
  baseParams: PromptParams,
  draft: ImageDraft,
  index: number,
  variantIndex: number,
  context?: CopyAlignmentContext
): FashionSeedingImagePlan {
  const params: PromptParams = {
    ...baseParams,
    imageType: draft.imageType,
    modelChoice: resolveImageModelChoice(baseParams, draft),
    scenePreference: resolveAlignedScenePreference(baseParams, draft, context),
    extraRequirement: buildPromptAlignmentRequirement(draft, context),
    generationNonce: baseParams.generationNonce + variantIndex * 10 + index + 1,
    bridalKeywordProfileId: draft.bridalKeywordProfileId
  };

  return {
    name: draft.name,
    purpose: draft.purpose,
    description: draft.description,
    params
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
    .map((draft, index) => buildImagePlan(input.baseParams, draft, index, variantIndex, copy.promptContext));

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
  return content.images
    .map(
      (image, index) =>
        `配图 ${index + 1}\n用途：${image.purpose}\n配图建议：${image.description}\n参数：${image.params.productCategory}｜${image.params.imageType}｜${image.params.scenePreference}｜${image.params.modelChoice}｜${image.params.lightPreference}`
    )
    .join("\n\n---\n\n");
}
