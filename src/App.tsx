import { useMemo, useState } from "react";
import { ReferenceImageUploader } from "./components/ReferenceImageUploader";
import { getCompatibleSceneOptions, isSceneCompatibleWithImageType } from "./data/bridalDressSceneOptions";
import { FASHION_MODEL_OPTIONS } from "./data/fashionModelProfiles";
import type {
  BridalStyle,
  DressStyle,
  ImageType,
  LightPreference,
  ModelChoice,
  ProductCategory,
  PromptParams,
  ScenePreference,
  Season
} from "./types";
import {
  fashionSeedingDailySlotOptions,
  formatFashionSeedingContent,
  generateFashionSeedingContent,
  getDailyFashionSeedingSelection,
  getFashionSeedingTopicOptions,
  type FashionSeedingDailySlot,
  type FashionSeedingTopic
} from "./utils/generateFashionSeedingContent";
import { generatePrompt } from "./utils/generatePrompt";

const productCategoryOptions: ProductCategory[] = ["婚纱 / 礼服", "裙装 / 女装"];
const bridalStyleOptions: BridalStyle[] = [
  "极简缎面婚纱",
  "法式蕾丝婚纱",
  "A-line 婚纱",
  "鱼尾婚纱",
  "公主裙婚纱",
  "轻婚纱",
  "短款婚纱",
  "晚宴礼服",
  "自定义"
];
const dressStyleOptions: DressStyle[] = ["连衣裙", "衬衫裙", "针织裙", "吊带裙", "A字裙", "半裙", "度假长裙", "通勤裙", "自定义"];
const imageTypeOptions: ImageType[] = ["产品上身图", "对镜穿搭图", "生活场景图", "非产品氛围图", "拍摄花絮 / 材质图", "产品静物图"];
const seasonOptions: Season[] = ["春", "夏", "秋", "冬"];
const lightPreferenceOptions: LightPreference[] = ["自动匹配", "清晨自然光", "午后柔光", "傍晚金色光", "室内窗边光", "酒店暖光", "婚礼现场自然光"];
const imageCountOptions: Array<3 | 5> = [3, 5];
const preferredBridalContentTopic: FashionSeedingTopic = "真实客户试纱";

const initialParams: PromptParams = {
  productCategory: "婚纱 / 礼服",
  bridalStyle: "极简缎面婚纱",
  dressStyle: "连衣裙",
  customProductName: "",
  imageType: "产品上身图",
  modelChoice: "亚洲新娘感模特 25–35",
  season: "春",
  scenePreference: "酒店套房晨光",
  lightPreference: "室内窗边光",
  extraRequirement: "",
  generationNonce: 0
};

const initialDailySelection = getDailyFashionSeedingSelection(initialParams.productCategory, new Date(), 1);
const initialContentTopic =
  initialParams.productCategory === "婚纱 / 礼服" ? preferredBridalContentTopic : initialDailySelection.topic;
const initialGeneratedPrompt = generatePrompt(initialParams).prompt;
const initialContent = generateFashionSeedingContent({
  productCategory: initialParams.productCategory,
  baseParams: initialParams,
  imageCount: 3,
  topic: initialContentTopic,
  dailySlot: 1
});

const inputClass =
  "w-full rounded-xl border border-aura-beige bg-white/80 px-3.5 py-3 text-sm text-aura-charcoal outline-none transition focus:border-aura-clay disabled:cursor-not-allowed disabled:bg-aura-cream disabled:text-aura-muted";
const labelClass = "text-sm font-medium text-aura-charcoal";
const hintClass = "text-xs leading-5 text-aura-muted";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-xl bg-aura-charcoal px-4 py-3 text-sm font-medium text-aura-porcelain shadow-sm transition hover:bg-aura-muted disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-medium text-aura-charcoal ring-1 ring-aura-beige transition hover:bg-aura-cream";
const panelClass = "rounded-2xl bg-aura-porcelain/95 p-5 shadow-aura ring-1 ring-aura-beige/70";

function updateField<K extends keyof PromptParams>(params: PromptParams, key: K, value: PromptParams[K]) {
  return { ...params, [key]: value };
}

function getDefaultContentTopic(productCategory: ProductCategory, dailySlot: FashionSeedingDailySlot) {
  if (productCategory === "婚纱 / 礼服") return preferredBridalContentTopic;
  return getDailyFashionSeedingSelection(productCategory, new Date(), dailySlot).topic;
}

