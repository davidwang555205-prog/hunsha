/**
 * StudioPage -- 内容生成页（V2，苹果风格）
 *
 * 登录后默认页。布局：左侧参数表单 + 参考图，右侧内容预览。
 * 类目由顶栏切换（CategoryContext），本页据类目 engine 决定内容引擎（当前 bridal_fashion）。
 *
 * 生图改为异步任务：点击"生成"提交任务 -> TaskProgressCard 展示进度 -> 完成展示结果。
 * 用户退出页面任务继续后台运行，重新进入可恢复进度（localStorage 记 lastTaskId）。
 *
 * 核心资产复用：generateFashionSeedingContent 内容引擎、ParamsForm、ImageGallery 不动。
 */
import { useMemo, useState } from "react";
import {
  fashionSeedingDailySlotOptions,
  formatFashionSeedingContent,
  generateFashionSeedingContent,
  getFashionSeedingTopicOptions,
  type FashionSeedingDailySlot,
  type FashionSeedingTopic
} from "../utils/generateFashionSeedingContent";
import { copyText as copyToClipboard } from "../lib/clipboard";
import { downloadImages } from "../lib/download";
import { fileToDataUrl } from "../lib/file";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useCategory } from "../context/CategoryContext";
import { useTaskGeneration } from "../hooks/useTaskGeneration";
import type { CreateTaskRequest } from "../types/api";
import type { PromptParams } from "../types";
import {
  defaultImageQuality,
  getDefaultContentTopic,
  initialContentTopic,
  initialParams,
  inputClass,
  labelClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass
} from "../studio/constants";
import { ParamsForm } from "../components/studio/ParamsForm";
import { ImageGallery } from "../components/studio/ImageGallery";
import { ReferenceImageUploader } from "../components/ReferenceImageUploader";
import { TaskProgressCard } from "../components/studio/TaskProgressCard";
import { PageHeader } from "../components/layout/PageHeader";

const lastTaskStorageKey = "bridal-content-studio-last-task";

