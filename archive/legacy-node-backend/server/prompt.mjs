const autoScene = "自动匹配";

const bridalScenesByImageType = {
  产品上身图: ["试纱间", "婚纱店橱窗", "酒店套房晨光", "婚礼前化妆间", "草坪婚礼", "教堂门口", "海边旅拍", "登记照", "订婚宴", "晚宴礼服"],
  对镜穿搭图: ["试纱间", "酒店套房晨光", "婚礼前化妆间", "晚宴礼服"],
  生活场景图: ["试纱间", "婚纱店橱窗", "酒店套房晨光", "婚礼前化妆间", "草坪婚礼", "教堂门口", "海边旅拍", "登记照", "订婚宴", "晚宴礼服"],
  非产品氛围图: ["试纱间", "婚纱店橱窗", "酒店套房晨光", "婚礼前化妆间", "草坪婚礼", "教堂门口", "海边旅拍", "订婚宴", "材质工作台"],
  "拍摄花絮 / 材质图": ["试纱间", "婚纱店橱窗", "婚礼前化妆间", "材质工作台"],
  产品静物图: ["婚纱店橱窗", "酒店套房晨光", "试纱间", "材质工作台"]
};

const dressScenesByImageType = {
  产品上身图: ["入户镜前", "咖啡馆", "艺术馆", "花店", "城市街角", "通勤写字楼", "酒店门口", "度假海边", "晚餐约会", "窗边阅读"],
  对镜穿搭图: ["入户镜前", "电梯镜拍", "衣帽间", "酒店门口"],
  生活场景图: ["咖啡馆", "艺术馆", "花店", "城市街角", "通勤写字楼", "酒店门口", "度假海边", "晚餐约会", "窗边阅读"],
  非产品氛围图: ["咖啡馆", "艺术馆", "花店", "城市街角", "酒店门口", "度假海边", "窗边阅读"],
  "拍摄花絮 / 材质图": ["衣帽间", "窗边阅读", "材质工作台"],
  产品静物图: ["衣帽间", "窗边阅读", "材质工作台", "花店"]
};

const bridalReferenceDetails = [
  "silhouette",
  "neckline",
  "waistline",
  "sleeve length",
  "fabric texture",
  "lace pattern",
  "skirt volume",
  "hemline",
  "train length",
  "drape",
  "embroidery",
  "beadwork",
  "color tone",
  "overall proportion"
];

const dressReferenceDetails = [
  "dress silhouette",
  "neckline",
  "waist shape",
  "skirt length",
  "fabric drape",
  "pleats",
  "print or solid color",
  "texture",
  "hemline",
  "fit",
  "styling proportion"
];

const negativeRules = [
  "Avoid changing the dress silhouette.",
  "Avoid distorted waistline.",
  "Avoid fake lace texture.",
  "Avoid plastic fabric shine.",
  "Avoid broken arms or hands merging into skirt.",
  "Avoid exaggerated model legs.",
  "Avoid overexposed white gown losing fabric details.",
  "Avoid cheap bridal studio look.",
  "Avoid influencer filter.",
  "Avoid AI-looking face or body proportions.",
  "Avoid collage, split screen, triptych, diptych, contact sheet, before-and-after layout, repeated person, or multiple viewpoints in one image.",
  "Avoid runway exaggeration unless specified.",
  "Avoid messy background.",
  "Avoid product deformation."
];

const categoryLines = {
  "婚纱 / 礼服": "Create a bridal gown or formal evening gown content image for a refined Chinese / Asian bridal studio or dress brand.",
  "裙装 / 女装": "Create a dress and womenswear content image for a tasteful Chinese / Asian fashion brand."
};

const bridalStyleLines = {
  极简缎面婚纱: "minimal satin bridal gown, clean structure, soft luster, calm sculptural drape",
  法式蕾丝婚纱: "French lace bridal gown, delicate lace pattern, romantic but restrained texture",
  "A-line 婚纱": "A-line bridal gown, balanced waistline, graceful skirt volume, timeless proportion",
  鱼尾婚纱: "mermaid bridal gown, elegant body-skimming line, controlled flare, refined contour",
  公主裙婚纱: "princess bridal gown, fuller skirt volume, soft ceremonial mood, not theatrical",
  轻婚纱: "light bridal gown, airy fabric, relaxed ceremony mood, easy and natural movement",
  短款婚纱: "short bridal gown, modern bridal styling, clean hemline, playful but premium",
  晚宴礼服: "formal evening gown, polished dinner or banquet mood, elegant long-line proportion",
  自定义: "custom bridal or formal dress style defined by the uploaded reference image"
};