function buildParameterSummary(params: PromptParams) {
  const style = params.productCategory === "婚纱 / 礼服" ? params.bridalStyle : params.dressStyle;
  return [params.productCategory, style, params.imageType, params.scenePreference, params.modelChoice, params.lightPreference].join("｜");
}

function App() {
  const [params, setParams] = useState<PromptParams>(initialParams);
  const [generatedPrompt, setGeneratedPrompt] = useState(initialGeneratedPrompt);
  const [copyStatus, setCopyStatus] = useState("");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [referenceImageCount, setReferenceImageCount] = useState(0);
  const [contentTopic, setContentTopic] = useState<FashionSeedingTopic>(initialContentTopic);
  const [dailySlot, setDailySlot] = useState<FashionSeedingDailySlot>(1);
  const [imageCount, setImageCount] = useState<3 | 5>(3);
  const [contentNonce, setContentNonce] = useState(0);
  const [content, setContent] = useState(initialContent);
  const [contentCopyStatus, setContentCopyStatus] = useState("");
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});

  const sceneOptions = useMemo(
    () => getCompatibleSceneOptions(params.productCategory, params.imageType),
    [params.productCategory, params.imageType]
  );
  const contentTopicOptions = useMemo(() => getFashionSeedingTopicOptions(params.productCategory), [params.productCategory]);
  const parameterSummary = buildParameterSummary(params);

  const updateParams = (updater: (current: PromptParams) => PromptParams) => {
    setParams((current) => updater(current));
    setHasPendingChanges(true);
    setCopyStatus("");
    setContentCopyStatus("");
  };

  const handleCategoryChange = (productCategory: ProductCategory) => {
    const nextTopic = getDefaultContentTopic(productCategory, dailySlot);
    setContentTopic(nextTopic);
    setContentNonce(0);
    updateParams((current) => {
      const nextImageType = current.imageType;
      return {
        ...current,
        productCategory,
        modelChoice: productCategory === "婚纱 / 礼服" ? "亚洲新娘感模特 25–35" : "轻熟风裙装模特 28–40",
        scenePreference: isSceneCompatibleWithImageType(productCategory, nextImageType, current.scenePreference)
          ? current.scenePreference
          : "自动匹配"
      };
    });
  };

  const handleImageTypeChange = (imageType: ImageType) => {
    updateParams((current) => ({
      ...current,
      imageType,
      scenePreference: isSceneCompatibleWithImageType(current.productCategory, imageType, current.scenePreference)
        ? current.scenePreference
        : "自动匹配"
    }));
  };

  const handleGeneratePrompt = () => {
    const nextParams = { ...params, generationNonce: params.generationNonce + 1 };
    setParams(nextParams);
    setGeneratedPrompt(generatePrompt(nextParams).prompt);
    setHasPendingChanges(false);
    setCopyStatus("");
  };

  const syncPromptParams = () => {
    if (!hasPendingChanges) return params;
    const nextParams = { ...params, generationNonce: params.generationNonce + 1 };
    setParams(nextParams);
    setGeneratedPrompt(generatePrompt(nextParams).prompt);
    setHasPendingChanges(false);
    return nextParams;
  };

  const copyText = async (text: string, successMessage: string, setStatus: (message: string) => void) => {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
  };

  const handleGenerateContent = () => {
    const syncedParams = syncPromptParams();
    const nextContentNonce = contentNonce + 1;
    setContentNonce(nextContentNonce);
    const nextContent = generateFashionSeedingContent({
      productCategory: syncedParams.productCategory,
      baseParams: syncedParams,
      imageCount,
      topic: contentTopic,
      dailySlot,
      contentNonce: nextContentNonce
    });
    setContent(nextContent);
    setContentCopyStatus("");
    setExpandedPrompts({});
  };

  return (
    <main className="min-h-screen bg-aura-cream px-4 py-7 text-aura-charcoal sm:px-7 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-7">
        <header className="grid gap-4 border-b border-aura-beige/80 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-aura-muted">Demo content workflow</p>
            <h1 className="text-3xl font-semibold tracking-tight text-aura-charcoal sm:text-4xl">
              Bridal & Dress Content Studio
            </h1>
            <p className="text-base leading-7 text-aura-muted">
              为婚纱馆、礼服品牌和裙装品牌准备的内容生成 Demo。选择品类、场景、模特和光线，自动生成小红书文案与图片 Prompt。
            </p>
          </div>
          <div className="rounded-xl bg-[#F6ECEA] px-4 py-3 text-sm leading-6 text-aura-muted ring-1 ring-[#E8CFC9]">
            前端本地演示，不登录，不接真实生图 API。
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className={panelClass}>
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-aura-charcoal">参数选择</h2>
              <p className="mt-2 text-sm leading-6 text-aura-muted">选择品类、款式、场景和光线，参考图只做本地预览。</p>
            </div>

            <div className="space-y-5">
              <label className="block space-y-2">
                <span className={labelClass}>品类</span>
                <select
                  className={inputClass}
                  value={params.productCategory}
                  onChange={(event) => handleCategoryChange(event.target.value as ProductCategory)}
                >
                  {productCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>款式</span>
                <select
                  className={inputClass}
                  value={params.productCategory === "婚纱 / 礼服" ? params.bridalStyle : params.dressStyle}
                  onChange={(event) => {
                    if (params.productCategory === "婚纱 / 礼服") {
                      updateParams((current) => updateField(current, "bridalStyle", event.target.value as BridalStyle));
                    } else {
                      updateParams((current) => updateField(current, "dressStyle", event.target.value as DressStyle));
                    }
                  }}
                >
                  {(params.productCategory === "婚纱 / 礼服" ? bridalStyleOptions : dressStyleOptions).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>自定义款式名称</span>
                <input
                  className={inputClass}
                  value={params.customProductName}
                  onChange={(event) => updateParams((current) => updateField(current, "customProductName", event.target.value))}
                  placeholder="例如：Pearl Satin A-line / 城市通勤针织裙"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>图片类型</span>
                  <select className={inputClass} value={params.imageType} onChange={(event) => handleImageTypeChange(event.target.value as ImageType)}>
                    {imageTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className={labelClass}>季节</span>
                  <select
                    className={inputClass}
                    value={params.season}
                    onChange={(event) => updateParams((current) => updateField(current, "season", event.target.value as Season))}
                  >
                    {seasonOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>模特选择</span>
                <select
                  className={inputClass}
                  value={params.modelChoice}
                  onChange={(event) => updateParams((current) => updateField(current, "modelChoice", event.target.value as ModelChoice))}
                >
                  {FASHION_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>光线</span>
                  <select
                    className={inputClass}
                    value={params.lightPreference}
                    onChange={(event) => updateParams((current) => updateField(current, "lightPreference", event.target.value as LightPreference))}
                  >
                    {lightPreferenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className={labelClass}>场景偏好</span>
                  <select
                    className={inputClass}
                    value={params.scenePreference}
                    onChange={(event) => updateParams((current) => updateField(current, "scenePreference", event.target.value as ScenePreference))}
                  >
                    {sceneOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <span className={labelClass}>上传参考图 Demo</span>
                <ReferenceImageUploader onChange={(files) => setReferenceImageCount(files.length)} />
                {referenceImageCount > 0 && <p className={hintClass}>已选择 {referenceImageCount} 张参考图，仅用于当前页面预览。</p>}
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>补充要求</span>
                <textarea
                  className={`${inputClass} min-h-28`}
                  value={params.extraRequirement}
                  onChange={(event) => updateParams((current) => updateField(current, "extraRequirement", event.target.value))}
                  placeholder="例如：更强调缎面垂坠；不要夸张摆拍；背景保留酒店窗边晨光。"
                />
              </label>

              <button className={`${primaryButtonClass} w-full`} type="button" onClick={handleGeneratePrompt}>
                生成 Prompt
              </button>
            </div>
          </div>

          <div className={`${panelClass} flex flex-col`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-aura-charcoal">最终英文 Prompt</h2>
                <p className="mt-2 text-sm leading-6 text-aura-muted">{parameterSummary}</p>
              </div>
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => copyText(generatedPrompt, "已复制最终英文 Prompt。", setCopyStatus)}
              >
                一键复制
              </button>
            </div>

            {hasPendingChanges && (
              <p className="mb-3 rounded-xl bg-[#F6ECEA] px-3 py-2 text-xs leading-5 text-aura-muted ring-1 ring-[#E8CFC9]">
                参数已变化，点击生成 Prompt 后会刷新右侧内容。
              </p>
            )}

            <pre className="aura-scrollbar min-h-[520px] flex-1 whitespace-pre-wrap rounded-xl bg-white/75 p-4 text-sm leading-7 text-aura-charcoal ring-1 ring-aura-beige">
              {generatedPrompt}
            </pre>
            {copyStatus && <p className="mt-3 text-sm text-aura-muted">{copyStatus}</p>}
          </div>
        </section>

        <section className="space-y-5 border-t border-aura-beige/80 pt-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-aura-charcoal">小红书内容 Demo</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-aura-muted">
                基于当前参数生成中文文案和 3 / 5 张配图方案。每张配图都有独立英文 Prompt，不调用真实生图 API。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => copyText(formatFashionSeedingContent(content), "已复制小红书内容全文。", setContentCopyStatus)}
              >
                复制全文
              </button>
              <button className={primaryButtonClass} type="button" onClick={handleGenerateContent}>
                生成内容
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.7fr_0.7fr]">
            <label className="block space-y-2">
              <span className={labelClass}>内容主题</span>
              <select
                className={inputClass}
                value={contentTopic}
                onChange={(event) => {
                  setContentTopic(event.target.value as FashionSeedingTopic);
                  setContentNonce(0);
                }}
              >
                {contentTopicOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className={labelClass}>今日篇次</span>
              <select
                className={inputClass}
                value={dailySlot}
                onChange={(event) => {
                  setDailySlot(Number(event.target.value) as FashionSeedingDailySlot);
                  setContentNonce(0);
                }}
              >
                {fashionSeedingDailySlotOptions.map((option) => (
                  <option key={option} value={option}>
                    今日第 {option} 篇
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className={labelClass}>配图数量</span>
              <select className={inputClass} value={imageCount} onChange={(event) => setImageCount(Number(event.target.value) as 3 | 5)}>
                {imageCountOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} 张
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4 rounded-2xl bg-white/75 p-5 ring-1 ring-aura-beige/70">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-aura-muted">
                  {content.dateKey}｜今日第 {content.dailySlot} 篇｜{content.variantLabel}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-aura-charcoal">{content.topic}</h3>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-aura-charcoal">标题备选</h4>
                {content.titles.map((title) => (
                  <p key={title} className="rounded-xl bg-aura-cream px-3 py-2 text-sm text-aura-charcoal ring-1 ring-aura-beige/70">
                    {title}
                  </p>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-aura-charcoal">正文</h4>
                <p className="whitespace-pre-line rounded-xl bg-aura-cream px-4 py-3 text-sm leading-7 text-aura-charcoal ring-1 ring-aura-beige/70">
                  {content.body}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-aura-charcoal">标签</h4>
                <div className="flex flex-wrap gap-2">
                  {content.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#EEF0E8] px-3 py-1 text-xs text-aura-muted ring-1 ring-[#DDE1D1]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-aura-charcoal">内容逻辑</h4>
                <p className="rounded-xl bg-[#F6ECEA] px-4 py-3 text-sm leading-6 text-aura-muted ring-1 ring-[#E8CFC9]">{content.note}</p>
              </div>

              {contentCopyStatus && <p className="text-sm text-aura-muted">{contentCopyStatus}</p>}
            </div>

            <div className="grid gap-4">
              {content.images.map((image, index) => (
                <article key={`${image.name}-${index}`} className="rounded-2xl bg-white/80 p-5 ring-1 ring-aura-beige/70">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-aura-charcoal">{image.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-aura-muted">{image.purpose}</p>
                    </div>
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={() => copyText(image.prompt, `已复制 ${image.name} 的英文 Prompt。`, setContentCopyStatus)}
                    >
                      复制这张 Prompt
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm leading-6 text-aura-muted sm:grid-cols-2">
                    <p className="rounded-xl bg-aura-cream px-3 py-2 ring-1 ring-aura-beige/70">配图建议：{image.description}</p>
                    <p className="rounded-xl bg-aura-cream px-3 py-2 ring-1 ring-aura-beige/70">
                      参数：{image.params.imageType}｜{image.params.scenePreference}｜{image.params.lightPreference}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={() => setExpandedPrompts((current) => ({ ...current, [index]: !current[index] }))}
                    >
                      {expandedPrompts[index] ? "收起完整英文 Prompt" : "查看完整英文 Prompt"}
                    </button>
                    <span className="text-xs text-aura-muted">暂不接入真实生图 API。</span>
                  </div>

                  {expandedPrompts[index] && (
                    <pre className="aura-scrollbar mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-aura-cream p-4 text-xs leading-6 text-aura-charcoal ring-1 ring-aura-beige/70">
                      {image.prompt}
                    </pre>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
