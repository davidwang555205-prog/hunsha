package prompt

// 映射表与常量，1:1 迁移自 server/prompt.mjs（真实源码，逐字节复制）。
// 注意：含 CJK / 特殊 Unicode（en-dash U+2013）的 key 务必逐字节复制，不可改写。

// autoScene 自动匹配场景标识。
const autoScene = "自动匹配"

// materialImageTypes 材质类图片类型（不出现人物）。
var materialImageTypes = []string{"拍摄花絮 / 材质图", "产品静物图"}

// wornImageTypes 穿着类图片类型（出现人物）。
var wornImageTypes = []string{"产品上身图", "对镜穿搭图", "生活场景图"}

// brandDirection 统一品牌方向（常量）。
const brandDirection = "Unified brand direction: refined, natural, premium, soft daylight, low saturation, elegant but not over-staged, real-camera look, tasteful Chinese / Asian fashion brand mood."

// compositionLine 构图约束（常量）。
const compositionLine = "Composition: balanced crop, natural posture if a person appears, clear waistline and hemline, visible fabric detail, no chaotic props, no excessive retouching."

// cameraFeelLine 相机感约束（常量）。
const cameraFeelLine = "Camera feel: editorial but believable, real lens perspective, soft texture, realistic skin and hands, premium e-commerce and social content quality."

// categoryLines 品类文案（2 个 key）。
var categoryLines = map[string]string{
	"婚纱 / 礼服": "Create a bridal gown or formal evening gown content image for a refined Chinese / Asian bridal studio or dress brand.",
	"裙装 / 女装": "Create a dress and womenswear content image for a tasteful Chinese / Asian fashion brand.",
}

// bridalStyleLines 婚纱款式（9 个 key）。
var bridalStyleLines = map[string]string{
	"极简缎面婚纱":   "minimal satin bridal gown, clean structure, soft luster, calm sculptural drape",
	"法式蕾丝婚纱":   "French lace bridal gown, delicate lace pattern, romantic but restrained texture",
	"A-line 婚纱":  "A-line bridal gown, balanced waistline, graceful skirt volume, timeless proportion",
	"鱼尾婚纱":      "mermaid bridal gown, elegant body-skimming line, controlled flare, refined contour",
	"公主裙婚纱":     "princess bridal gown, fuller skirt volume, soft ceremonial mood, not theatrical",
	"轻婚纱":       "light bridal gown, airy fabric, relaxed ceremony mood, easy and natural movement",
	"短款婚纱":      "short bridal gown, modern bridal styling, clean hemline, playful but premium",
	"晚宴礼服":      "formal evening gown, polished dinner or banquet mood, elegant long-line proportion",
	"自定义":       "custom bridal or formal dress style defined by the uploaded reference image",
}

// dressStyleLines 裙装款式（9 个 key）。
var dressStyleLines = map[string]string{
	"连衣裙":  "one-piece dress, natural feminine proportion, wearable refined daily styling",
	"衬衫裙":  "shirt dress, clean collar structure, relaxed but polished city mood",
	"针织裙":  "knit dress, soft texture, body-friendly fit, calm mature femininity",
	"吊带裙":  "camisole dress, delicate straps, refined drape, subtle evening or vacation mood",
	"A字裙":  "A-line skirt or dress, clean waist shape, balanced volume, easy movement",
	"半裙":   "skirt styling, clear waist proportion, refined outfit pairing, practical elegance",
	"度假长裙": "vacation maxi dress, natural movement, light drape, tasteful resort mood",
	"通勤裙":  "commuter dress or skirt, polished office-ready proportion, calm city elegance",
	"自定义":  "custom dress style defined by the uploaded reference image",
}

// imageTypeLines 图片类型（6 个 key）。
var imageTypeLines = map[string]string{
	"产品上身图":         "Image type: worn product image with the garment clearly visible on the body.",
	"对镜穿搭图":         "Image type: refined mirror outfit image with a real-camera look and clean proportions.",
	"生活场景图":         "Image type: lifestyle scene image, natural and believable rather than staged.",
	"非产品氛围图":        "Image type: non-product atmosphere image. The garment does not need to appear; focus on the brand mood, location, materials, light, and emotional context.",
	"拍摄花絮 / 材质图":     "Image type: behind-the-scenes or material image. Emphasize fabric close-up, lace, satin, veil, hanger, dress rack, mood board, hands arranging fabric, and tactile studio details.",
	"产品静物图":         "Image type: product still life. Emphasize fabric close-up, lace, satin, veil, hanger, dress rack, mood board, refined styling props, and accurate garment structure.",
}