export function StudioPage() {
  const { session } = useAuth();
  const { refresh } = useData();
  const { currentCategory } = useCategory();
  const gen = useTaskGeneration();

  const [params, setParams] = useState<PromptParams>(initialParams);
  const [contentTopic, setContentTopic] = useState<FashionSeedingTopic>(initialContentTopic);
  const [dailySlot, setDailySlot] = useState<FashionSeedingDailySlot>(1);
  const [contentNonce, setContentNonce] = useState(0);
  const [imageCount, setImageCount] = useState<3 | 5>(3);
  const [contentMessage, setContentMessage] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [size, setSize] = useState("1152x1536");
  const [quality, setQuality] = useState(defaultImageQuality);

  const contentTopicOptions = useMemo(() => getFashionSeedingTopicOptions(params.productCategory), [params.productCategory]);
  const contentPreview = useMemo(
    () =>
      generateFashionSeedingContent({
        productCategory: params.productCategory,
        baseParams: params,
        imageCount,
        topic: contentTopic,
        dailySlot,
        contentNonce
      }),
    [contentNonce, contentTopic, dailySlot, imageCount, params]
  );

  const updateParams = (updater: (current: PromptParams) => PromptParams) => setParams((current) => updater(current));

  const handleCategoryChange = (productCategory: typeof params.productCategory) => {
    const nextTopic = getDefaultContentTopic(productCategory, dailySlot);
    setContentTopic(nextTopic);
    setContentNonce(0);
  };

  const copyText = async (text: string, message: string) => {
    await copyToClipboard(text);
    setContentMessage(message);
  };

  // 组装异步任务请求
  const buildTaskRequest = async (): Promise<CreateTaskRequest | null> => {
    if (!session) return null;
    const promptParamsList = contentPreview.images.map((image) => ({
      ...image.params,
      generatedImageName: image.name
    }));
    const referenceImages = await Promise.all(
      referenceFiles.slice(0, 4).map(async (file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: await fileToDataUrl(file)
      }))
    );
    return {
      promptParamsList,
      title: contentPreview.titles[0],
      body: contentPreview.body,
      tags: contentPreview.tags,
      topic: contentPreview.topic,
      referenceImages,
      size,
      quality,
      categoryId: currentCategory?.id
    };
  };

  const handleGenerate = async () => {
    setContentMessage("");
    const req = await buildTaskRequest();
    if (!req) return;
    const taskId = await gen.submit(req);
    if (taskId) {
      window.localStorage.setItem(lastTaskStorageKey, taskId);
      setContentMessage("已加入生成队列，可在下方查看进度。");
    }
  };

  const handleRetry = async () => {
    gen.reset();
    await handleGenerate();
  };

  const handleDismiss = () => {
    gen.reset();
    window.localStorage.removeItem(lastTaskStorageKey);
    void refresh();
  };

  // 任务完成后刷新历史
  const completedImages = gen.stage === "completed" ? gen.resultImages : [];

  return (
    <>
      <PageHeader
        title={currentCategory?.name ?? "内容生成"}
        subtitle="选择参数，一键生成小红书图文内容。生成过程在后台运行，可随时查看进度。"
      />

      {/* 异步任务进度卡片（进行中/完成时置顶） */}
      {gen.stage !== "idle" && (
        <TaskProgressCard
          task={gen.task}
          stage={gen.stage}
          progress={gen.progress}
          completedCount={gen.completedCount}
          totalCount={gen.totalCount}
          subTaskStatus={gen.subTaskStatus}
          isSubmitting={gen.isSubmitting}
          onCancel={gen.cancel}
          onRetry={handleRetry}
          onDismiss={handleDismiss}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* 左：参数表单 + 参考图 */}
        <section className={panelClass}>
          <h2 className="mb-4 text-base font-semibold text-text">生成参数</h2>
          <ParamsForm
            value={params}
            onParamsChange={updateParams}
            onCategoryChange={handleCategoryChange}
            dailySlot={dailySlot}
            size={size}
            onSizeChange={setSize}
            quality={quality}
            onQualityChange={setQuality}
          />

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-text">参考图（最多 4 张）</h3>
            <ReferenceImageUploader files={referenceFiles} onChange={setReferenceFiles} />
          </div>
        </section>

        {/* 右：内容预览 */}
        <section className={panelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text">小红书内容</h2>
            <div className="flex flex-wrap gap-2">
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => copyText(formatFashionSeedingContent(contentPreview), "已复制小红书内容全文。")}
              >
                复制全文
              </button>
              <button
                className={secondaryButtonClass}
                type="button"
                disabled={gen.isActive || gen.isSubmitting}
                onClick={() => {
                  setContentMessage("");
                  setContentNonce((c) => c + 1);
                }}
              >
                换一版
              </button>
              <button
                className={primaryButtonClass}
                type="button"
                disabled={gen.isActive || gen.isSubmitting}
                onClick={handleGenerate}
              >
                {gen.isSubmitting ? "提交中..." : `开始生成 ${imageCount} 张图`}
              </button>
            </div>
          </div>

          {/* 主题/篇次/配图数 */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className={labelClass}>内容主题</span>
              <select
                className={inputClass}
                value={contentTopic}
                onChange={(event) => {
                  setContentTopic(event.target.value as FashionSeedingTopic);
                  setContentMessage("");
                  setContentNonce(0);
                }}
              >
                {contentTopicOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>今日篇次</span>
              <select
                className={inputClass}
                value={dailySlot}
                onChange={(event) => {
                  setDailySlot(Number(event.target.value) as FashionSeedingDailySlot);
                  setContentMessage("");
                  setContentNonce(0);
                }}
              >
                {fashionSeedingDailySlotOptions.map((option) => (
                  <option key={option} value={option}>今日第 {option} 篇</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>配图数量</span>
              <select
                className={inputClass}
                value={imageCount}
                onChange={(event) => {
                  setImageCount(Number(event.target.value) as 3 | 5);
                  setContentMessage("");
                }}
              >
                <option value={3}>3 张</option>
                <option value={5}>5 张</option>
              </select>
            </label>
          </div>

          {/* 内容预览 */}
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                {contentPreview.dateKey}｜今日第 {contentPreview.dailySlot} 篇｜{contentPreview.variantLabel}
              </p>
              <h3 className="mt-1.5 text-lg font-semibold text-text">{contentPreview.topic}</h3>
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-medium text-text">标题备选</h4>
              {contentPreview.titles.map((title) => (
                <p key={title} className="mb-1 rounded-md bg-bg px-3 py-2 text-sm text-text ring-1 ring-border/70">
                  {title}
                </p>
              ))}
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-medium text-text">正文</h4>
              <p className="whitespace-pre-line rounded-md bg-bg px-4 py-3 text-sm leading-7 text-text ring-1 ring-border/70">
                {contentPreview.body}
              </p>
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-medium text-text">标签</h4>
              <div className="flex flex-wrap gap-2">
                {contentPreview.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/5 px-3 py-1 text-xs text-text-muted ring-1 ring-border">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {contentMessage && <p className="mt-3 text-sm text-text-muted">{contentMessage}</p>}
        </section>
      </div>

      {/* 生成结果展示 */}
      {completedImages.length > 0 && (
        <section className={panelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text">生成结果</h2>
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={() => downloadImages(completedImages, contentPreview.titles[0])}
            >
              一键下载 {completedImages.length} 张图
            </button>
          </div>
          <ImageGallery images={completedImages} altPrefix={contentPreview.titles[0]} columns={3} />
        </section>
      )}
    </>
  );
}
