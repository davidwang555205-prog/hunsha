import type { ImageType, ProductCategory, PromptParams, ScenePreference } from "../types";
import { generatePrompt } from "./generatePrompt";

export type BridalFashionTopic =
  | "试纱体验"
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
};

type ImageDraft = {
  name: string;
  purpose: string;
  description: string;
  imageType: ImageType;
  scenePreference: ScenePreference;
  extraRequirement: string;
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
};

export const bridalFashionTopicOptions: BridalFashionTopic[] = [
  "试纱体验",
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
  const kit = topicCopyKits[topic];
  return kit.openings.length * kit.observations.length * kit.scenes.length * kit.closings.length;
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

function buildCopyFromKit(topic: FashionSeedingTopic, variantIndex: number): TopicCopyDraft {
  const kit = topicCopyKits[topic];
  const openingIndex = variantIndex % kit.openings.length;
  const observationIndex = Math.floor(variantIndex / kit.openings.length) % kit.observations.length;
  const sceneIndex = Math.floor(variantIndex / (kit.openings.length * kit.observations.length)) % kit.scenes.length;
  const closingIndex =
    Math.floor(variantIndex / (kit.openings.length * kit.observations.length * kit.scenes.length)) % kit.closings.length;

  return {
    titles: [
      pick(kit.titles, openingIndex),
      pick(kit.titles, observationIndex + sceneIndex + 1),
      pick(kit.titles, variantIndex + closingIndex + 2)
    ],
    body: [
      pick(kit.openings, openingIndex),
      pick(kit.observations, observationIndex),
      pick(kit.scenes, sceneIndex),
      pick(kit.closings, closingIndex)
    ].join("\n\n"),
    tags: kit.tags,
    note: kit.note
  };
}

const topicCopyKits: Record<FashionSeedingTopic, TopicCopyKit> = {
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

const bridalMainSceneByTopic: Record<BridalFashionTopic, ScenePreference> = {
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
  const mainScene = bridalMainSceneByTopic[topic];
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

function buildImagePlan(baseParams: PromptParams, draft: ImageDraft, index: number): FashionSeedingImagePlan {
  const params: PromptParams = {
    ...baseParams,
    imageType: draft.imageType,
    scenePreference: draft.scenePreference,
    extraRequirement: draft.extraRequirement,
    generationNonce: baseParams.generationNonce + index + 1
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
  const variantIndex = input.topic && input.topic !== daily.topic ? input.baseParams.generationNonce % variantCount : daily.variantIndex;
  const copy = buildCopyFromKit(safeTopic, variantIndex);
  const images = getImageDrafts(input.productCategory, safeTopic)
    .slice(0, imageCount)
    .map((draft, index) => buildImagePlan(input.baseParams, draft, index));

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