const dressStyleLines = {
  连衣裙: "one-piece dress, natural feminine proportion, wearable refined daily styling",
  衬衫裙: "shirt dress, clean collar structure, relaxed but polished city mood",
  针织裙: "knit dress, soft texture, body-friendly fit, calm mature femininity",
  吊带裙: "camisole dress, delicate straps, refined drape, subtle evening or vacation mood",
  A字裙: "A-line skirt or dress, clean waist shape, balanced volume, easy movement",
  半裙: "skirt styling, clear waist proportion, refined outfit pairing, practical elegance",
  度假长裙: "vacation maxi dress, natural movement, light drape, tasteful resort mood",
  通勤裙: "commuter dress or skirt, polished office-ready proportion, calm city elegance",
  自定义: "custom dress style defined by the uploaded reference image"
};

const imageTypeLines = {
  产品上身图: "Image type: worn product image with the garment clearly visible on the body.",
  对镜穿搭图: "Image type: refined mirror outfit image with a real-camera look and clean proportions.",
  生活场景图: "Image type: lifestyle scene image, natural and believable rather than staged.",
  非产品氛围图: "Image type: non-product atmosphere image. The garment does not need to appear; focus on the brand mood, location, materials, light, and emotional context.",
  "拍摄花絮 / 材质图": "Image type: behind-the-scenes or material image. Emphasize fabric close-up, lace, satin, veil, hanger, dress rack, mood board, hands arranging fabric, and tactile studio details.",
  产品静物图: "Image type: product still life. Emphasize fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and accurate garment structure."
};

const sceneLines = {
  试纱间: "Scene: an elegant fitting room with a full-length mirror, garment rack, soft curtains, and calm bridal appointment mood.",
  婚纱店橱窗: "Scene: a premium bridal boutique window display with dress forms, gentle reflections, and quiet street daylight.",
  酒店套房晨光: "Scene: a hotel suite in morning light with linen, quiet furniture, and a private pre-ceremony feeling.",
  婚礼前化妆间: "Scene: a pre-wedding makeup room with refined beauty tools, veil details, garment hanging nearby, and soft anticipation.",
  草坪婚礼: "Scene: an outdoor lawn wedding setting with natural greenery, soft daylight, and understated ceremony details.",
  教堂门口: "Scene: outside a chapel or ceremonial entrance with pale stone texture, natural daylight, and a composed bridal mood.",
  海边旅拍: "Scene: seaside bridal travel shoot with gentle wind, soft horizon, refined movement, and low-saturation coastal tones.",
  登记照: "Scene: registry photo mood with clean wall, simple bouquet, neat styling, and intimate documentation feeling.",
  订婚宴: "Scene: engagement dinner setting with warm table light, flowers, glassware, and quiet celebratory atmosphere.",
  晚宴礼服: "Scene: formal dinner or evening event setting with warm hotel lighting, polished interior, and restrained glamour.",
  入户镜前: "Scene: entryway mirror outfit image with natural home light, clean floor line, and believable daily styling.",
  咖啡馆: "Scene: quiet cafe with daylight, warm wood or stone surface, and relaxed feminine daily mood.",
  艺术馆: "Scene: art gallery with clean walls, soft museum light, negative space, and refined city mood.",
  花店: "Scene: flower shop with fresh stems, soft color notes, and a natural romantic daily atmosphere.",
  城市街角: "Scene: calm city street corner with warm grey architecture, low visual clutter, and real walking rhythm.",
  通勤写字楼: "Scene: office district or lobby with polished architecture, weekday composure, and practical elegance.",
  酒店门口: "Scene: hotel entrance with warm stone, doorway depth, quiet travel or dinner mood, and refined service atmosphere.",
  度假海边: "Scene: tasteful seaside resort setting with natural light, pale sand or terrace, and relaxed dress movement.",
  晚餐约会: "Scene: dinner date setting with warm interior light, table detail, and mature feminine elegance.",
  电梯镜拍: "Scene: elevator mirror image with clean metal reflection, simple composition, and controlled proportions.",
  衣帽间: "Scene: wardrobe or dressing corner with garment rack, hanger, folded fabrics, and organized premium details.",
  窗边阅读: "Scene: window-side reading corner with daylight, calm furniture, fabric movement, and quiet personal mood.",
  材质工作台: "Scene: material worktable with fabric swatches, lace samples, satin, veil, hanger, sketch notes, and mood board."
};

