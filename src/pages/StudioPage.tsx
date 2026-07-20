/**
 * StudioPage -- 内容生成页（V2，苹果风格）
 *
 * 布局（自上而下全宽）：参考图 → 生成设置 → 生成结果 → 小红书内容（含内容逻辑）。
 * 生图参数全部内置（initialParams），用户只选主题/篇次/配图数 + 传参考图 + 点生成。
 * 生图异步任务：提交 -> 状态条 + 结果区 skeleton 逐张填充 -> 完成展示结果。
 * 用户退出页面任务继续后台运行，重新进入可恢复进度（localStorage 记 lastTaskId）。
 *
 * 换一版：随机选「当前账号+类目+主题+篇次」下未用过的变体（localStorage 去重），
 * 用尽后提示并重新开始。核心内容引擎不动。
 */
import { useEffect, useRef, useState } from "react";
import { type FashionSeedingContent, type FashionSeedingDailySlot, type FashionSeedingTopic } from "../utils/fashionSeeding";
import { generateContent } from "../api/admin";
import { getEngineCapabilities, getEngineTopicOptions } from "../api/engines";
import { copyText as copyToClipboard } from "../lib/clipboard";
import { downloadImages } from "../lib/download";
import { fileToDataUrl } from "../lib/file";
import { firstTitle } from "../lib/titles";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useCategory } from "../context/CategoryContext";
import { useNotifications } from "../context/NotificationContext";
import { useTaskGeneration } from "../hooks/useTaskGeneration";
import { describeGenerationFailure } from "../lib/generationFeedback";
import type { CreateTaskRequest } from "../types/api";
import {
  defaultImageQuality,
  defaultImageSize,
  imageSizeOptions,
  initialContentTopic,
  initialParams,
  inputClass,
  labelClass
} from "../studio/constants";
import { ReferenceImageUploader } from "../components/ReferenceImageUploader";
import { TaskProgressCard } from "../components/studio/TaskProgressCard";
import { ImageGenerationGrid } from "../components/studio/ImageGenerationGrid";
import { ReadOnlyReferenceImages } from "../components/studio/ReadOnlyReferenceImages";
import { Button } from "../components/ui/Button";
import { FeedbackAlert } from "../components/ui/FeedbackAlert";
import { Modal } from "../components/ui/Modal";
import { StarBorder } from "../components/motion";
import { GenerationLoadingState } from "../components/studio/GenerationLoadingState";

const lastTaskStorageKey = "bridal-content-studio-last-task";
const viewedTasksKey = "bridal-content-studio-viewed-tasks";

// contentPreview 加载中/失败的空默认（任务②阶段5：contentPreview 从后端 API 异步获取）
const emptyContent = {
  topic: "",
  dateKey: "",
  dailySlot: 1,
  variantIndex: 0,
  variantCount: 1000,
  variantLabel: "",
  titles: [],
  body: "",
  images: [],
  tags: [],
  note: ""
} as unknown as FashionSeedingContent;

