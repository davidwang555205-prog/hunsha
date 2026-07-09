import type { ImageType, ProductCategory, PromptParams, ScenePreference } from "../types";

export type BridalImageKeywordProfileId =
  | "realCustomerFitting"
  | "phoneMirrorSelfieFitting"
  | "companionFitting"
  | "fittingPrep"
  | "fittingServiceDetail"
  | "brandLaunch"
  | "storePublishing"
  | "bridalMaterialProof";

export type BridalImageKeywordProfile = {
  id: BridalImageKeywordProfileId;
  promptLine: string;
  negativeLine: string;
};

export const bridalImageKeywordProfiles: Record<BridalImageKeywordProfileId, BridalImageKeywordProfile> = {
  realCustomerFitting: {
    id: "realCustomerFitting",
    promptLine:
      "Xiaohongshu real customer fitting keywords: real bridal fitting client, authentic trial fitting, fitting room mirror, natural customer posture, subtle hesitation, body-comfort confirmation, consultant presence only when useful, real boutique appointment record.",
    negativeLine:
      "Avoid fake testimonial look, avoid influencer pose, avoid over-retouched customer face, avoid forced smile, avoid luxury showroom exaggeration, avoid making the customer look like a runway model."
  },
  phoneMirrorSelfieFitting: {
    id: "phoneMirrorSelfieFitting",
    promptLine:
      "Xiaohongshu phone mirror selfie fitting keywords: handheld phone visible in mirror, full-length fitting-room mirror selfie, real bridal client, natural arm holding phone, honest phone-camera perspective, clear waistline and hemline, fitting room mirror reflection, subtle unfiltered trial fitting mood.",
    negativeLine:
      "Avoid influencer selfie pose, avoid beauty-filter face, avoid stretched legs, avoid phone blocking the gown structure, avoid readable phone screen, avoid messy private background, avoid distorted mirror reflection, avoid collage, avoid split screen, avoid triptych, avoid contact sheet, avoid repeated person, avoid multiple viewpoints in one image."
  },
  companionFitting: {
    id: "companionFitting",
    promptLine:
      "Xiaohongshu companion fitting keywords: mother or close friend accompanying the bride, companion-view photo, quiet reaction, seated companion near mirror, subtle emotional witness, real fitting-room relationship, not staged.",
    negativeLine:
      "Avoid dramatic family scene, avoid companion stealing focus, avoid exaggerated crying reaction, avoid staged variety-show mood."
  },
  fittingPrep: {
    id: "fittingPrep",
    promptLine:
      "Xiaohongshu fitting-prep keywords: appointment card, fitting checklist, one non-readable phone fitting preview, fabric swatches, veil options, beading adjustment tools, clean preparation table, no private information visible.",
    negativeLine:
      "Avoid cluttered checklist, avoid readable personal data, avoid anxiety-driven body comparison, avoid cheap guide-card layout."
  },
  fittingServiceDetail: {
    id: "fittingServiceDetail",
    promptLine:
      "Xiaohongshu boutique service keywords: bridal consultant, hands adjusting veil, hands using beading adjustment tools near the gown waistline, train adjustment, waistline check, neckline explanation, gentle professional service, respectful distance, real appointment process.",
    negativeLine:
      "Avoid broken hands, avoid hands merging into skirt, avoid hard-selling consultant body language, avoid factory inspection mood."
  },
  brandLaunch: {
    id: "brandLaunch",
    promptLine:
      "Xiaohongshu bridal brand launch keywords: new collection release, design logic, silhouette breakdown, neckline and waistline clarity, train length, fabric evidence, collection mood board, premium but restrained lookbook.",
    negativeLine:
      "Avoid empty luxury advertising, avoid runway exaggeration, avoid fashion-show styling, avoid over-polished campaign image without garment detail."
  },
  storePublishing: {
    id: "storePublishing",
    promptLine:
      "Xiaohongshu bridal boutique publishing keywords: fitting room environment, appointment-ready boutique, clean dress rack, mirror, soft curtain, waiting corner, real store order, trust-building service detail, inviting but not flashy.",
    negativeLine:
      "Avoid messy store background, avoid cheap bridal studio look, avoid over-decorated wedding showroom, avoid cold empty showroom."
  },
  bridalMaterialProof: {
    id: "bridalMaterialProof",
    promptLine:
      "Xiaohongshu bridal material proof keywords: lace close-up, satin drape, embroidery, beadwork, veil texture, hemline layers, fabric swatches, hanger, dress rack, tactile white fabric detail, soft daylight.",
    negativeLine:
      "Avoid fake lace texture, avoid plastic satin shine, avoid overexposed white fabric, avoid losing beadwork and embroidery detail."
  }
};

const materialImageTypes: ImageType[] = ["拍摄花絮 / 材质图", "产品静物图"];
const wornImageTypes: ImageType[] = ["产品上身图", "对镜穿搭图", "生活场景图"];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function getBridalImageKeywordProfile(id: BridalImageKeywordProfileId) {
  return bridalImageKeywordProfiles[id];
}

export function getBridalPromptKeywordProfileForParams(
  params: PromptParams,
  resolvedScene?: Exclude<ScenePreference, "自动匹配">
) {
  if (params.productCategory !== "婚纱 / 礼服") return null;

  const scene = resolvedScene ?? (params.scenePreference === "自动匹配" ? undefined : params.scenePreference);
  const extra = params.extraRequirement;

  if (includesAny(extra, ["phone mirror selfie", "handheld phone", "mirror selfie", "selfie fitting", "手机", "对镜自拍"])) {
    return bridalImageKeywordProfiles.phoneMirrorSelfieFitting;
  }

  if (includesAny(extra, ["companion-view", "mother or close friend", "朋友", "妈妈", "陪试"])) {
    return bridalImageKeywordProfiles.companionFitting;
  }

  if (includesAny(extra, ["brand launch", "new collection", "新品", "系列", "发布"])) {
    return bridalImageKeywordProfiles.brandLaunch;
  }

  if (includesAny(extra, ["appointment card", "checklist", "预约", "清单", "攻略", "避坑"])) {
    return bridalImageKeywordProfiles.fittingPrep;
  }

  if (includesAny(extra, ["consultant", "adjusting", "beading adjustment", "beading tools", "顾问", "整理", "钉珠", "钉珠道具"])) {
    return bridalImageKeywordProfiles.fittingServiceDetail;
  }

  if (materialImageTypes.includes(params.imageType)) {
    return bridalImageKeywordProfiles.bridalMaterialProof;
  }

  if (scene === "婚纱店橱窗" || params.imageType === "非产品氛围图") {
    return bridalImageKeywordProfiles.storePublishing;
  }

  if (params.modelChoice === "高级婚纱店真实试纱客户" || scene === "试纱间" || wornImageTypes.includes(params.imageType)) {
    return bridalImageKeywordProfiles.realCustomerFitting;
  }

  return bridalImageKeywordProfiles.storePublishing;
}

export function getBridalKeywordLinesForImageProfile(id: BridalImageKeywordProfileId) {
  const profile = getBridalImageKeywordProfile(id);
  return `${profile.promptLine} ${profile.negativeLine}`;
}

export function isBridalCategory(productCategory: ProductCategory) {
  return productCategory === "婚纱 / 礼服";
}
