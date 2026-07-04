import type { ImageType, ScenePreference } from "../types";
import type { BridalImageKeywordProfileId } from "./bridalImageKeywordProfiles";

export type XiaohongshuBridalTopic =
  | "真实客户试纱"
  | "试纱陪同视角"
  | "试纱避坑准备"
  | "婚纱品牌发布"
  | "婚纱店发布";

export type XiaohongshuBridalContentIntent =
  | "realCustomerFitting"
  | "companionView"
  | "fittingPrep"
  | "brandLaunch"
  | "storePublishing";

export type XiaohongshuTopicCopyKit = {
  titles: string[];
  openings: string[];
  observations: string[];
  scenes: string[];
  closings: string[];
  tags: string[];
  note: string;
};

export type XiaohongshuBridalImageBlueprint = {
  name: string;
  purpose: string;
  description: string;
  imageType: ImageType;
  scenePreference: ScenePreference;
  keywordProfileId: BridalImageKeywordProfileId;
  extraRequirement: string;
};

export type XiaohongshuBridalContentProfile = {
  topic: XiaohongshuBridalTopic;
  intent: XiaohongshuBridalContentIntent;
  sourcePattern: string;
  copyKit: XiaohongshuTopicCopyKit;
  imageBlueprints: XiaohongshuBridalImageBlueprint[];
};

export const xiaohongshuBridalTopicOptions: XiaohongshuBridalTopic[] = [
  "真实客户试纱",
  "试纱陪同视角",
  "试纱避坑准备",
  "婚纱品牌发布",
  "婚纱店发布"
];

