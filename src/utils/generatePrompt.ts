import { getCompatibleSceneOptions } from "../data/bridalDressSceneOptions";
import type {
  BridalStyle,
  DressStyle,
  ImageType,
  LightPreference,
  ModelChoice,
  ProductCategory,
  PromptOutput,
  PromptParams,
  ScenePreference,
  Season
} from "../types";

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
  "Avoid runway exaggeration unless specified.",
  "Avoid messy background.",
  "Avoid product deformation."
];

const categoryLines: Record<ProductCategory, string> = {
  "婚纱 / 礼服":
    "Create a bridal gown or formal evening gown content image for a refined Chinese / Asian bridal studio or dress brand.",
  "裙装 / 女装":
    "Create a dress and womenswear content image for a tasteful Chinese / Asian fashion brand."
};

const bridalStyleLines: Record<BridalStyle, string> = {
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

const dressStyleLines: Record<DressStyle, string> = {
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

const imageTypeLines: Record<ImageType, string> = {
  产品上身图: "Image type: worn product image with the garment clearly visible on the body.",
  对镜穿搭图: "Image type: refined mirror outfit image with a real-camera look and clean proportions.",
  生活场景图: "Image type: lifestyle scene image, natural and believable rather than staged.",
  非产品氛围图:
    "Image type: non-product atmosphere image. The garment does not need to appear; focus on the brand mood, location, materials, light, and emotional context.",
  "拍摄花絮 / 材质图":
    "Image type: behind-the-scenes or material image. Emphasize fabric close-up, lace, satin, veil, hanger, dress rack, mood board, hands arranging fabric, and tactile studio details.",
  产品静物图:
    "Image type: product still life. Emphasize fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and accurate garment structure."
};

const sceneLines: Record<Exclude<ScenePreference, "自动匹配">, string> = {
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

const modelLines: Record<ModelChoice, string> = {
  "亚洲新娘感模特 25–35": "Model: an Asian bridal model aged 25-35, graceful, natural, calm, with believable body proportions.",
  高级婚纱店真实试纱客户:
    "Model: a real premium bridal boutique fitting client, natural posture, emotionally present, not commercial-model exaggerated.",
  "轻熟风裙装模特 28–40": "Model: a mature refined womenswear model aged 28-40, relaxed, composed, modern Chinese / Asian fashion mood.",
  度假裙装自然模特: "Model: a natural vacation dress model with relaxed movement, healthy proportions, and soft daylight mood.",
  通勤裙装城市女性: "Model: an urban commuter woman with polished daily styling, practical elegance, and grounded real-life posture.",
  晚宴礼服气质模特: "Model: an elegant evening gown model with refined posture, restrained glamour, and tasteful formal mood.",
  "不指定人物，仅产品静物":
    "No full person required. Focus on the garment, fabric, display, hanger, dress rack, surface styling, and material accuracy."
};

const seasonLines: Record<Season, string> = {
  春: "Season mood: spring, airy natural light, fresh but low-saturation color temperature.",
  夏: "Season mood: summer, breathable fabric feeling, clean daylight, never harsh or overexposed.",
  秋: "Season mood: autumn, warm neutral depth, tactile fabric tone, calm and mature.",
  冬: "Season mood: winter, soft indoor warmth or pale daylight, refined quiet atmosphere."
};

const lightLines: Record<LightPreference, string> = {
  自动匹配: "Lighting: automatically match the scene with soft daylight or refined warm interior light.",
  清晨自然光: "Lighting: early morning natural light, gentle, breathable, and flattering.",
  午后柔光: "Lighting: soft afternoon light, low contrast, clean fabric detail.",
  傍晚金色光: "Lighting: muted golden hour light, warm but not orange, elegant and natural.",
  室内窗边光: "Lighting: indoor window-side light with soft shadows and visible fabric texture.",
  酒店暖光: "Lighting: warm hotel light, premium and intimate, while preserving dress details.",
  婚礼现场自然光: "Lighting: natural wedding-site light, realistic, emotional, and not over-staged."
};

const brandDirection =
  "Unified brand direction: refined, natural, premium, soft daylight, low saturation, elegant but not over-staged, real-camera look, tasteful Chinese / Asian fashion brand mood.";

function resolveScene(params: PromptParams): Exclude<ScenePreference, "自动匹配"> {
  if (params.scenePreference !== "自动匹配") return params.scenePreference;
  const compatibleScenes = getCompatibleSceneOptions(params.productCategory, params.imageType).filter(
    (scene): scene is Exclude<ScenePreference, "自动匹配"> => scene !== "自动匹配"
  );
  return compatibleScenes[params.generationNonce % compatibleScenes.length] ?? "材质工作台";
}

function resolveStyleLine(params: PromptParams) {
  const customName = params.customProductName.trim();
  if (params.productCategory === "婚纱 / 礼服") {
    return customName
      ? `Product style: ${customName}. Use it as the exact style name while following the uploaded reference image.`
      : `Product style: ${bridalStyleLines[params.bridalStyle]}.`;
  }

  return customName
    ? `Product style: ${customName}. Use it as the exact style name while following the uploaded reference image.`
    : `Product style: ${dressStyleLines[params.dressStyle]}.`;
}

function buildReferenceLine(productCategory: ProductCategory) {
  const details = productCategory === "婚纱 / 礼服" ? bridalReferenceDetails : dressReferenceDetails;
  return `Use the uploaded reference image as the design source. Preserve the reference image's ${details.join(
    ", "
  )}. Do not redesign the garment.`;
}

function shouldIncludePerson(params: PromptParams) {
  if (params.modelChoice === "不指定人物，仅产品静物") return false;
  return params.imageType === "产品上身图" || params.imageType === "对镜穿搭图" || params.imageType === "生活场景图";
}

function buildProductPresenceLine(params: PromptParams) {
  if (params.imageType === "非产品氛围图") {
    return "Product presence: optional. The image may show only the atmosphere, boutique space, material mood, preparation details, or emotional context.";
  }

  if (params.imageType === "拍摄花絮 / 材质图" || params.imageType === "产品静物图") {
    return "Product presence: show accurate fabric and construction details through fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and clean material surfaces.";
  }

  return "Product presence: the dress or gown should be clearly visible, accurately proportioned, and naturally integrated into the scene.";
}

function cleanJoin(lines: Array<string | false | undefined>) {
  return lines.filter(Boolean).join("\n");
}

export function generatePrompt(params: PromptParams): PromptOutput {
  const resolvedScene = resolveScene(params);
  const extraRequirement = params.extraRequirement.trim();

  const prompt = cleanJoin([
    categoryLines[params.productCategory],
    resolveStyleLine(params),
    imageTypeLines[params.imageType],
    buildProductPresenceLine(params),
    buildReferenceLine(params.productCategory),
    shouldIncludePerson(params) ? modelLines[params.modelChoice] : modelLines["不指定人物，仅产品静物"],
    sceneLines[resolvedScene],
    seasonLines[params.season],
    lightLines[params.lightPreference],
    brandDirection,
    "Composition: balanced crop, natural posture if a person appears, clear waistline and hemline, visible fabric detail, no chaotic props, no excessive retouching.",
    "Camera feel: editorial but believable, real lens perspective, soft texture, realistic skin and hands, premium e-commerce and social content quality.",
    `Negative constraints: ${negativeRules.join(" ")}`,
    extraRequirement ? `Additional user requirement, appended exactly as supplied: ${extraRequirement}` : undefined
  ]);

  return { prompt };
}