// sceneLines 场景（24 个 key）。
var sceneLines = map[string]string{
	"试纱间":      "Scene: an elegant fitting room with a full-length mirror, garment rack, soft curtains, and calm bridal appointment mood.",
	"婚纱店橱窗":    "Scene: a premium bridal boutique window display with dress forms, gentle reflections, and quiet street daylight.",
	"酒店套房晨光":   "Scene: a hotel suite in morning light with linen, quiet furniture, and a private pre-ceremony feeling.",
	"婚礼前化妆间":   "Scene: a pre-wedding makeup room with refined beauty tools, veil details, garment hanging nearby, and soft anticipation.",
	"草坪婚礼":     "Scene: an outdoor lawn wedding setting with natural greenery, soft daylight, and understated ceremony details.",
	"教堂门口":     "Scene: outside a chapel or ceremonial entrance with pale stone texture, natural daylight, and a composed bridal mood.",
	"海边旅拍":     "Scene: seaside bridal travel shoot with gentle wind, soft horizon, refined movement, and low-saturation coastal tones.",
	"登记照":      "Scene: registry photo mood with clean wall, simple bouquet, neat styling, and intimate documentation feeling.",
	"订婚宴":      "Scene: engagement dinner setting with warm table light, flowers, glassware, and quiet celebratory atmosphere.",
	"晚宴礼服":     "Scene: formal dinner or evening event setting with warm hotel lighting, polished interior, and restrained glamour.",
	"入户镜前":     "Scene: entryway mirror outfit image with natural home light, clean floor line, and believable daily styling.",
	"咖啡馆":      "Scene: quiet cafe with daylight, warm wood or stone surface, and relaxed feminine daily mood.",
	"艺术馆":      "Scene: art gallery with clean walls, soft museum light, negative space, and refined city mood.",
	"花店":       "Scene: flower shop with fresh stems, soft color notes, and a natural romantic daily atmosphere.",
	"城市街角":     "Scene: calm city street corner with warm grey architecture, low visual clutter, and real walking rhythm.",
	"通勤写字楼":    "Scene: office district or lobby with polished architecture, weekday composure, and practical elegance.",
	"酒店门口":     "Scene: hotel entrance with warm stone, doorway depth, quiet travel or dinner mood, and refined service atmosphere.",
	"度假海边":     "Scene: tasteful seaside resort setting with natural light, pale sand or terrace, and relaxed dress movement.",
	"晚餐约会":     "Scene: dinner date setting with warm interior light, table detail, and mature feminine elegance.",
	"电梯镜拍":     "Scene: elevator mirror image with clean metal reflection, simple composition, and controlled proportions.",
	"衣帽间":      "Scene: wardrobe or dressing corner with garment rack, hanger, folded fabrics, and organized premium details.",
	"窗边阅读":     "Scene: window-side reading corner with daylight, calm furniture, fabric movement, and quiet personal mood.",
	"材质工作台":    "Scene: material worktable with fabric swatches, lace samples, satin, veil, hanger, sketch notes, and mood board.",
}

// modelLines 模特（7 个 key，注意 en-dash U+2013）。
var modelLines = map[string]string{
	"亚洲新娘感模特 25–35":      "Model: an Asian bridal model aged 25-35, graceful, natural, calm, with believable body proportions.",
	"高级婚纱店真实试纱客户":      "Model: a real premium bridal boutique fitting client, natural posture, emotionally present, not commercial-model exaggerated.",
	"轻熟风裙装模特 28–40":      "Model: a mature refined womenswear model aged 28-40, relaxed, composed, modern Chinese / Asian fashion mood.",
	"度假裙装自然模特":         "Model: a natural vacation dress model with relaxed movement, healthy proportions, and soft daylight mood.",
	"通勤裙装城市女性":         "Model: an urban commuter woman with polished daily styling, practical elegance, and grounded real-life posture.",
	"晚宴礼服气质模特":         "Model: an elegant evening gown model with refined posture, restrained glamour, and tasteful formal mood.",
	"不指定人物，仅产品静物":      "No full person required. Focus on the garment, fabric, display, hanger, dress rack, surface styling, and material accuracy.",
}