export const xiaohongshuBridalContentProfiles: Record<XiaohongshuBridalTopic, XiaohongshuBridalContentProfile> = {
  真实客户试纱: {
    topic: "真实客户试纱",
    intent: "realCustomerFitting",
    sourcePattern: "真实顾客第一人称或店铺转述，重点是试纱过程、身体感受、顾虑被解决和最终选择。",
    copyKit: {
      titles: [
        "真实试纱，比一眼惊艳更重要",
        "试到合适的婚纱，身体会先放松",
        "不是最贵那件，是最像自己的那件",
        "她站到镜子前，突然安静下来了"
      ],
      openings: [
        "真实试纱里，很少有人一进门就知道自己适合什么。",
        "很多客人来之前会带着很明确的想法，真正穿上以后，答案常常会变得更具体。"
      ],
      observations: [
        "肩颈、腰线、手臂、裙摆重量和走路时的状态，都会比照片上的款式名更诚实。",
        "顾客真正放松的瞬间，通常不是被夸好看，而是发现这件婚纱没有让身体紧张。"
      ],
      scenes: [
        "内容可以保留试纱间镜子、顾问整理裙摆、客人低头看腰线这些真实细节。",
        "画面不需要拍成大片，轻微停顿、试穿夹和衣架反而让它更像真实试纱记录。"
      ],
      closings: [
        "试纱体验的重点不是催促成交，而是帮她确认自己在婚礼那天想成为什么样子。",
        "把真实顾虑拍出来，比单纯展示一件婚纱更容易被备婚用户收藏。"
      ],
      tags: ["#真实试纱", "#试纱体验", "#婚纱试穿", "#备婚日记", "#婚纱馆"],
      note: "真实客户试纱内容要有过程、犹豫和被解决的瞬间，避免写成顾客夸赞合集。"
    },
    imageBlueprints: [
      {
        name: "图1｜客照｜镜前完整试穿",
        purpose: "用真实顾客视角呈现完整上身状态。",
        description: "客人在试纱间镜前站定，顾问或朋友可在画面边缘，裙摆和腰线清楚。",
        imageType: "产品上身图",
        scenePreference: "试纱间",
        keywordProfileId: "realCustomerFitting",
        extraRequirement:
          "Use a real customer fitting moment in a bridal fitting room, full-length mirror, natural client posture, consultant nearby only if needed, clear waistline, neckline, skirt volume, and train."
      },
      {
        name: "图2｜过程｜顾问整理裙摆",
        purpose: "展示试纱服务和衣服结构被确认的过程。",
        description: "手部整理裙摆、试穿夹或腰线，不要像硬广摆拍。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "试纱间",
        keywordProfileId: "fittingServiceDetail",
        extraRequirement:
          "Show a bridal consultant gently adjusting the gown train, waistline, fitting clips, or veil. Hands must look natural and professional, not staged."
      },
      {
        name: "图3｜情绪｜低头看细节",
        purpose: "补充真实试纱时的犹豫和确认感。",
        description: "客人低头看腰线或裙摆，画面安静，有真实停顿。",
        imageType: "生活场景图",
        scenePreference: "试纱间",
        keywordProfileId: "realCustomerFitting",
        extraRequirement:
          "Capture a quiet customer fitting pause, looking down at waistline or skirt detail, emotionally natural, no commercial smile, real-camera fitting room mood."
      },
      {
        name: "图4｜细节｜面料近景",
        purpose: "让笔记有可保存的婚纱细节证据。",
        description: "蕾丝、缎面、珠绣、裙摆层次和试纱间软光。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "材质工作台",
        keywordProfileId: "bridalMaterialProof",
        extraRequirement:
          "Create a close material proof image with lace, satin, beadwork, embroidery, hemline layers, veil texture, and daylight that preserves white fabric detail."
      },
      {
        name: "图5｜环境｜试纱间留白",
        purpose: "补充婚纱店真实空间感。",
        description: "镜子、纱帘、衣架、婚纱架，有轻微使用痕迹但干净。",
        imageType: "非产品氛围图",
        scenePreference: "试纱间",
        keywordProfileId: "storePublishing",
        extraRequirement:
          "Show a calm bridal fitting room atmosphere with mirror, curtains, hanger, dress rack, appointment notes, and clean but lived-in boutique details."
      }
    ]
  },
  试纱陪同视角: {
    topic: "试纱陪同视角",
    intent: "companionView",
    sourcePattern: "朋友、妈妈或伴侣陪试视角，重点是旁观者看到的变化、细节确认和真实反应。",
    copyKit: {
      titles: [
        "陪她试纱，才知道哪件真的适合",
        "朋友视角里的命定婚纱",
        "妈妈说好看之前，她自己先笑了",
        "陪试纱的人，最能看见变化"
      ],
      openings: [
        "陪试纱的人，看到的往往不是款式有多华丽，而是她穿上以后有没有变得放松。",
        "朋友或妈妈的视角很真实，因为她们会注意到新娘自己没发现的小变化。"
      ],
      observations: [
        "有的婚纱会让人一直整理肩带，有的婚纱会让人自然站直。",
        "当旁边的人安静下来认真看，通常说明这件婚纱已经不只是好看。"
      ],
      scenes: [
        "画面可以有陪试的人坐在旁边、顾问整理裙摆、手机里保留试穿记录。",
        "不要把陪同者拍成抢镜角色，她们更像画面里的真实见证。"
      ],
      closings: [
        "陪试纱内容适合讲真实关系，不适合讲夸张见证。",
        "婚纱被选择的那一刻，常常是几个人一起确认的。"
      ],
      tags: ["#陪试纱", "#朋友视角", "#妈妈陪试纱", "#备婚记录", "#试纱日记"],
      note: "陪同视角要保留关系感和旁观细节，避免写成夸张剧情。"
    },
    imageBlueprints: [
      {
        name: "图1｜陪试｜朋友视角全身",
        purpose: "从陪同者视角看新娘完整状态。",
        description: "画面像朋友在试纱间顺手记录，完整婚纱结构要清楚。",
        imageType: "产品上身图",
        scenePreference: "试纱间",
        keywordProfileId: "companionFitting",
        extraRequirement:
          "Create a companion-view fitting room photo, as if taken by a close friend, full gown visible, companion presence subtle, real customer posture."
      },
      {
        name: "图2｜反应｜坐在旁边看",
        purpose: "强化真实陪同关系和反馈氛围。",
        description: "朋友或妈妈坐在试纱间边缘，看向镜前新娘，不喧宾夺主。",
        imageType: "生活场景图",
        scenePreference: "试纱间",
        keywordProfileId: "companionFitting",
        extraRequirement:
          "Show a subtle companion reaction in the fitting room, mother or close friend seated near the mirror, emotional but restrained, the bride remains the focus."
      },
      {
        name: "图3｜细节｜帮忙理头纱",
        purpose: "用手部动作表现陪伴感。",
        description: "陪同者或顾问轻轻整理头纱、肩线或裙摆。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "试纱间",
        keywordProfileId: "fittingServiceDetail",
        extraRequirement:
          "Show hands gently adjusting veil, shoulder line, or train, intimate companion fitting detail, natural hands, no stiff studio gesture."
      },
      {
        name: "图4｜记录｜手机里的试穿对比",
        purpose: "模拟真实试纱记录，不直接做广告。",
        description: "试纱间桌面、手机、预约单、面料细节和衣架。",
        imageType: "产品静物图",
        scenePreference: "材质工作台",
        keywordProfileId: "fittingPrep",
        extraRequirement:
          "Create a fitting record still life with phone preview, appointment card, fabric swatch, veil edge, hanger, and soft daylight, no readable private information."
      },
      {
        name: "图5｜环境｜候场区",
        purpose: "补充婚纱店空间和等待体验。",
        description: "沙发、镜子、衣架、柔光，干净但不空。",
        imageType: "非产品氛围图",
        scenePreference: "婚纱店橱窗",
        keywordProfileId: "storePublishing",
        extraRequirement:
          "Show bridal boutique waiting area, soft seating, mirror, dress rack, curtains, warm service mood, real boutique order, no luxury exaggeration."
      }
    ]
  },
  试纱避坑准备: {
    topic: "试纱避坑准备",
    intent: "fittingPrep",
    sourcePattern: "备婚用户收藏向指南，重点是试纱前准备、身体顾虑、预约流程和拍照记录方式。",
    copyKit: {
      titles: [
        "试纱前先想清楚这几件事",
        "第一次试纱，不用把自己准备得太完美",
        "试纱避坑不是挑毛病，是少走弯路",
        "带着问题去试纱，反而更容易选到"
      ],
      openings: [
        "第一次试纱前，很多人会担心自己不够瘦、不够白、不够会拍照。",
        "试纱准备不是为了把自己变成标准新娘，而是让选择更清楚。"
      ],
      observations: [
        "提前想好婚礼场地、预算、想遮住或想突出的位置，顾问会更容易帮你缩小范围。",
        "手机随手记录正面、侧面、走动和坐下，比只拍一张正面照更有参考价值。"
      ],
      scenes: [
        "配图适合出现预约单、试纱清单、不同头纱、胸贴或高跟鞋提示，但不要拍得像杂乱攻略。",
        "试纱间里可以保留试穿夹、衣架和镜子，让指南看起来来自真实经验。"
      ],
      closings: [
        "避坑内容的重点不是制造焦虑，而是让第一次试纱更有方向。",
        "好的婚纱店内容，应该帮用户在预约前就少一点紧张。"
      ],
      tags: ["#试纱攻略", "#试纱避坑", "#备婚攻略", "#第一次试纱", "#婚纱店预约"],
      note: "试纱准备类内容要收藏友好，但不能制造身材焦虑或强推转化。"
    },
    imageBlueprints: [
      {
        name: "图1｜攻略｜试纱前清单",
        purpose: "做收藏向封面，帮助用户理解试纱准备。",
        description: "预约卡、简单清单、面料小样、头纱和衣架，干净有秩序。",
        imageType: "产品静物图",
        scenePreference: "材质工作台",
        keywordProfileId: "fittingPrep",
        extraRequirement:
          "Create an organized bridal fitting preparation still life with appointment card, simple checklist, fabric swatches, veil, hanger, neutral pen, and clean daylight."
      },
      {
        name: "图2｜镜前｜正侧面对比",
        purpose: "强调试纱记录方式。",
        description: "试纱间镜前自然站姿，正面或侧面清楚，不要夸张拉腿。",
        imageType: "对镜穿搭图",
        scenePreference: "试纱间",
        keywordProfileId: "realCustomerFitting",
        extraRequirement:
          "Show a practical mirror fitting record angle, front or side view, natural customer stance, clear shoulder, waist, hip, hemline, and train proportion."
      },
      {
        name: "图3｜服务｜顾问说明版型",
        purpose: "展示店铺专业但不压迫的服务感。",
        description: "顾问轻指领口、腰线或裙摆，像在解释选择逻辑。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "试纱间",
        keywordProfileId: "fittingServiceDetail",
        extraRequirement:
          "Show a consultant explaining neckline, waistline, or skirt volume with a gentle hand gesture, no hard selling, professional fitting service mood."
      },
      {
        name: "图4｜细节｜不同头纱和配件",
        purpose: "辅助说明搭配准备。",
        description: "头纱、手套、耳饰、面料卡和小束花，低饱和。",
        imageType: "产品静物图",
        scenePreference: "材质工作台",
        keywordProfileId: "bridalMaterialProof",
        extraRequirement:
          "Create a bridal accessory preparation still life with veil options, gloves, pearl earrings, lace, satin swatches, small bouquet, and low-saturation styling."
      },
      {
        name: "图5｜环境｜预约试纱空间",
        purpose: "让攻略关联到真实婚纱店体验。",
        description: "试纱间入口、衣架、镜子和干净等待区。",
        imageType: "非产品氛围图",
        scenePreference: "婚纱店橱窗",
        keywordProfileId: "storePublishing",
        extraRequirement:
          "Show a calm bridal appointment environment, fitting room entrance, mirror, dress rack, clean waiting corner, appointment-ready but not staged."
      }
    ]
  },
  婚纱品牌发布: {
    topic: "婚纱品牌发布",
    intent: "brandLaunch",
    sourcePattern: "品牌新品或系列发布，重点是款式逻辑、版型、面料、适合场景和品牌审美，不喊空泛高级。",
    copyKit: {
      titles: [
        "新品婚纱发布，先看版型再看名字",
        "一件主纱的重点，不止是第一眼",
        "这组婚纱，想留住的是多年后也耐看的状态",
        "把婚纱发布拍得克制一点"
      ],
      openings: [
        "婚纱新品发布不一定要用很满的词。",
        "真正需要被讲清楚的，是这件婚纱为什么适合某一种新娘和某一种婚礼。"
      ],
      observations: [
        "领口、腰线、裙摆体量、拖尾长度和面料光泽，决定了它适合酒店、草坪还是登记场景。",
        "品牌内容要把设计细节讲清楚，但不要把每一件都说成命定款。"
      ],
      scenes: [
        "配图可以有完整上身、面料近景、挂装静物和系列 mood board。",
        "如果是系列发布，最好让每张图服务不同信息，而不是重复拍同一张美图。"
      ],
      closings: [
        "婚纱品牌发布的价值，是帮用户看懂选择，而不是只让用户觉得漂亮。",
        "克制的发布内容，反而更容易显得专业。"
      ],
      tags: ["#婚纱新品", "#婚纱品牌", "#婚纱设计", "#主纱推荐", "#婚纱细节"],
      note: "品牌发布类内容要讲清款式逻辑、适配场景和材料细节，避免广告口号。"
    },
    imageBlueprints: [
      {
        name: "图1｜发布｜新品完整上身",
        purpose: "作为新品发布主图，展示婚纱完整结构。",
        description: "模特上身清楚，像品牌 lookbook 但不过度大片。",
        imageType: "产品上身图",
        scenePreference: "婚纱店橱窗",
        keywordProfileId: "brandLaunch",
        extraRequirement:
          "Create a refined bridal brand launch image, full gown visible, lookbook clarity, accurate silhouette, neckline, waistline, train, and fabric, no runway exaggeration."
      },
      {
        name: "图2｜结构｜版型说明",
        purpose: "用画面辅助讲版型和适合人群。",
        description: "侧身或轻微转身，裙摆体量、腰线和拖尾清楚。",
        imageType: "生活场景图",
        scenePreference: "婚纱店橱窗",
        keywordProfileId: "brandLaunch",
        extraRequirement:
          "Show the gown structure from a slight side or three-quarter angle, clear skirt volume, waistline, train length, sleeve length, and premium but restrained brand mood."
      },
      {
        name: "图3｜材料｜面料证据",
        purpose: "展示缎面、蕾丝、珠绣或刺绣真实质感。",
        description: "近景清楚，不要塑料光泽或假蕾丝。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "材质工作台",
        keywordProfileId: "bridalMaterialProof",
        extraRequirement:
          "Create material proof close-up for bridal brand launch: satin, lace, embroidery, beadwork, drape, seam detail, and white fabric texture preserved."
      },
      {
        name: "图4｜系列｜mood board",
        purpose: "给品牌发布补充系列审美方向。",
        description: "色卡、面料小样、草图、头纱、衣架和干净留白。",
        imageType: "非产品氛围图",
        scenePreference: "材质工作台",
        keywordProfileId: "brandLaunch",
        extraRequirement:
          "Show a bridal collection mood board with fabric swatches, sketch notes, veil, hanger, refined color cards, and clean negative space."
      },
      {
        name: "图5｜静物｜挂装发布",
        purpose: "用静物图做详情页或小红书组图收尾。",
        description: "婚纱挂装、衣架、头纱和局部裙摆，品牌感克制。",
        imageType: "产品静物图",
        scenePreference: "婚纱店橱窗",
        keywordProfileId: "brandLaunch",
        extraRequirement:
          "Create a premium bridal gown still life on hanger or dress rack, visible train and fabric layers, boutique daylight, editorial but not over-staged."
      }
    ]
  },
  婚纱店发布: {
    topic: "婚纱店发布",
    intent: "storePublishing",
    sourcePattern: "婚纱店日常运营内容，重点是预约体验、店内环境、顾问服务、真实客照和可被信任的细节。",
    copyKit: {
      titles: [
        "婚纱店内容，不只拍漂亮裙子",
        "一次试纱体验，从进店那刻开始",
        "让备婚女孩放心的，是这些小细节",
        "婚纱馆日常，也可以拍得很真实"
      ],
      openings: [
        "婚纱店发布内容，不应该只是一排漂亮婚纱。",
        "备婚用户真正想知道的，是进店以后会不会被理解、会不会被催、会不会试得很累。"
      ],
      observations: [
        "预约、试纱间、顾问沟通、头纱搭配、客照授权和试穿记录，都是可以被拍成内容的信任点。",
        "店铺内容越真实，越要控制画面秩序，不能因为真实就显得杂乱。"
      ],
      scenes: [
        "适合拍试纱间、橱窗、衣架、顾问整理、客人看镜子和材质工作台。",
        "每张图要说明一个体验节点，不要只堆空间美图。"
      ],
      closings: [
        "婚纱店内容的目标，是让用户预约前就知道自己会被怎样对待。",
        "真实、干净、有服务感，比单纯豪华更有转化价值。"
      ],
      tags: ["#婚纱店", "#婚纱馆", "#试纱预约", "#婚纱店日常", "#备婚探店"],
      note: "婚纱店发布要建立信任和预约理由，不要写成低价促销或空间炫耀。"
    },
    imageBlueprints: [
      {
        name: "图1｜门店｜试纱间主视觉",
        purpose: "展示婚纱店空间和预约氛围。",
        description: "镜子、纱帘、衣架和一件主纱，干净但有真实服务感。",
        imageType: "非产品氛围图",
        scenePreference: "试纱间",
        keywordProfileId: "storePublishing",
        extraRequirement:
          "Create a bridal boutique publishing image showing fitting room, mirror, curtain, dress rack, one main gown, appointment-ready calm service mood."
      },
      {
        name: "图2｜服务｜顾问陪选",
        purpose: "展示顾问服务，不硬销售。",
        description: "顾问和客人一起看镜子或衣架，动作自然。",
        imageType: "生活场景图",
        scenePreference: "试纱间",
        keywordProfileId: "fittingServiceDetail",
        extraRequirement:
          "Show a bridal consultant helping a customer compare gown options near mirror or dress rack, respectful distance, no hard selling, real boutique service."
      },
      {
        name: "图3｜客照｜真实试穿瞬间",
        purpose: "建立真实客照可信度。",
        description: "客人上身婚纱，表情自然，试纱间光线干净。",
        imageType: "产品上身图",
        scenePreference: "试纱间",
        keywordProfileId: "realCustomerFitting",
        extraRequirement:
          "Create a real customer trial fitting image in boutique room, natural expression, clear gown details, no influencer pose, no commercial retouching."
      },
      {
        name: "图4｜细节｜头纱与配件区",
        purpose: "补充店内专业搭配能力。",
        description: "头纱、耳饰、手套、面料卡和预约单。",
        imageType: "产品静物图",
        scenePreference: "材质工作台",
        keywordProfileId: "bridalMaterialProof",
        extraRequirement:
          "Show boutique accessory station with veil, earrings, gloves, lace, satin swatches, appointment card, and organized styling detail."
      },
      {
        name: "图5｜橱窗｜预约前第一印象",
        purpose: "作为探店或门店发布收尾。",
        description: "婚纱店橱窗、礼服展示和柔和街面反光。",
        imageType: "非产品氛围图",
        scenePreference: "婚纱店橱窗",
        keywordProfileId: "storePublishing",
        extraRequirement:
          "Create a bridal boutique window impression, gown display, soft street reflection, quiet premium storefront, inviting but not flashy."
      }
    ]
  }
};

export const xiaohongshuBridalTopicCopyKits = Object.fromEntries(
  Object.entries(xiaohongshuBridalContentProfiles).map(([topic, profile]) => [topic, profile.copyKit])
) as Record<XiaohongshuBridalTopic, XiaohongshuTopicCopyKit>;

export function getXiaohongshuBridalContentProfile(topic: XiaohongshuBridalTopic) {
  return xiaohongshuBridalContentProfiles[topic];
}
