import type { ImageType, ScenePreference } from "../types";
import type { BridalImageKeywordProfileId } from "./bridalImageKeywordProfiles";

export type XiaohongshuBridalTopic =
  | "真实客户试纱"
  | "手机对镜自拍试纱"
  | "试纱陪同视角"
  | "试纱避坑准备"
  | "婚纱品牌发布"
  | "婚纱店发布";

export type XiaohongshuBridalContentIntent =
  | "realCustomerFitting"
  | "phoneMirrorSelfieFitting"
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

export type XiaohongshuCopyDraft = {
  titles: string[];
  paragraphs: string[];
  tags?: string[];
  note?: string;
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
  "手机对镜自拍试纱",
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
        "画面不需要拍成大片，轻微停顿、钉珠道具和衣架反而让它更像真实试纱记录。"
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
        description: "手部整理裙摆、用钉珠道具调整腰线，不要像硬广摆拍。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "试纱间",
        keywordProfileId: "fittingServiceDetail",
        extraRequirement:
          "Show a bridal consultant gently adjusting the gown train, waistline, beading adjustment tools, or veil. Hands must look natural and professional, not staged."
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
  手机对镜自拍试纱: {
    topic: "手机对镜自拍试纱",
    intent: "phoneMirrorSelfieFitting",
    sourcePattern: "真实顾客用手机对着试纱间镜子自拍，重点是手机镜头里的比例、腰线、裙摆、自然站姿和非精修记录感。",
    copyKit: {
      titles: [
        "手机对镜自拍，比精修更能看出试纱状态",
        "试纱间自拍，先看真实比例",
        "别只看店拍照，手机镜子里更诚实",
        "这组试纱自拍，适合回家慢慢复盘"
      ],
      openings: [
        "试纱时手机对镜自拍不一定要拍得很好看，重点是留下真实比例。",
        "店里拍的照片很重要，但自己手机里的镜前记录，常常更适合回家复盘。"
      ],
      observations: [
        "手机不要挡住领口和腰线，正面、侧面、背影和走动都比单张精修更有参考。",
        "自然站姿、手臂拿手机的位置、裙摆有没有跟着身体走，都会影响最后判断。"
      ],
      scenes: [
        "配图要有试纱间全身镜、手持手机、真实客户站姿、裙摆和腰线清楚这些细节。",
        "画面可以有一点试纱间的真实使用感，但不能乱，也不要拍成网红打卡自拍。"
      ],
      closings: [
        "手机对镜自拍的价值不是出片，而是帮新娘回家看清自己当时的身体状态。",
        "这类内容适合做真实试纱记录，不要写成滤镜自拍教程。"
      ],
      tags: ["#手机对镜自拍", "#试纱自拍", "#真实试纱", "#婚纱试穿", "#备婚日记"],
      note: "手机对镜自拍试纱要强调真实比例、非精修记录和回家复盘价值，避免网红自拍和滤镜感。"
    },
    imageBlueprints: [
      {
        name: "图1｜自拍｜手机镜前全身",
        purpose: "作为主题主图，呈现真实手机对镜试纱全身比例。",
        description: "客人手持手机对着试纱间全身镜自拍，手机可见但不要挡住领口、腰线和裙摆。",
        imageType: "对镜穿搭图",
        scenePreference: "试纱间",
        keywordProfileId: "phoneMirrorSelfieFitting",
        extraRequirement:
          "Create a handheld phone mirror selfie in a bridal fitting room, full-length mirror reflection, phone visible in hand, real fitting client, clear gown neckline, waistline, hemline, train, and natural posture. The phone must not block key dress structure."
      },
      {
        name: "图2｜侧身｜手机自拍侧面比例",
        purpose: "补充侧面比例和裙摆体量，避免只看正面。",
        description: "手机镜前侧身或三分之二角度，腰线、臀胯、裙摆体量和拖尾清楚。",
        imageType: "对镜穿搭图",
        scenePreference: "试纱间",
        keywordProfileId: "phoneMirrorSelfieFitting",
        extraRequirement:
          "Show a phone mirror selfie from a side or three-quarter angle in the fitting room, honest phone-camera perspective, clear waistline, hip line, skirt volume, hemline, and train movement, no leg stretching."
      },
      {
        name: "图3｜细节｜手机近拍腰线",
        purpose: "用手机记录腰线、面料和钉珠道具，说明真实试纱调整。",
        description: "手机视角近拍腰线、钉珠道具、缎面或蕾丝细节，有真实调整痕迹。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "试纱间",
        keywordProfileId: "phoneMirrorSelfieFitting",
        extraRequirement:
          "Create a phone-camera close detail from a bridal fitting, waistline, beading adjustment tools, fabric texture, satin or lace detail, natural hand-held framing, no readable text, no polished campaign retouching."
      },
      {
        name: "图4｜过程｜自拍前顾问整理",
        purpose: "展示自拍记录前的真实试纱服务过程。",
        description: "顾问整理裙摆、用钉珠道具调整腰线或调整头纱，客人手里可拿手机但不抢画面。",
        imageType: "拍摄花絮 / 材质图",
        scenePreference: "试纱间",
        keywordProfileId: "fittingServiceDetail",
        extraRequirement:
          "Show the moment before a phone mirror selfie, bridal consultant adjusting train, waistline, beading adjustment tools, or veil, the client may hold a phone naturally, real appointment process, no hard-selling pose."
      },
      {
        name: "图5｜复盘｜手机相册试纱记录",
        purpose: "说明手机自拍用于回家复盘和对比，不露隐私。",
        description: "桌面上手机相册预览、预约卡、面料小样和发饰，屏幕不能有可读隐私。",
        imageType: "产品静物图",
        scenePreference: "材质工作台",
        keywordProfileId: "fittingPrep",
        extraRequirement:
          "Create a fitting review still life with a phone showing non-readable mirror selfie thumbnails, appointment card, fabric swatches, hair accessory, veil edge, and soft daylight. No readable personal information or chat content."
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
        "试纱间里可以保留钉珠道具、衣架和镜子，让指南看起来来自真实经验。"
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

export const xiaohongshuBridalCopyDrafts: Record<XiaohongshuBridalTopic, XiaohongshuCopyDraft[]> = {
  真实客户试纱: [
    {
      titles: ["第一次试纱，我没有选截图里那件", "试纱真的要上身才知道", "这件不是最夸张，但我最放松"],
      paragraphs: [
        "来之前我手机里存的几乎都是大拖尾和重工蕾丝，结果第一件穿上就发现自己一直在看肩膀和腰线。",
        "顾问没有急着夸好看，先用钉珠道具把腰后的余量重新调整了一点，又让我正常走两步。那一下挺明显，裙摆没有拖着我走，手臂也不用一直藏起来。",
        "朋友帮我拍了一段十秒视频，比正面照片有用。走路、转身、坐下的时候都自然，才是真的适合。",
        "最后留下的这件不是最贵，也不是最像网图的那件。是我站在镜子前不用再问大家会不会显胖的那件。"
      ],
      note: "真实客户第一人称，保留犹豫、试穿细节和选择理由。"
    },
    {
      titles: ["试纱时最打动我的不是被夸", "穿上以后不紧张，才是真的合适", "我在镜子前突然安静了一下"],
      paragraphs: [
        "我原本以为试纱会很快，喜欢哪件就定哪件。真的进试纱间才知道，照片里的喜欢和身体里的舒服不是一回事。",
        "有一件腰线很好看，但我每隔几秒就想拉一下胸口。另一件没那么抓眼，可我站直、低头、侧身都不用调整自己。",
        "顾问让我不要只看一张正面照，正面、侧面、背影和走路都拍一下。回看视频的时候，我自己也能看出哪件让我更像自己。",
        "试纱不一定要选最惊艳的瞬间。婚礼那天要穿很久，能让身体放松的婚纱，反而更容易被记住。"
      ],
      note: "弱化销售感，用身体感受和视频复盘解释选择。"
    },
    {
      titles: ["小个子试纱记录：别只盯着裙摆大不大", "我以为我撑不起主纱", "试完才知道比例比风格更重要"],
      paragraphs: [
        "我身高不算高，来之前一直担心主纱会压人，所以截图都偏轻婚纱。",
        "真正试下来，关键不是裙摆大不大，而是腰线落在哪里、肩颈有没有被吃掉、拖尾从哪个位置开始展开。",
        "有一件正面看很仙，侧面却显得人被裙子推着走。后来换成腰线更干净的一件，裙摆还是有存在感，但整个人轻了很多。",
        "如果你也担心撑不起来，可以试的时候让朋友拍走动视频。静态照片会骗人，走起来的比例更诚实。"
      ],
      tags: ["#真实试纱", "#小个子试纱", "#主纱试穿", "#备婚日记", "#婚纱馆"],
      note: "用具体身材顾虑和试纱验证方式提高真实感。"
    },
    {
      titles: ["试纱那天，我最在意的是手臂", "别急着否定自己的身材", "婚纱合不合适，细节会告诉你"],
      paragraphs: [
        "预约前我一直说不想露手臂，进店后也先排除了好几件抹胸。",
        "顾问没有直接说你穿抹胸好看，而是先让我试一件带一点弧度的领口。肩线被打开以后，手臂反而没有我想象中明显。",
        "这件婚纱让我放心的地方不是把哪里遮住了，而是整体线条顺了。腰线、头纱长度和裙摆重量都在帮我，而不是让我一直修饰自己。",
        "试纱时可以把真实顾虑讲出来。好的试纱不是说服你接受缺点，是帮你找到不用紧绷也好看的状态。"
      ],
      note: "强调顾虑被解决，不制造身材焦虑。"
    },
    {
      titles: ["客照试纱记录，最该拍这几个瞬间", "别只拍一张正面照就做决定", "试纱照片要能帮你回忆当时的感觉"],
      paragraphs: [
        "今天这组试纱记录里，我最喜欢的不是封面那张，是顾问整理裙摆时我低头看的那一张。",
        "正面照当然要拍，但真的有参考价值的是侧面、背影、坐下、走两步，还有朋友在旁边随手拍到的表情。",
        "婚纱店如果只给你拍很端着的成片，回家反而难判断。真实一点的过程照，会把腰线、裙摆重量和你当时放不放松都留下来。",
        "选婚纱不是在选一张图，是在选婚礼那天几个小时里的自己。"
      ],
      note: "从店铺转述角度写真实客照，适合配图方案。"
    }
  ],
  手机对镜自拍试纱: [
    {
      titles: ["试纱时，我一定会留手机对镜自拍", "手机镜子里的比例，比精修更诚实", "别只等店里发图，自己也要拍一组"],
      paragraphs: [
        "试纱间灯光和店拍角度都很好看，但我现在一定会用自己手机对着镜子再拍一组。",
        "不是为了发朋友圈，是为了回家看真实比例。手机不要挡住领口和腰线，正面、侧面、背影都尽量同一个角度。",
        "有些婚纱在店拍里很仙，手机镜子里却能看出裙摆是不是压人、腰线有没有托住、手臂是不是一直紧着。",
        "最后做决定时，我反而会先看这些不精修的自拍。它们没那么漂亮，但很诚实。"
      ],
      note: "第一人称真实试纱自拍记录，强调回家复盘价值。"
    },
    {
      titles: ["对镜自拍别只拍好看，要拍能判断的", "试纱自拍这样留，回家不容易乱", "手机试纱记录，比想象中有用"],
      paragraphs: [
        "第一次试纱很容易被当下氛围带走，顾问夸、朋友夸、灯光也好看，脑子会有点热。",
        "我会让自己用手机对镜拍一张自然站姿，再拍一张侧身，最后拍十秒走动。不要刻意凹腿，也不要开太重滤镜。",
        "回家看的时候，重点不是哪张最出片，而是肩颈有没有放松、腰线有没有顺、裙摆走起来会不会拖着人。",
        "手机自拍不是替代店拍，是给自己多一个冷静判断的证据。"
      ],
      tags: ["#手机对镜自拍", "#试纱自拍", "#试纱记录", "#真实试纱", "#备婚攻略"],
      note: "攻略型自拍记录，提醒不要滤镜和拉腿。"
    },
    {
      titles: ["试纱手机自拍，真的别开广角拉腿", "镜子里的你自然吗，比显高更重要", "这组自拍让我排除了一件婚纱"],
      paragraphs: [
        "我之前拍试纱自拍会下意识找显高角度，后来发现这样反而会骗自己。",
        "婚礼当天没有广角，也不会一直站在最显瘦的位置。手机对镜要尽量保持正常视角，脚不要贴到画面边缘，手机也别挡住胸口和腰线。",
        "有一件婚纱正面自拍很好看，但侧身一拍发现拖尾太重，整个人都被裙子往后拉。",
        "所以试纱自拍不是为了证明自己好看，是为了确认这件婚纱在真实身体上能不能成立。"
      ],
      note: "具体讲手机镜头误差和排除理由，增强真实平台感。"
    },
    {
      titles: ["店拍很美，但手机自拍帮我冷静下来", "试纱当天最该保存的不是精修", "手机里那张不完美的试纱照，反而最有用"],
      paragraphs: [
        "店里拍的那张我很喜欢，光线、裙摆、表情都刚刚好。",
        "但真正让我冷静的是自己手机里那张对镜自拍。没有精修，也没有特别找角度，能看到我站着是不是松、手臂是不是一直想藏、裙摆有没有压住腿。",
        "顾问后来用钉珠道具帮我把腰线余量重新调整了一下，我又用同一个位置拍了一张，前后变化比口头解释清楚很多。",
        "如果你试纱时很容易上头，建议每件都留一张同角度手机自拍。回家看，会清醒很多。"
      ],
      note: "强调同角度前后对比和顾问调整后的可验证变化。"
    },
    {
      titles: ["手机对镜自拍，是给自己看的试纱证据", "试纱记录不用完美，但要真实", "我现在会这样拍试纱自拍"],
      paragraphs: [
        "试纱自拍不用追求特别漂亮，越像平时自己会拍的样子，越有参考。",
        "我会先拍完整全身，再近一点拍腰线和领口，最后补一段自然走路。手机屏幕和聊天内容不要露出来，试纱间也尽量保持干净。",
        "如果一件婚纱只有精修图好看，手机镜子里怎么都不放松，那我会先放一放。",
        "真正适合的婚纱，不需要每个角度都完美，但至少在最普通的手机镜头里，也不会让你一直紧张。"
      ],
      note: "给出自拍流程，同时提醒隐私和真实感。"
    }
  ],
  试纱陪同视角: [
    {
      titles: ["陪闺蜜试纱，我最先看到的是她放松了", "朋友视角里的命定款没有那么戏剧化", "她没问我们意见的时候，我知道差不多了"],
      paragraphs: [
        "陪她试了六件，前面几件她都会一出来就问我们：这个显不显胯、手臂会不会粗、背后是不是怪。",
        "到这件的时候不一样。她先在镜子前站了一会儿，自己低头看腰线，又转过去看拖尾，过了好几秒才回头问我们。",
        "其实旁边的人很容易看出来，哪件婚纱是在让她用力配合，哪件是在让她自然站直。",
        "陪试纱不用一直给答案。有时候安静看她自己确认，比一句立刻好看更重要。"
      ],
      note: "朋友陪试第一视角，减少夸张情绪。"
    },
    {
      titles: ["妈妈陪试纱时，反应比评价更真实", "她说好看之前，先帮我理了头纱", "陪试的人看到的是细节"],
      paragraphs: [
        "妈妈不是很会说漂亮话，前几件她都只说还可以。",
        "换到这件的时候，她先站起来帮我把头纱边缘理顺，又绕到后面看拖尾有没有压住。那一刻我反而觉得比夸我好看更真实。",
        "长辈陪试纱看的东西会很实际：走路会不会绊、坐下会不会紧、仪式上背影够不够完整。",
        "这类陪同视角适合拍得轻一点。不要演感动，真实关系自己会出来。"
      ],
      tags: ["#妈妈陪试纱", "#陪试纱", "#试纱日记", "#备婚记录", "#婚纱试穿"],
      note: "母女陪试视角，重点是动作和实际判断。"
    },
    {
      titles: ["陪试纱的人，别只会说都好看", "我会帮她拍这四个角度", "朋友试纱，我负责说实话"],
      paragraphs: [
        "陪朋友试纱，我一般不会只拍正面。正面很容易好看，真正容易出问题的是侧面、坐下、走动和背影。",
        "有一件拍照很仙，但她一走就开始拎裙摆。另一件第一眼没那么抓人，可她走路和转身都很松。",
        "我会把每件都拍同样的角度，回家对比才公平。不要在试纱间被灯光和情绪带着立刻做决定。",
        "陪试的人最有用的不是夸，是帮她记住真实状态。"
      ],
      note: "给陪试者可执行建议，像收藏型小红书笔记。"
    },
    {
      titles: ["伴侣陪试纱，不一定要安排第一次回头", "他在旁边认真看细节，也挺真实", "试纱陪同可以很安静"],
      paragraphs: [
        "不是每对新人都适合很戏剧化的 first look。有些陪试就是一起看裙摆、看行动方不方便、看婚礼场地适不适合。",
        "今天这位客人的伴侣没有一直拍照，也没有夸张反应，只是在顾问讲腰线和拖尾的时候认真听。",
        "后来他提醒她：这件你刚刚一直在笑，前面几件你都在问哪里要遮。这个反馈很有用。",
        "陪同视角如果拍成日常一点，会比硬制造感动更像真实备婚。"
      ],
      tags: ["#伴侣陪试纱", "#陪试纱", "#备婚日常", "#婚纱试穿", "#真实试纱"],
      note: "伴侣陪试视角，避免剧本化。"
    },
    {
      titles: ["陪她试纱后，我懂了为什么要带朋友", "有些变化自己在镜子里看不到", "朋友视角能补上试纱盲区"],
      paragraphs: [
        "她自己一直盯着腰和手臂，我在旁边看到的是她肩颈终于打开了。",
        "试纱很容易陷在局部里，越看越纠结。朋友在旁边可以帮你看整体，看你有没有一直整理衣服，看你走出来的时候是不是自然。",
        "我建议每件都拍一段不美化的视频，别只拍精修感照片。婚礼当天没有暂停键，舒服和自然很重要。",
        "如果你要陪朋友试纱，记得少一点审判，多一点记录。"
      ],
      note: "强调陪同者的观察价值，口吻更接近真实分享。"
    }
  ],
  试纱避坑准备: [
    {
      titles: ["第一次试纱前，先准备这几件事", "试纱攻略不是让你更焦虑", "带着问题去试纱，会轻松很多"],
      paragraphs: [
        "第一次试纱不用把自己准备得很完美，但最好带着几个问题去。",
        "1. 婚礼场地大概是什么感觉。酒店、草坪、教堂、户外，对裙摆和拖尾要求完全不一样。",
        "2. 你最在意身体的哪里。不是为了放大焦虑，是让顾问不要在不适合的方向浪费时间。",
        "3. 每件都拍正面、侧面、背影和走动视频。试纱间当下很容易上头，回家看视频会冷静很多。",
        "试纱避坑不是挑毛病，是帮你少走几圈弯路。"
      ],
      note: "清单型攻略，语气不制造焦虑。"
    },
    {
      titles: ["试纱当天别只带漂亮内衣", "这些小东西真的会影响判断", "试纱准备清单，给第一次去的人"],
      paragraphs: [
        "胸贴、无痕内裤、接近婚礼高度的鞋、发饰，这些听起来很小，但会影响你看比例。",
        "如果平时不常穿高跟，不要为了试纱硬穿特别高。婚礼当天能不能走路，比镜子里多高几厘米更重要。",
        "妆发不用做全套，但头发最好能简单收一下。很多婚纱看肩颈和领口，头发散着容易误判。",
        "还有一个很重要：提前吃点东西。试纱会累，饿着很容易把疲惫误会成不喜欢。"
      ],
      tags: ["#试纱攻略", "#第一次试纱", "#试纱准备", "#备婚攻略", "#婚纱店预约"],
      note: "实际准备物品和身体状态，适合收藏。"
    },
    {
      titles: ["试纱不要一次约太多家", "越试越乱，通常是因为没有记录", "我建议试纱这样安排"],
      paragraphs: [
        "一天约三四家听起来效率很高，真的跑下来很容易只剩累。",
        "每家试完先把喜欢和不喜欢写两句，不要只靠照片。比如：腰线好但拖尾重、领口喜欢但坐下紧、面料好但不适合草坪。",
        "最好每件保留同样角度的照片和视频，这样回家对比才不是看哪家灯光更好。",
        "试纱不是体力赛。状态清楚的时候做决定，通常比最后累到随便选更稳。"
      ],
      note: "预约节奏和记录方法，解决内容实用性。"
    },
    {
      titles: ["试纱前先别急着减肥", "婚纱不是标准答案", "把真实顾虑说出来，比硬撑更有用"],
      paragraphs: [
        "很多人预约前第一句话是：我是不是应该再瘦一点来试。",
        "其实试纱的意义不是等你变成某个标准再开始，而是先看版型怎么帮你。肩线、腰线、裙摆重量和头纱比例，都能改变整体状态。",
        "你可以直接告诉顾问自己在意手臂、胯、背、脖子短，或者不想太甜。说清楚以后，试的方向会准很多。",
        "好的婚纱不是让你一直收腹站着，而是让你不用那么紧张。"
      ],
      note: "反焦虑试纱准备，符合真实备婚用户痛点。"
    },
    {
      titles: ["试纱时这几句话可以直接问", "别怕问细节，婚礼当天真的会用到", "试纱不只是看好不好看"],
      paragraphs: [
        "试到喜欢的婚纱，可以直接问这些问题。",
        "这件能不能坐下方便敬茶？拖尾适合我的场地吗？如果仪式和晚宴都穿，会不会太累？头纱长度怎么配？有没有需要改的地方？",
        "还有一个别忘了问：试纱照片能不能回去慢慢看，客照发布会不会提前确认授权。",
        "真正靠谱的试纱体验，不会怕你问细节。问得越清楚，后面越不容易后悔。"
      ],
      note: "问题清单型，兼顾用户和婚纱店服务专业度。"
    }
  ],
  婚纱品牌发布: [
    {
      titles: ["新品婚纱发布：这次先讲版型", "这件主纱的重点不在夸张", "比起命定款，我们更想讲清楚它适合谁"],
      paragraphs: [
        "这次新品没有做很夸张的第一眼效果，重点放在腰线、肩颈和拖尾比例上。",
        "上身以后能看到它不是靠大裙摆撑气场，而是靠干净的线条把人托起来。适合想要主纱存在感，但不想被婚纱盖住的新娘。",
        "面料用了偏柔的光泽，近看能保留纹理，不是照片里一片亮白。拍摄时也尽量保留侧面和背影，方便判断真实体量。",
        "发布新品不是把每一件都说成命定。把适合的场地、身型顾虑和细节讲清楚，才对备婚的人有帮助。"
      ],
      note: "品牌发布但不口号化，讲清版型和适配人群。"
    },
    {
      titles: ["这条缎面主纱，想做得安静一点", "极简婚纱最怕只剩一个白色轮廓", "新品发布，先看光落在面料上的样子"],
      paragraphs: [
        "极简缎面如果只拍远景，很容易看起来都差不多。所以这组图会保留近景，能看到面料垂坠和腰部转折。",
        "领口没有做得很抢，目的是让肩颈干净，搭配头纱以后也不会堆在一起。",
        "它更适合酒店仪式、室内证婚或者偏克制的婚礼现场。草坪当然也可以，但最好不要搭太复杂的花艺。",
        "我们希望这件婚纱第一眼是干净，多看几次还能看见结构。"
      ],
      tags: ["#婚纱新品", "#极简婚纱", "#缎面婚纱", "#主纱推荐", "#婚纱品牌"],
      note: "品牌新品说明，保留审美但给出具体搭配判断。"
    },
    {
      titles: ["新系列里，这件蕾丝没有做满", "法式婚纱的轻，是留出来的", "蕾丝新品发布，近看比远看更重要"],
      paragraphs: [
        "这件没有把蕾丝堆得很满，领口、袖口和裙身之间留了呼吸感。",
        "我们想要的是温柔，但不是甜腻。所以上身图会拍完整比例，细节图会拍花纹密度和透感，避免只靠滤镜制造氛围。",
        "适合教堂、花园、小型仪式，也适合不想太隆重但希望有婚礼感的新娘。",
        "如果你选蕾丝婚纱，建议一定看近景。好的蕾丝不是远看热闹，而是近看也不粗糙。"
      ],
      tags: ["#婚纱新品", "#法式婚纱", "#蕾丝婚纱", "#婚纱细节", "#备婚灵感"],
      note: "新品发布加入面料判断，减少空泛高级感。"
    },
    {
      titles: ["这组婚纱不是给同一种新娘的", "系列发布要让选择变清楚", "新品组图应该每张都有信息"],
      paragraphs: [
        "这次系列里，我们没有把所有裙子拍成同一种情绪。",
        "第一件偏仪式主纱，看裙摆体量；第二件偏轻婚纱，看行动和户外适配；第三件重在面料细节，适合想要近看也耐看的新娘。",
        "组图不只是堆美图。完整上身、侧面结构、面料近景、挂装和 mood board 各自承担不同信息，用户才知道怎么收藏和对比。",
        "品牌内容如果能帮人更快排除不适合，也是一种专业。"
      ],
      note: "系列发布逻辑，避免每张图重复。"
    },
    {
      titles: ["新品发布前，我们会先看这些细节", "一件婚纱能不能发布，不只看正面", "从样衣到上身，中间要确认很多次"],
      paragraphs: [
        "发布前我们会看正面，但不会只看正面。",
        "坐下会不会顶、走路会不会拖、背后拉链和腰线是不是顺、强光下白色面料有没有丢细节，这些都会影响最后呈现。",
        "有些婚纱拍静物很好看，上身以后比例不成立；有些看起来简单，穿起来反而很稳。",
        "所以新品内容里会尽量留下过程图。它不是花絮，是判断一件婚纱是否可信的证据。"
      ],
      note: "品牌幕后发布，衔接图片中的材质和过程图。"
    }
  ],
  婚纱店发布: [
    {
      titles: ["婚纱店日常：今天没有催她马上定", "一次舒服的试纱，从不着急开始", "让客人放心的，很多是小动作"],
      paragraphs: [
        "今天这位客人进店时很明确，说自己不想要太公主，也怕被一直推贵的款。",
        "我们先没有拿最重工的主纱，而是让她试了两件线条不同的款，确认她到底是不喜欢隆重，还是担心自己撑不起来。",
        "试到第三件时，她开始主动问头纱怎么配、拖尾适不适合酒店。这个变化比一句好看更重要。",
        "婚纱店内容不一定要拍得很豪华。把沟通、试穿、调整和确认拍清楚，预约前的人会更知道自己会被怎样对待。"
      ],
      note: "门店发布以服务过程建立信任，不做硬广。"
    },
    {
      titles: ["婚纱馆可以发什么？不只是一排裙子", "试纱间里的真实细节，其实很有用", "比空间好看更重要的是体验清楚"],
      paragraphs: [
        "很多店铺内容只拍橱窗和裙子，但备婚用户真正想知道的是：进店以后会不会尴尬，会不会被催，会不会试得很累。",
        "可以拍预约卡、试纱间、顾问整理裙摆、头纱搭配、面料近景，也可以拍客人授权后的试穿过程。",
        "每张图最好对应一个体验节点，不要五张都只是漂亮空间。",
        "真实不等于随便。画面干净、动线清楚、服务不过度打扰，才会让人愿意预约。"
      ],
      tags: ["#婚纱店", "#婚纱馆", "#试纱预约", "#婚纱店日常", "#备婚探店"],
      note: "给婚纱店发布方法，避免空间炫耀。"
    },
    {
      titles: ["今天的试纱间，留下了这些小瞬间", "婚纱店日常不需要每张都很满", "真实客照前，先拍好过程"],
      paragraphs: [
        "顾问蹲下整理拖尾、客人低头看腰线、朋友在旁边翻上一件的照片，这些都比摆拍更像真实试纱。",
        "我们现在发店铺内容，会尽量把过程图留出来。不是为了显得忙，而是让还没来过的人知道试纱不会只有站在镜子前被评价。",
        "客照一定会确认授权，隐私信息不会露出。预约单、手机屏幕和聊天内容都要避开。",
        "信任感不是靠一句放心来建立，是靠每个细节都不让人紧张。"
      ],
      note: "门店日常加入隐私和授权意识，减少冲突风险。"
    },
    {
      titles: ["婚纱店探店，别只看装修", "我会先看试纱间这几个地方", "店铺内容应该让人知道能不能安心试"],
      paragraphs: [
        "婚纱店好不好，不只是橱窗漂亮不漂亮。",
        "试纱间有没有足够空间走动，镜子角度会不会变形，灯光会不会把白纱照成一片，顾问会不会给你时间自己看，这些都很影响体验。",
        "如果店铺发布能把这些拍出来，比单纯放一组精修图更有参考价值。",
        "备婚已经有很多要决定的事了。一个清楚、干净、不压迫的试纱环境，会让人轻松很多。"
      ],
      note: "探店用户视角，给门店发布更真实的观察点。"
    },
    {
      titles: ["预约试纱前，你可以先看店铺有没有这些内容", "婚纱店发布越具体，越让人安心", "别只看客片，也看服务过程"],
      paragraphs: [
        "如果一个婚纱店只发精修客片，我会再往下翻翻有没有过程内容。",
        "比如顾问怎么帮客人缩小范围，试纱间真实光线如何，头纱和配饰怎么搭，客照授权怎么处理，改尺寸会怎么沟通。",
        "这些内容看起来没有大片那么吸睛，但对准备预约的人很有用。",
        "店铺发布不是每天喊欢迎预约。把用户最担心的地方讲清楚，才是更自然的转化。"
      ],
      note: "预约前判断清单，兼顾真实平台阅读需求和店铺转化。"
    }
  ]
};

export const xiaohongshuBridalTopicCopyKits = Object.fromEntries(
  Object.entries(xiaohongshuBridalContentProfiles).map(([topic, profile]) => [topic, profile.copyKit])
) as Record<XiaohongshuBridalTopic, XiaohongshuTopicCopyKit>;

export function getXiaohongshuBridalContentProfile(topic: XiaohongshuBridalTopic) {
  return xiaohongshuBridalContentProfiles[topic];
}