// seasonLines 季节（4 个 key）。
var seasonLines = map[string]string{
	"春": "Season mood: spring, airy natural light, fresh but low-saturation color temperature.",
	"夏": "Season mood: summer, breathable fabric feeling, clean daylight, never harsh or overexposed.",
	"秋": "Season mood: autumn, warm neutral depth, tactile fabric tone, calm and mature.",
	"冬": "Season mood: winter, soft indoor warmth or pale daylight, refined quiet atmosphere.",
}

// lightLines 光线（7 个 key）。
var lightLines = map[string]string{
	"自动匹配":     "Lighting: automatically match the scene with soft daylight or refined warm interior light.",
	"清晨自然光":    "Lighting: early morning natural light, gentle, breathable, and flattering.",
	"午后柔光":     "Lighting: soft afternoon light, low contrast, clean fabric detail.",
	"傍晚金色光":    "Lighting: muted golden hour light, warm but not orange, elegant and natural.",
	"室内窗边光":    "Lighting: indoor window-side light with soft shadows and visible fabric texture.",
	"酒店暖光":     "Lighting: warm hotel light, premium and intimate, while preserving dress details.",
	"婚礼现场自然光":  "Lighting: natural wedding-site light, realistic, emotional, and not over-staged.",
}

// keywordProfile 关键词档案 {promptLine, negativeLine}（8 个）。
type keywordProfile struct {
	promptLine   string
	negativeLine string
}

var bridalImageKeywordProfiles = map[string]keywordProfile{
	"realCustomerFitting": {
		promptLine:   "Xiaohongshu real customer fitting keywords: real bridal fitting client, authentic trial fitting, fitting room mirror, natural customer posture, subtle hesitation, body-comfort confirmation, consultant presence only when useful, real boutique appointment record.",
		negativeLine: "Avoid fake testimonial look, avoid influencer pose, avoid over-retouched customer face, avoid forced smile, avoid luxury showroom exaggeration, avoid making the customer look like a runway model.",
	},
	"phoneMirrorSelfieFitting": {
		promptLine:   "Xiaohongshu phone mirror selfie fitting keywords: handheld phone visible in mirror, full-length fitting-room mirror selfie, real bridal client, natural arm holding phone, honest phone-camera perspective, clear waistline and hemline, fitting room mirror reflection, subtle unfiltered trial fitting mood.",
		negativeLine: "Avoid influencer selfie pose, avoid beauty-filter face, avoid stretched legs, avoid phone blocking the gown structure, avoid readable phone screen, avoid messy private background, avoid distorted mirror reflection, avoid collage, avoid split screen, avoid triptych, avoid contact sheet, avoid repeated person, avoid multiple viewpoints in one image, avoid changing the phone color, case, lens count, camera layout, dimensions, or accessories between frames.",
	},
	"companionFitting": {
		promptLine:   "Xiaohongshu companion fitting keywords: mother or close friend accompanying the bride, companion-view photo, quiet reaction, seated companion near mirror, subtle emotional witness, real fitting-room relationship, not staged.",
		negativeLine: "Avoid dramatic family scene, avoid companion stealing focus, avoid exaggerated crying reaction, avoid staged variety-show mood.",
	},
	"fittingPrep": {
		promptLine:   "Xiaohongshu fitting-prep keywords: appointment-card, fitting checklist, one non-readable phone fitting preview, fabric swatches, veil options, beading adjustment tools, clean preparation table, no private information visible.",
		negativeLine: "Avoid cluttered checklist, avoid readable personal data, avoid anxiety-driven body comparison, avoid cheap guide-card layout.",
	},
	"fittingServiceDetail": {
		promptLine:   "Xiaohongshu boutique service keywords: bridal consultant, hands adjusting veil, hands using beading adjustment tools near the gown waistline, train adjustment, waistline check, neckline explanation, gentle professional service, respectful distance, real appointment process.",
		negativeLine: "Avoid broken hands, avoid hands merging into skirt, avoid hard-selling consultant body language, avoid factory inspection mood.",
	},
	"brandLaunch": {
		promptLine:   "Xiaohongshu bridal brand launch keywords: new collection release, design logic, silhouette breakdown, neckline and waistline clarity, train length, fabric evidence, collection mood board, premium but restrained lookbook.",
		negativeLine: "Avoid empty luxury advertising, avoid runway exaggeration, avoid fashion-show styling, avoid over-polished campaign image without garment detail.",
	},
	"storePublishing": {
		promptLine:   "Xiaohongshu bridal boutique publishing keywords: fitting room environment, appointment-ready boutique, clean dress rack, mirror, soft curtain, waiting corner, real store order, trust-building service detail, inviting but not flashy.",
		negativeLine: "Avoid messy store background, avoid cheap bridal studio look, avoid over-decorated wedding showroom, avoid cold empty showroom.",
	},
	"bridalMaterialProof": {
		promptLine:   "Xiaohongshu bridal material proof keywords: lace close-up, satin drape, embroidery, beadwork, veil texture, hemline layers, fabric swatches, hanger, dress rack, tactile white fabric detail, soft daylight.",
		negativeLine: "Avoid fake lace texture, avoid plastic satin shine, avoid overexposed white fabric, avoid losing beadwork and embroidery detail.",
	},
}