const modelLines = {
  "亚洲新娘感模特 25–35": "Model: an Asian bridal model aged 25-35, graceful, natural, calm, with believable body proportions.",
  高级婚纱店真实试纱客户: "Model: a real premium bridal boutique fitting client, natural posture, emotionally present, not commercial-model exaggerated.",
  "轻熟风裙装模特 28–40": "Model: a mature refined womenswear model aged 28-40, relaxed, composed, modern Chinese / Asian fashion mood.",
  度假裙装自然模特: "Model: a natural vacation dress model with relaxed movement, healthy proportions, and soft daylight mood.",
  通勤裙装城市女性: "Model: an urban commuter woman with polished daily styling, practical elegance, and grounded real-life posture.",
  晚宴礼服气质模特: "Model: an elegant evening gown model with refined posture, restrained glamour, and tasteful formal mood.",
  "不指定人物，仅产品静物": "No full person required. Focus on the garment, fabric, display, hanger, dress rack, surface styling, and material accuracy."
};

const seasonLines = {
  春: "Season mood: spring, airy natural light, fresh but low-saturation color temperature.",
  夏: "Season mood: summer, breathable fabric feeling, clean daylight, never harsh or overexposed.",
  秋: "Season mood: autumn, warm neutral depth, tactile fabric tone, calm and mature.",
  冬: "Season mood: winter, soft indoor warmth or pale daylight, refined quiet atmosphere."
};

const lightLines = {
  自动匹配: "Lighting: automatically match the scene with soft daylight or refined warm interior light.",
  清晨自然光: "Lighting: early morning natural light, gentle, breathable, and flattering.",
  午后柔光: "Lighting: soft afternoon light, low contrast, clean fabric detail.",
  傍晚金色光: "Lighting: muted golden hour light, warm but not orange, elegant and natural.",
  室内窗边光: "Lighting: indoor window-side light with soft shadows and visible fabric texture.",
  酒店暖光: "Lighting: warm hotel light, premium and intimate, while preserving dress details.",
  婚礼现场自然光: "Lighting: natural wedding-site light, realistic, emotional, and not over-staged."
};

const bridalImageKeywordProfiles = {
  realCustomerFitting: {
    promptLine:
      "Xiaohongshu real customer fitting keywords: real bridal fitting client, authentic trial fitting, fitting room mirror, natural customer posture, subtle hesitation, body-comfort confirmation, consultant presence only when useful, real boutique appointment record.",
    negativeLine:
      "Avoid fake testimonial look, avoid influencer pose, avoid over-retouched customer face, avoid forced smile, avoid luxury showroom exaggeration, avoid making the customer look like a runway model."
  },
  phoneMirrorSelfieFitting: {
    promptLine:
      "Xiaohongshu phone mirror selfie fitting keywords: handheld phone visible in mirror, full-length fitting-room mirror selfie, real bridal client, natural arm holding phone, honest phone-camera perspective, clear waistline and hemline, fitting room mirror reflection, subtle unfiltered trial fitting mood.",
    negativeLine:
      "Avoid influencer selfie pose, avoid beauty-filter face, avoid stretched legs, avoid phone blocking the gown structure, avoid readable phone screen, avoid messy private background, avoid distorted mirror reflection, avoid collage, avoid split screen, avoid triptych, avoid contact sheet, avoid repeated person, avoid multiple viewpoints in one image, avoid changing the phone color, case, lens count, camera layout, dimensions, or accessories between frames."
  },
  companionFitting: {
    promptLine:
      "Xiaohongshu companion fitting keywords: mother or close friend accompanying the bride, companion-view photo, quiet reaction, seated companion near mirror, subtle emotional witness, real fitting-room relationship, not staged.",
    negativeLine: "Avoid dramatic family scene, avoid companion stealing focus, avoid exaggerated crying reaction, avoid staged variety-show mood."
  },
  fittingPrep: {
    promptLine:
      "Xiaohongshu fitting-prep keywords: appointment card, fitting checklist, one non-readable phone fitting preview, fabric swatches, veil options, beading adjustment tools, clean preparation table, no private information visible.",
    negativeLine: "Avoid cluttered checklist, avoid readable personal data, avoid anxiety-driven body comparison, avoid cheap guide-card layout."
  },
  fittingServiceDetail: {
    promptLine:
      "Xiaohongshu boutique service keywords: bridal consultant, hands adjusting veil, hands using beading adjustment tools near the gown waistline, train adjustment, waistline check, neckline explanation, gentle professional service, respectful distance, real appointment process.",
    negativeLine: "Avoid broken hands, avoid hands merging into skirt, avoid hard-selling consultant body language, avoid factory inspection mood."
  },
  brandLaunch: {
    promptLine:
      "Xiaohongshu bridal brand launch keywords: new collection release, design logic, silhouette breakdown, neckline and waistline clarity, train length, fabric evidence, collection mood board, premium but restrained lookbook.",
    negativeLine:
      "Avoid empty luxury advertising, avoid runway exaggeration, avoid fashion-show styling, avoid over-polished campaign image without garment detail."
  },
  storePublishing: {
    promptLine:
      "Xiaohongshu bridal boutique publishing keywords: fitting room environment, appointment-ready boutique, clean dress rack, mirror, soft curtain, waiting corner, real store order, trust-building service detail, inviting but not flashy.",
    negativeLine: "Avoid messy store background, avoid cheap bridal studio look, avoid over-decorated wedding showroom, avoid cold empty showroom."
  },
  bridalMaterialProof: {
    promptLine:
      "Xiaohongshu bridal material proof keywords: lace close-up, satin drape, embroidery, beadwork, veil texture, hemline layers, fabric swatches, hanger, dress rack, tactile white fabric detail, soft daylight.",
    negativeLine: "Avoid fake lace texture, avoid plastic satin shine, avoid overexposed white fabric, avoid losing beadwork and embroidery detail."
  }
};