export function StudioPage() {
  const { user } = useAuth();
  const { refresh } = useData();
  const { currentCategory } = useCategory();
  const gen = useTaskGeneration();
  const { addNotification } = useNotifications();
  const [showUnviewedPrompt, setShowUnviewedPrompt] = useState(false);
  const reportedFeedbackRef = useRef("");

  // 生图参数：尺寸用户可选（生图设置面板），其余内置
  const params = initialParams;
  const [imageSize, setImageSize] = useState(defaultImageSize);
  const size = imageSize;
  const quality = defaultImageQuality;
  const [contentTopic, setContentTopic] = useState<FashionSeedingTopic>(initialContentTopic);
  // 篇次暂不开放选择，固定为第一篇；保留字段以兼容内容引擎请求契约。
  const dailySlot: FashionSeedingDailySlot = 1;
  const [contentNonce, setContentNonce] = useState(0);
  const [imageCount, setImageCount] = useState<3 | 5>(3);
  const [contentMessage, setContentMessage] = useState("");
  // 二次确认弹窗：组装好请求后先展示本次内容与积分消耗，用户确认后再提交。
  const [showConfirmGenerate, setShowConfirmGenerate] = useState(false);
  const [pendingTaskReq, setPendingTaskReq] = useState<CreateTaskRequest | null>(null);
  // 单张重试确认弹窗（部分成功时，对失败/取消的子图单独重试）
  const [showRetryImageConfirm, setShowRetryImageConfirm] = useState(false);
  const [retryImageTarget, setRetryImageTarget] = useState<{ imageNumber: number; name: string } | null>(null);
  // 任务整体重试上限：超过则不再重试，引导用户创建新任务（避免对同一组素材反复提交）。
  // 单张图的后端自动重试上限由 WalaImageRetryAttempts(=3) 控制，在此之外另加任务级手动重试限制。
  const maxTaskRetry = 3;
  const [taskRetryCount, setTaskRetryCount] = useState(0);
  // 确认弹窗防重入：消除「关闭弹窗→setIsSubmitting 生效」毫秒级窗口内的重复提交
  const confirmingRef = useRef(false);
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [copyEnabled, setCopyEnabled] = useState(true);

  // 进入页面：恢复上次任务进度（任务在后端继续，重新进入可拉回状态）
  useEffect(() => {
    const lastId = window.localStorage.getItem(lastTaskStorageKey);
    if (lastId) {
      void gen.resume(lastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 任务终态：写本地通知 + 未查看成功任务弹窗提示 + 刷新积分余额/历史
  useEffect(() => {
    if (!gen.task || !gen.task.id) return;
    // 终态刷新：生成消耗积分后 header 余额实时更新（refresh 并发拉 /status + history，refreshUser 更新 user.credits）
    if (gen.stage === "completed" || gen.stage === "failed") {
      void refresh();
    }
    const viewed = JSON.parse(window.localStorage.getItem(viewedTasksKey) || "[]") as string[];
    if (gen.stage === "completed") {
      addNotification({
        type: "success",
        title: "生成完成",
        body: `「${firstTitle(gen.task.title)}」已生成 ${gen.task.resultImages?.length ?? 0} 张图`,
        taskId: gen.task.id,
      });
      if (!viewed.includes(gen.task.id)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowUnviewedPrompt(true);
      }
    } else if (gen.stage === "failed") {
      const feedback = describeGenerationFailure(gen.task.error);
      addNotification({
        type: "failed",
        title: feedback.title,
        body: feedback.message,
        taskId: gen.task.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.stage, gen.task?.id]);

  // 提交阶段在创建任务前就失败时没有 taskId，单独写一条通知；ref 防止同一错误因重渲染重复提示。
  useEffect(() => {
    if (!gen.error) {
      reportedFeedbackRef.current = "";
      return;
    }
    const key = `${gen.task?.id ?? "submit"}:${gen.error.title}:${gen.error.message}`;
    if (reportedFeedbackRef.current === key) return;
    reportedFeedbackRef.current = key;
    addNotification({
      type: "failed",
      title: gen.error.title,
      body: gen.error.message,
      taskId: gen.task?.id
    });
  }, [addNotification, gen.error, gen.task?.id]);

  const [engineTopicOptions, setEngineTopicOptions] = useState<FashionSeedingTopic[]>([]);
  const [loadedTopicOptionsKey, setLoadedTopicOptionsKey] = useState("");
  const engineTopicOptionsKey = `${currentCategory?.engine ?? ""}:${params.productCategory}`;
  const contentTopicOptions = loadedTopicOptionsKey === engineTopicOptionsKey ? engineTopicOptions : [];
  const [contentPreview, setContentPreview] = useState<FashionSeedingContent>(emptyContent);

  // 文案能力由当前引擎决定。类目未绑定引擎时保持旧婚纱行为，避免工作台闪烁为空态。
  useEffect(() => {
    const engineKey = currentCategory?.engine;
    if (!engineKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCopyEnabled(true);
      return;
    }
    let cancelled = false;
    getEngineCapabilities(engineKey)
      .then(({ copyEnabled: enabled }) => {
        if (!cancelled) setCopyEnabled(enabled);
      })
      .catch(() => {
        if (!cancelled) setCopyEnabled(true);
      });
    return () => { cancelled = true; };
  }, [currentCategory?.engine]);

  // 主题列表完全由内容引擎 config.seeding 的 bridalTopics / dressTopics 决定。
  useEffect(() => {
    const engineKey = currentCategory?.engine;
    if (!engineKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadedTopicOptionsKey(engineTopicOptionsKey);
      setEngineTopicOptions([]);
      return;
    }
    let cancelled = false;
    setLoadedTopicOptionsKey("");
    getEngineTopicOptions(engineKey, params.productCategory)
      .then(({ topics }) => {
        if (cancelled) return;
        // 服务端旧配置或异常数据可能把数组序列化为 null；工作台应保持可用的加载空态，
        // 不能因单个引擎配置导致整页 React 卸载。
        const nextOptions = (Array.isArray(topics) ? topics : [])
          .filter((topic): topic is string => typeof topic === "string" && topic.trim() !== "") as FashionSeedingTopic[];
        setEngineTopicOptions(nextOptions);
        setContentTopic((current) => nextOptions.includes(current) ? current : (nextOptions[0] ?? ""));
        setContentNonce(0);
        setLoadedTopicOptionsKey(engineTopicOptionsKey);
      })
      .catch(() => {
        if (cancelled) return;
        setEngineTopicOptions([]);
        setContentPreview(emptyContent);
      });
    return () => {
      cancelled = true;
    };
  }, [currentCategory?.engine, engineTopicOptionsKey, params.productCategory]);

  // 任务②阶段5：contentPreview 从后端 API 获取（POST /api/engines/:key/generate），
  // 替代本地 generateFashionSeedingContent。后端 byte-for-byte 等价 + config 覆盖素材。
  // currentCategory.engine 软关联 content_engines.key；无 engine 则空内容。
  useEffect(() => {
    const engineKey = currentCategory?.engine;
    if (!engineKey || loadedTopicOptionsKey !== engineTopicOptionsKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContentPreview(emptyContent);
      return;
    }
    let cancelled = false;
    generateContent(engineKey, {
      productCategory: params.productCategory,
      baseParams: params,
      imageCount,
      topic: contentTopic,
      dailySlot,
      contentNonce
    })
      .then(({ content }) => {
        if (!cancelled) {
          setContentPreview(content);
          if (contentNonce > 0) setContentMessage("已切换一套内容与配图方案。");
        }
      })
      .catch(() => {
        if (!cancelled) setContentPreview(emptyContent);
      });
    return () => {
      cancelled = true;
    };
  }, [contentNonce, contentTopic, dailySlot, imageCount, params, currentCategory?.engine, engineTopicOptionsKey, loadedTopicOptionsKey]);

  const copyText = async (text: string, message: string) => {
    await copyToClipboard(text);
    setContentMessage(message);
  };

  // 组装异步任务请求
  const buildTaskRequest = async (): Promise<CreateTaskRequest | null> => {
    if (!user) return null;
    if (loadedTopicOptionsKey !== engineTopicOptionsKey || contentPreview.images.length === 0) {
      setContentMessage("内容主题加载中，请稍后再生成。");
      return null;
    }
    // 产品图 4~6 张必传校验（前端拦，后端兜底再校验）
    if (productFiles.length < 4) {
      setContentMessage(`请上传至少 4 张婚纱产品图（当前 ${productFiles.length} 张）。`);
      return null;
    }
    const sceneLocked = !!sceneFile;
    const previewTitles = Array.isArray(contentPreview.titles) ? contentPreview.titles : [];
    const previewTags = Array.isArray(contentPreview.tags) ? contentPreview.tags : [];
    const promptParamsList = contentPreview.images.map((image) => ({
      ...image.params,
      generatedImageName: image.name,
      sceneLocked
    }));
    const toUpload = async (file: File) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await fileToDataUrl(file)
    });
    const sceneReferenceImage = sceneFile ? await toUpload(sceneFile) : undefined;
    const productReferenceImages = await Promise.all(productFiles.map(toUpload));
    return {
      promptParamsList,
      title: previewTitles.join("\n"),
      body: contentPreview.body,
      tags: previewTags,
      topic: contentPreview.topic,
      sceneReferenceImage,
      productReferenceImages,
      size,
      quality,
      categoryId: currentCategory?.id
    };
  };

  const handleGenerate = async () => {
    setContentMessage("");
    try {
      const req = await buildTaskRequest();
      if (!req) return;
      // 二次确认：先弹窗展示本次提交内容与积分消耗，用户确认后再真正提交。
      setPendingTaskReq(req);
      setShowConfirmGenerate(true);
    } catch (err) {
      gen.reportError(err);
    }
  };

  // 用户在确认弹窗点击「确认生成」后真正提交任务
  const confirmGenerate = async () => {
    if (confirmingRef.current) return;
    const req = pendingTaskReq;
    if (!req) return;
    confirmingRef.current = true;
    setShowConfirmGenerate(false);
    try {
      const taskId = await gen.submit(req);
      if (taskId) {
        window.localStorage.setItem(lastTaskStorageKey, taskId);
        setContentMessage("已加入生成队列，结果区将逐张显示生成进度。");
      }
    } catch (err) {
      gen.reportError(err);
    } finally {
      setPendingTaskReq(null);
      confirmingRef.current = false;
    }
  };

  const cancelConfirmGenerate = () => {
    setShowConfirmGenerate(false);
    setPendingTaskReq(null);
  };

  // 单张重试：点失败/取消子图的「重试」-> 弹窗确认 -> gen.retryImage
  const handleRetryImageClick = (imageNumber: number, name: string) => {
    setRetryImageTarget({ imageNumber, name });
    setShowRetryImageConfirm(true);
  };
  const confirmRetryImage = async () => {
    if (!retryImageTarget) return;
    if (taskRetryCount >= maxTaskRetry) return;
    const { imageNumber } = retryImageTarget;
    setShowRetryImageConfirm(false);
    setRetryImageTarget(null);
    setTaskRetryCount((c) => c + 1);
    await gen.retryImage(imageNumber);
  };
  const cancelRetryImage = () => {
    setShowRetryImageConfirm(false);
    setRetryImageTarget(null);
  };

  // 文案引擎的“换一套内容”：contentNonce 会让后端重新选择同主题的一套文案与配图蓝图。
  // 已提交任务后不允许替换，避免展示文案与任务内图片计划脱节。
  const handleChangeContent = () => {
    if (!copyEnabled || gen.stage !== "idle") return;
    setContentNonce((current) => current + 1);
  };

  const handleRetry = async () => {
    if (taskRetryCount >= maxTaskRetry) return;
    setTaskRetryCount((c) => c + 1);
    gen.reset();
    await handleGenerate();
  };

  const handleDismiss = () => {
    gen.reset();
    setTaskRetryCount(0);
    setShowRetryImageConfirm(false);
    setRetryImageTarget(null);
    window.localStorage.removeItem(lastTaskStorageKey);
    void refresh();
  };

  const handleViewLastTask = () => {
    if (!gen.task) return;
    const viewed = JSON.parse(window.localStorage.getItem(viewedTasksKey) || "[]") as string[];
    if (!viewed.includes(gen.task.id)) {
      viewed.push(gen.task.id);
      window.localStorage.setItem(viewedTasksKey, JSON.stringify(viewed));
    }
    setShowUnviewedPrompt(false);
  };

  const sizeLabel = imageSizeOptions.find((option) => option.value === imageSize)?.label ?? imageSize;
  const hasAnySuccess = gen.subTaskStatus.some((s) => s.status === "success");
  // 失败任务分流：全部失败 -> 整任务重试；至少 1 张成功 -> 单张重试失败子图
  const allFailed = gen.stage === "failed" && !hasAnySuccess;
  const canRetrySingleImage = gen.stage === "failed" && hasAnySuccess && taskRetryCount < maxTaskRetry;
  const completedImages = gen.stage === "completed" ? gen.resultImages : [];
  // 提交请求上传参考图时后端尚未回 taskId：此时也要立刻把右侧切到交付态，
  // 不能让用户在数秒内误以为点击没有生效。
  const hasTaskOutput = gen.stage !== "idle" || gen.isSubmitting;
  // 恢复态且本地无 File（重新进入页面，File 已丢失）：只读回显后端存的参考图
  const showReadOnlyReference =
    gen.stage !== "idle" &&
    !sceneFile &&
    productFiles.length === 0 &&
    (gen.task?.referenceImages?.length ?? 0) > 0;
  const resultBody = gen.task?.body || contentPreview.body;
  const previewTitles = Array.isArray(contentPreview.titles) ? contentPreview.titles : [];
  const previewTags = Array.isArray(contentPreview.tags) ? contentPreview.tags : [];
  const resultTags = Array.isArray(gen.task?.tags) ? gen.task.tags : previewTags;
  const resultTopic = gen.task?.topic || contentPreview.topic;
  const contentReady = copyEnabled && (resultBody.trim() !== "" || resultTags.length > 0);

  return (
    <>
      <div className="grid h-full min-h-0 bg-bg lg:grid-cols-[368px_minmax(0,1fr)]">
        {/* 左栏是完整操作区：中间内容独立滚动，生成按钮永久停在底部。 */}
        <section className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
          <div className="brand-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
            <div className="border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">创作工作台</p>
              <h1 className="mt-1 text-xl font-semibold text-text">{currentCategory?.name ?? "婚纱"}</h1>
              <p className="mt-1 text-xs leading-5 text-text-muted">上传参考图并完成设置，结果会实时显示在右侧。</p>
            </div>

            <div className="border-b border-border py-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">01 / 素材</p>
                  <h2 className="mt-1 text-base font-semibold text-text">上传创作参考</h2>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">产品图 4–6 张</span>
              </div>
              {showReadOnlyReference ? (
                <ReadOnlyReferenceImages images={gen.task?.referenceImages ?? []} />
              ) : (
                <div className="space-y-5">
                  <ReferenceImageUploader
                    files={sceneFile ? [sceneFile] : []}
                    onChange={(files) => setSceneFile(files[0] ?? null)}
                    label="场景参考图"
                    hint="可选。上传后将锁定相同的场景氛围。"
                    maxCount={1}
                  />
                  <ReferenceImageUploader
                    files={productFiles}
                    onChange={setProductFiles}
                    label="婚纱产品图"
                    hint="前 4 张必传，第 5、6 张可补充细节。"
                    maxCount={6}
                    minCount={4}
                    required
                  />
                </div>
              )}
            </div>

            <div className="py-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">02 / 配置</p>
                <h2 className="mt-1 text-base font-semibold text-text">设定本次内容</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <label className="block space-y-1.5">
                  <span className={labelClass}>{copyEnabled ? "内容主题" : "创作主题"}</span>
                  <select className={inputClass} value={contentTopic} disabled={contentTopicOptions.length === 0} onChange={(event) => { setContentTopic(event.target.value as FashionSeedingTopic); setContentMessage(""); setContentNonce(0); }}>
                    {contentTopicOptions.length > 0 ? contentTopicOptions.map((option) => <option key={option} value={option}>{option}</option>) : <option value="">主题加载中...</option>}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className={labelClass}>配图数量</span>
                    <select className={inputClass} value={imageCount} onChange={(event) => { setImageCount(Number(event.target.value) as 3 | 5); setContentMessage(""); }}>
                      <option value={3}>3 张</option>
                      <option value={5}>5 张</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className={labelClass}>图片尺寸</span>
                    <select className={inputClass} value={imageSize} onChange={(event) => { setImageSize(event.target.value); setContentMessage(""); }}>
                      {imageSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-primary/5 p-3 text-xs leading-5 text-text-muted ring-1 ring-primary/10">
                本次将生成 {imageCount} 张 {imageSize} 图片，完成后按独立卡片逐张交付。
              </div>
              {copyEnabled && gen.stage === "idle" && (
                <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={handleChangeContent} disabled={contentTopicOptions.length === 0 || contentPreview.images.length === 0}>
                  换一套内容
                </Button>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-surface p-4">
            <StarBorder
              type="button"
              disabled={gen.isActive || gen.isSubmitting || productFiles.length < 4 || contentTopicOptions.length === 0 || loadedTopicOptionsKey !== engineTopicOptionsKey || contentPreview.images.length === 0}
              onClick={handleGenerate}
              className="w-full"
            >
              {gen.isSubmitting ? "正在建立任务..." : `开始生成 ${imageCount} 张图片`}
            </StarBorder>
            {productFiles.length < 4 && <p className="mt-2 text-xs text-danger">还需上传至少 4 张婚纱产品图（当前 {productFiles.length} 张）。</p>}
            {gen.error && !gen.task && <FeedbackAlert feedback={gen.error} className="mt-3" />}
            {contentMessage && <p className="mt-2 text-xs leading-5 text-text-muted">{contentMessage}</p>}
          </div>
        </section>

        {/* 右侧是占满工作区的交付画布；每张图片和图文内容都以独立卡片交付。 */}
        <section className="brand-scrollbar min-h-0 overflow-y-auto bg-bg p-4 sm:p-6 xl:p-8">
          <div className="min-h-full space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Live delivery</p>
                <h2 className="mt-1 text-xl font-semibold text-text">本次生成结果</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${gen.stage === "completed" ? "bg-success/10 text-success" : gen.isActive || gen.isSubmitting ? "bg-primary/10 text-primary" : "bg-surface text-text-muted ring-1 ring-border"}`}>
                {gen.stage === "completed" ? "已完成" : gen.isActive || gen.isSubmitting ? "生成进行中" : "等待开始"}
              </span>
            </div>

            {gen.stage !== "idle" && (
              <TaskProgressCard
                task={gen.task}
                stage={gen.stage}
                completedCount={gen.completedCount}
                totalCount={gen.totalCount}
                isSubmitting={gen.isSubmitting}
                error={gen.error}
                onCancel={gen.cancel}
                onRetry={allFailed ? handleRetry : undefined}
                onDismiss={handleDismiss}
                retryCount={taskRetryCount}
                maxRetry={maxTaskRetry}
              />
            )}

            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-text">视觉图片</h3>
                  <p className="mt-1 text-xs text-text-muted">图片完成后自动加入下方画廊，可点开预览或单张下载。</p>
                </div>
                {completedImages.length > 0 && <Button variant="secondary" size="sm" onClick={() => void downloadImages(completedImages)}>下载全部 {completedImages.length} 张</Button>}
              </div>
              {hasTaskOutput ? (
                <ImageGenerationGrid
                  subTaskStatus={gen.subTaskStatus}
                  totalCount={gen.totalCount || imageCount}
                  altPrefix={previewTitles[0] ?? currentCategory?.name ?? "生成图片"}
                  canRetryImage={canRetrySingleImage}
                  onRetryImage={canRetrySingleImage ? handleRetryImageClick : undefined}
                />
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-xl text-primary">✦</span>
                  <p className="mt-4 text-sm font-semibold text-text">你的图片将在这里出现</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-text-muted">完成左侧素材与配置后，点击开始生成；我们会保留生成轨迹，并让图片逐张显现。</p>
                </div>
              )}
            </div>

            {copyEnabled && <div className="rounded-lg border border-border bg-bg/50 p-4 sm:p-5">
              <div className="mb-4">
                <div>
                  <h3 className="font-semibold text-text">小红书图文</h3>
                  <p className="mt-1 text-xs text-text-muted">内容生成后立即呈现，可确认或更换后再开始生图。</p>
                </div>
              </div>

              {contentReady ? (
                <button
                  type="button"
                  onClick={() => setShowContentPreview(true)}
                  className="group block w-full rounded-lg border border-border bg-surface p-4 text-left transition duration-base ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  aria-label="查看完整小红书图文"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{resultTopic}</span>
                    <span className="text-xs text-text-muted">{gen.stage === "completed" ? `已为本次 ${completedImages.length} 张图片配套生成` : "内容已生成，可换一套后再开始生图"}</span>
                    <span className="ml-auto text-xs font-medium text-primary">点击查看 →</span>
                  </div>
                  <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6 text-text-muted">{resultBody}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {resultTags.slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-primary/5 px-2.5 py-1 text-xs text-text-muted ring-1 ring-border">{tag}</span>)}
                  </div>
                </button>
              ) : (
                <div className="flex min-h-[190px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 text-center">
                  <GenerationLoadingState compact title="正在生成图文内容" description="内容生成后会先在这里呈现，可确认后再开始生图。" />
                </div>
              )}
            </div>}
          </div>
        </section>
      </div>

      {/* 文案和图片一样先以卡片交付；文案点击后在独立预览层查看与复制。 */}
      <Modal
        open={showContentPreview}
        onClose={() => setShowContentPreview(false)}
        title="小红书图文"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => copyText(resultBody, "已复制正文。")}>
              复制正文
            </Button>
            <Button variant="primary" size="sm" onClick={() => copyText(resultTags.join(" "), "已复制标签。") }>
              复制标签
            </Button>
          </>
        }
      >
        {copyEnabled && <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{resultTopic}</span>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">正文</h4>
            <p className="whitespace-pre-line rounded-md bg-bg px-4 py-3 text-sm leading-7 text-text ring-1 ring-border/70">{resultBody}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {resultTags.map((tag) => <span key={tag} className="rounded-full bg-primary/5 px-3 py-1 text-xs text-text-muted ring-1 ring-border">{tag}</span>)}
          </div>
        </div>}
      </Modal>

      {/* 历史未查看成功任务提示弹窗（统一 Modal，Portal 到 body） */}
      <Modal
        open={showUnviewedPrompt && !!gen.task}
        onClose={() => setShowUnviewedPrompt(false)}
        title="上次生成已完成"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowUnviewedPrompt(false)}>
              忽略
            </Button>
            <Button variant="primary" size="sm" onClick={handleViewLastTask}>
              查看
            </Button>
          </>
        }
      >
        {gen.task && (
          <p className="text-sm text-text-muted">
            「{firstTitle(gen.task.title)}」已生成 {gen.task.resultImages?.length ?? 0} 张图，是否查看结果？
          </p>
        )}
      </Modal>

      {/* 提交生图二次确认：展示本次内容与积分消耗，确认后才提交任务 */}
      <Modal
        open={showConfirmGenerate}
        onClose={cancelConfirmGenerate}
        title="确认生成"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={cancelConfirmGenerate} disabled={gen.isSubmitting}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={confirmGenerate} loading={gen.isSubmitting}>
              确认生成
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">内容主题</dt>
              <dd className="text-right font-medium text-text">{contentTopic || "-"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">配图数量</dt>
              <dd className="font-medium text-text">{imageCount} 张</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">图片尺寸</dt>
              <dd className="font-medium text-text">{sizeLabel}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">婚纱产品图</dt>
              <dd className="font-medium text-text">{productFiles.length} 张</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">场景参考图</dt>
              <dd className="font-medium text-text">{sceneFile ? "已上传，锁定场景" : "未上传"}</dd>
            </div>
          </dl>
          <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-primary/10">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-text-muted">本次消耗</span>
              <span className="text-base font-semibold text-primary">{imageCount} 积分</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-sm text-text-muted">当前余额</span>
              <span className="text-sm font-medium text-text">{user?.credits ?? 0} 积分</span>
            </div>
          </div>
          <p className="text-xs leading-5 text-text-muted">
            每张图片约需 90 秒生成；仅成功生成的图片扣除积分，失败不扣。提交后可在右侧查看逐张进度，期间可离开页面，任务会在后台继续。
          </p>
        </div>
      </Modal>

      {/* 单张重试确认：仅失败任务且有成功图时，对失败/取消子图单独重试，消耗 1 积分 */}
      <Modal
        open={showRetryImageConfirm}
        onClose={cancelRetryImage}
        title="确认重新生成"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={cancelRetryImage} disabled={gen.isRetrying}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={confirmRetryImage} loading={gen.isRetrying}>
              确认重试
            </Button>
          </>
        }
      >
        {retryImageTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-primary/10">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-text-muted">重新生成</span>
                <span className="text-base font-semibold text-text">第 {retryImageTarget.imageNumber} 张</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-sm text-text-muted">本次消耗</span>
                <span className="text-base font-semibold text-primary">1 积分</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-sm text-text-muted">当前余额</span>
                <span className="text-sm font-medium text-text">{user?.credits ?? 0} 积分</span>
              </div>
            </div>
            <p className="text-xs leading-5 text-text-muted">
              将基于原任务参考图与已成功图重新生成这一张，保持人物/场景一致。仅成功生成的图片扣分，失败不扣。生成期间可离开页面，任务会在后台继续。
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