// bridalScenesByImageType 婚纱场景按图片类型（6 个，完整列表）。
var bridalScenesByImageType = map[string][]string{
	"产品上身图":         {"试纱间", "婚纱店橱窗", "酒店套房晨光", "婚礼前化妆间", "草坪婚礼", "教堂门口", "海边旅拍", "登记照", "订婚宴", "晚宴礼服"},
	"对镜穿搭图":         {"试纱间", "酒店套房晨光", "婚礼前化妆间", "晚宴礼服"},
	"生活场景图":         {"试纱间", "婚纱店橱窗", "酒店套房晨光", "婚礼前化妆间", "草坪婚礼", "教堂门口", "海边旅拍", "登记照", "订婚宴", "晚宴礼服"},
	"非产品氛围图":        {"试纱间", "婚纱店橱窗", "酒店套房晨光", "婚礼前化妆间", "草坪婚礼", "教堂门口", "海边旅拍", "订婚宴", "材质工作台"},
	"拍摄花絮 / 材质图":     {"试纱间", "婚纱店橱窗", "婚礼前化妆间", "材质工作台"},
	"产品静物图":         {"婚纱店橱窗", "酒店套房晨光", "试纱间", "材质工作台"},
}

// dressScenesByImageType 裙装场景按图片类型（6 个，完整列表）。
var dressScenesByImageType = map[string][]string{
	"产品上身图":     {"入户镜前", "咖啡馆", "艺术馆", "花店", "城市街角", "通勤写字楼", "酒店门口", "度假海边", "晚餐约会", "窗边阅读"},
	"对镜穿搭图":     {"入户镜前", "电梯镜拍", "衣帽间", "酒店门口"},
	"生活场景图":     {"咖啡馆", "艺术馆", "花店", "城市街角", "通勤写字楼", "酒店门口", "度假海边", "晚餐约会", "窗边阅读"},
	"非产品氛围图":    {"咖啡馆", "艺术馆", "花店", "城市街角", "酒店门口", "度假海边", "窗边阅读"},
	"拍摄花絮 / 材质图": {"衣帽间", "窗边阅读", "材质工作台"},
	"产品静物图":     {"衣帽间", "窗边阅读", "材质工作台", "花店"},
}

// bridalReferenceDetails 婚纱参考细节（14 项）。
var bridalReferenceDetails = []string{
	"silhouette", "neckline", "waistline", "sleeve length", "fabric texture",
	"lace pattern", "skirt volume", "hemline", "train length", "drape",
	"embroidery", "beadwork", "color tone", "overall proportion",
}

// dressReferenceDetails 裙装参考细节（11 项）。
var dressReferenceDetails = []string{
	"dress silhouette", "neckline", "waist shape", "skirt length", "fabric drape",
	"pleats", "print or solid color", "texture", "hemline", "fit", "styling proportion",
}

// negativeRules 负面约束（14 条）。
var negativeRules = []string{
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
	"Avoid product deformation.",
}

// phoneSeriesShotPlans 手机系列镜头计划（5 个）。
var phoneSeriesShotPlans = []string{
	"a straight-on full-length mirror selfie at eye level",
	"a single clean side-profile mirror selfie",
	"a close-up waistline and fabric-detail view from one oblique angle",
	"a rear three-quarter documentary view showing the client, consultant, veil, and train",
	"a top-down still-life review view of the same phone and fitting details on a side table",
}

// phoneSpecification 手机身份固定描述（用于图组连续性，与 Node buildSeriesPhoneContinuityLine 内一致）。
const phoneSpecification = "one unbranded modern smartphone with a matte graphite back, a slim transparent case with dark edges, three separate circular rear camera lenses in a triangular arrangement, one small flash beside the lenses, no logo, no charm, and fixed dimensions"