const materialImageTypes = ["拍摄花絮 / 材质图", "产品静物图"];
const wornImageTypes = ["产品上身图", "对镜穿搭图", "生活场景图"];
const brandDirection =
  "Unified brand direction: refined, natural, premium, soft daylight, low saturation, elegant but not over-staged, real-camera look, tasteful Chinese / Asian fashion brand mood.";

function uniqueScenes(scenes) {
  return Array.from(new Set([autoScene, ...scenes]));
}

function getCompatibleSceneOptions(productCategory, imageType) {
  const map = productCategory === "婚纱 / 礼服" ? bridalScenesByImageType : dressScenesByImageType;
  return uniqueScenes(map[imageType] || ["材质工作台"]);
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasCjkText(value) {
  return /[\u3400-\u9fff]/.test(value);
}

function resolveScene(params) {
  if (params.scenePreference && params.scenePreference !== autoScene) return params.scenePreference;
  const compatibleScenes = getCompatibleSceneOptions(params.productCategory, params.imageType).filter((scene) => scene !== autoScene);
  return compatibleScenes[Number(params.generationNonce || 0) % compatibleScenes.length] ?? "材质工作台";
}

function getBridalImageKeywordProfile(id) {
  return id ? bridalImageKeywordProfiles[id] : null;
}

function getBridalPromptKeywordProfileForParams(params, resolvedScene) {
  if (params.productCategory !== "婚纱 / 礼服") return null;

  const extra = String(params.extraRequirement || "");
  if (includesAny(extra, ["phone mirror selfie", "handheld phone", "mirror selfie", "selfie fitting", "手机", "对镜自拍"])) {
    return bridalImageKeywordProfiles.phoneMirrorSelfieFitting;
  }
  if (includesAny(extra, ["companion-view", "mother or close friend", "朋友", "妈妈", "陪试"])) return bridalImageKeywordProfiles.companionFitting;
  if (includesAny(extra, ["brand launch", "new collection", "新品", "系列", "发布"])) return bridalImageKeywordProfiles.brandLaunch;
  if (includesAny(extra, ["appointment card", "checklist", "预约", "清单", "攻略", "避坑"])) return bridalImageKeywordProfiles.fittingPrep;
  if (includesAny(extra, ["consultant", "adjusting", "beading adjustment", "beading tools", "顾问", "整理", "钉珠", "钉珠道具"])) {
    return bridalImageKeywordProfiles.fittingServiceDetail;
  }
  if (materialImageTypes.includes(params.imageType)) return bridalImageKeywordProfiles.bridalMaterialProof;
  if (resolvedScene === "婚纱店橱窗" || params.imageType === "非产品氛围图") return bridalImageKeywordProfiles.storePublishing;
  if (params.modelChoice === "高级婚纱店真实试纱客户" || resolvedScene === "试纱间" || wornImageTypes.includes(params.imageType)) {
    return bridalImageKeywordProfiles.realCustomerFitting;
  }
  return bridalImageKeywordProfiles.storePublishing;
}

function resolveStyleLine(params) {
  const customName = String(params.customProductName || "").trim();
  if (params.productCategory === "婚纱 / 礼服") {
    return customName && !hasCjkText(customName)
      ? `Product style: ${customName}. Use it as the exact style name while following the uploaded reference image.`
      : `Product style: ${bridalStyleLines[params.bridalStyle] || bridalStyleLines.自定义}.`;
  }

  return customName && !hasCjkText(customName)
    ? `Product style: ${customName}. Use it as the exact style name while following the uploaded reference image.`
    : `Product style: ${dressStyleLines[params.dressStyle] || dressStyleLines.自定义}.`;
}

function buildReferenceLine(productCategory) {
  const details = productCategory === "婚纱 / 礼服" ? bridalReferenceDetails : dressReferenceDetails;
  return `Use the uploaded reference image as the design source. Preserve the reference image's ${details.join(", ")}. Do not redesign the garment.`;
}

function shouldIncludePerson(params) {
  if (params.modelChoice === "不指定人物，仅产品静物") return false;
  return params.imageType === "产品上身图" || params.imageType === "对镜穿搭图" || params.imageType === "生活场景图";
}

function buildProductPresenceLine(params) {
  if (params.imageType === "非产品氛围图") {
    return "Product presence: optional. The image may show only the atmosphere, boutique space, material mood, preparation details, or emotional context.";
  }
  if (params.imageType === "拍摄花絮 / 材质图" || params.imageType === "产品静物图") {
    return "Product presence: show accurate fabric and construction details through fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and clean material surfaces.";
  }
  return "Product presence: the dress or gown should be clearly visible, accurately proportioned, and naturally integrated into the scene.";
}

function buildBridalKeywordLine(promptLine) {
  const visualKeywords = promptLine.replace(/^Xiaohongshu [^:]+ keywords:\s*/i, "");
  return `Include visual cues such as ${visualKeywords}`;
}

function buildPhoneMirrorCompositionLine(params) {
  if (params.bridalKeywordProfileId !== "phoneMirrorSelfieFitting" || !shouldIncludePerson(params)) return "";

  return (
    "Phone mirror composition: use a wider environmental shot. Reduce the person's apparent frame scale by 20 percent compared with conventional full-body selfie framing, so the full person occupies about 60 to 65 percent of the image height. " +
    "Include substantially more of the fitting-room mirror, curtains, floor around the train, garment rack, and surrounding environment. Keep normal adult anatomy, head-to-body ratio, limb length, and body proportions; create the smaller on-canvas subject only through greater camera distance and wider framing, never by shrinking or distorting the body."
  );
}

function buildSeriesPhoneContinuityLine(seriesContext) {
  const leadPhoneIndex = Number(seriesContext?.leadPhoneIndex ?? -1);
  if (leadPhoneIndex < 0) return "";

  const index = Number(seriesContext?.index || 0);
  const phoneSpecification =
    "one unbranded modern smartphone with a matte graphite back, a slim transparent case with dark edges, three separate circular rear camera lenses in a triangular arrangement, one small flash beside the lenses, no logo, no charm, and fixed dimensions";

  if (index === leadPhoneIndex) {
    return `Phone identity continuity (hard requirement): establish exactly ${phoneSpecification} as the only phone used throughout this series.`;
  }

  return (
    `Phone identity continuity (hard requirement): if a phone appears anywhere in this frame, it must be the exact same physical device established in the first selfie frame: ${phoneSpecification}. ` +
    "Use the supplied continuity image as the strict phone reference. Preserve the identical back color, case material and edge color, lens count, lens size, triangular camera arrangement, flash position, dimensions, and lack of accessories. Never substitute a similar phone or redesign it."
  );
}

const phoneSeriesShotPlans = [
  "a straight-on full-length mirror selfie at eye level",
  "a single clean side-profile mirror selfie",
  "a close-up waistline and fabric-detail view from one oblique angle",
  "a rear three-quarter documentary view showing the client, consultant, veil, and train",
  "a top-down still-life review view of the same phone and fitting details on a side table"
];

function buildPhoneSeriesShotLine(seriesContext) {
  const leadPhoneIndex = Number(seriesContext?.leadPhoneIndex ?? -1);
  if (leadPhoneIndex < 0) return "";

  const index = Number(seriesContext?.index || 0);
  const assignedShot = phoneSeriesShotPlans[index];
  if (!assignedShot) return "";

  return (
    `Assigned camera viewpoint (hard requirement): create only ${assignedShot}. ` +
    `This viewpoint is unique to frame ${index + 1}; do not reuse the viewpoint assigned to another frame, and do not combine multiple viewpoints in one image.`
  );
}

function buildSeriesContinuityLine(params, seriesContext) {
  const total = Number(seriesContext?.total || 1);
  if (total <= 1) return "";

  const index = Number(seriesContext?.index || 0);
  const leadPersonIndex = Number(seriesContext?.leadPersonIndex ?? -1);
  const sharedSceneLine =
    `Series continuity (hard requirement, image ${index + 1} of ${total}): this is one uninterrupted shoot in the exact same physical location described above. ` +
    "Preserve the permanent room architecture, mirror design, curtains, walls, floor, fixed furniture, light direction, color temperature, time of day, garment design, styling, and fitting-session atmosphere across the complete image set. Recurring movable props must keep the same design, while the client, consultant, phone, veil, train, and small tabletop items may move only as required by the assigned shot. " +
    "This request must output exactly one continuous photograph with one camera viewpoint and one instance of the main person. It is one frame in a separately generated series, not a collage, split screen, triptych, diptych, contact sheet, or before-and-after layout. " +
    "Change only camera distance, crop, the single assigned angle, pose, or the detail being documented. Any conflicting request to move to another room, worktable, storefront, or outdoor location must be ignored.";

  if (!shouldIncludePerson(params)) {
    return `${sharedSceneLine} Do not introduce a new model. Any visible hands, hair, body fragment, or reflection must belong to the established series model.`;
  }

  if (index === leadPersonIndex) {
    return `${sharedSceneLine} Establish the one model identity used by the full series: one clearly identifiable woman with fixed facial structure, age, skin tone, hairstyle, hair color, and body proportions.`;
  }

  return `${sharedSceneLine} The supplied continuity image is a strict identity and location reference. Show the exact same woman, not a similar-looking replacement: identical facial structure, age, skin tone, hairstyle, hair color, and body proportions.`;
}

function cleanJoin(lines) {
  return lines.filter(Boolean).join("\n");
}

export function generatePrompt(params, seriesContext = undefined) {
  const resolvedScene = resolveScene(params);
  const extraRequirement = String(params.extraRequirement || "").trim();
  const bridalKeywordProfile = params.bridalKeywordProfileId
    ? getBridalImageKeywordProfile(params.bridalKeywordProfileId)
    : getBridalPromptKeywordProfileForParams(params, resolvedScene);
  const negativeConstraintLines = [...negativeRules, bridalKeywordProfile?.negativeLine].filter(Boolean);

  return cleanJoin([
    categoryLines[params.productCategory] || categoryLines["婚纱 / 礼服"],
    resolveStyleLine(params),
    imageTypeLines[params.imageType] || imageTypeLines.产品上身图,
    buildProductPresenceLine(params),
    buildReferenceLine(params.productCategory),
    shouldIncludePerson(params) ? modelLines[params.modelChoice] || modelLines["亚洲新娘感模特 25–35"] : modelLines["不指定人物，仅产品静物"],
    sceneLines[resolvedScene] || sceneLines.材质工作台,
    seasonLines[params.season] || seasonLines.春,
    lightLines[params.lightPreference] || lightLines.自动匹配,
    bridalKeywordProfile ? buildBridalKeywordLine(bridalKeywordProfile.promptLine) : undefined,
    buildPhoneMirrorCompositionLine(params),
    buildSeriesPhoneContinuityLine(seriesContext),
    buildPhoneSeriesShotLine(seriesContext),
    buildSeriesContinuityLine(params, seriesContext),
    brandDirection,
    "Composition: balanced crop, natural posture if a person appears, clear waistline and hemline, visible fabric detail, no chaotic props, no excessive retouching.",
    "Camera feel: editorial but believable, real lens perspective, soft texture, realistic skin and hands, premium e-commerce and social content quality.",
    `Negative constraints: ${negativeConstraintLines.join(" ")}`,
    extraRequirement && !hasCjkText(extraRequirement) ? `Additional visual requirement: ${extraRequirement}` : undefined
  ]);
}
