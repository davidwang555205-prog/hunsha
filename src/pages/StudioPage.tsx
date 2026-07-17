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
import {
  fashionSeedingDailySlotOptions,
  type FashionSeedingContent,
  type FashionSeedingDailySlot,
  type FashionSeedingTopic
} from "../utils/fashionSeeding";
import { generateContent } from "../api/admin";
import { getEngineTopicOptions } from "../api/engines";
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
  labelClass,
  panelClass
} from "../studio/constants";
import { ReferenceImageUploader } from "../components/ReferenceImageUploader";
import { TaskProgressCard } from "../components/studio/TaskProgressCard";
import { ImageGenerationGrid } from "../components/studio/ImageGenerationGrid";
import { ReadOnlyReferenceImages } from "../components/studio/ReadOnlyReferenceImages";
import { Button } from "../components/ui/Button";
import { FeedbackAlert } from "../components/ui/FeedbackAlert";
import { Modal } from "../components/ui/Modal";
import { StarBorder } from "../components/motion";
import { PageHeader } from "../components/layout/PageHeader";

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
  const [dailySlot, setDailySlot] = useState<FashionSeedingDailySlot>(1);
  const [contentNonce, setContentNonce] = useState(0);
  const [imageCount, setImageCount] = useState<3 | 5>(3);
  const [contentMessage, setContentMessage] = useState("");
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);

  // 换一版去重 key：账号 + 类目 + 主题 + 篇次（同内容上下文下不重复）
  const usedVariantsKey = `bridal-content-studio-used-variants:${user?.id ?? "anon"}:${currentCategory?.id ?? "default"}:${contentTopic}:${dailySlot}`;

  const readUsedVariants = (): number[] => {
    try {
      const raw = window.localStorage.getItem(usedVariantsKey);
      if (raw) return JSON.parse(raw) as number[];
    } catch {
      // 损坏数据兜底
    }
    return [0];
  };

  const writeUsedVariants = (list: number[]) => {
    try {
      window.localStorage.setItem(usedVariantsKey, JSON.stringify(list));
    } catch {
      // 写入失败（隐私模式等）静默降级，不影响换一版
    }
  };

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
        const nextOptions = topics.filter((topic) => topic.trim()) as FashionSeedingTopic[];
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
        if (!cancelled) setContentPreview(content);
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

  // 换一版：随机选当前账号+类目+主题+篇次下未用过的变体
  const handleShuffleVariant = () => {
    setContentMessage("");
    const total = contentPreview.variantCount;
    const used = new Set(readUsedVariants());
    used.add(contentNonce); // 当前正在展示的也算已用，避免换回原样
    const candidates: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!used.has(i)) candidates.push(i);
    }
    if (candidates.length === 0) {
      // 本上下文变体已轮换一轮：清空重来（保留当前）
      const fresh: number[] = [];
      for (let i = 0; i < total; i++) {
        if (i !== contentNonce) fresh.push(i);
      }
      const next = fresh[Math.floor(Math.random() * fresh.length)] ?? 0;
      setContentNonce(next);
      writeUsedVariants([contentNonce, next]);
      setContentMessage("本主题变体已轮换一轮，重新开始随机。");
      return;
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    setContentNonce(next);
    writeUsedVariants([...readUsedVariants(), next]);
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
      title: contentPreview.titles.join("\n"),
      body: contentPreview.body,
      tags: contentPreview.tags,
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
      const taskId = await gen.submit(req);
      if (taskId) {
        window.localStorage.setItem(lastTaskStorageKey, taskId);
        setContentMessage("已加入生成队列，结果区将逐张显示生成进度。");
      }
    } catch (err) {
      gen.reportError(err);
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

  const handleViewLastTask = () => {
    if (!gen.task) return;
    const viewed = JSON.parse(window.localStorage.getItem(viewedTasksKey) || "[]") as string[];
    if (!viewed.includes(gen.task.id)) {
      viewed.push(gen.task.id);
      window.localStorage.setItem(viewedTasksKey, JSON.stringify(viewed));
    }
    setShowUnviewedPrompt(false);
  };

  const showResultGrid = gen.stage !== "idle";
  const completedImages = gen.stage === "completed" ? gen.resultImages : [];
  // 恢复态且本地无 File（重新进入页面，File 已丢失）：只读回显后端存的参考图
  const showReadOnlyReference =
    gen.stage !== "idle" &&
    !sceneFile &&
    productFiles.length === 0 &&
    (gen.task?.referenceImages?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={currentCategory?.name ?? "内容生成"}
        subtitle="上传参考图，一键生成小红书图文。参考图与设置、结果与内容分列展示。"
      />

      {/* 异步任务状态条（进行中/完成时置顶） */}
      {gen.stage !== "idle" && (
        <TaskProgressCard
          task={gen.task}
          stage={gen.stage}
          progress={gen.progress}
          completedCount={gen.completedCount}
          totalCount={gen.totalCount}
          isSubmitting={gen.isSubmitting}
          error={gen.error}
          onCancel={gen.cancel}
          onRetry={handleRetry}
          onDismiss={handleDismiss}
        />
      )}

      {/* 行1：参考图 + 生成设置（lg 两列，移动端单列回退） */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
      <section className={panelClass}>
        <h2 className="mb-2 text-base font-semibold text-text">参考图</h2>
        {showReadOnlyReference ? (
          <ReadOnlyReferenceImages images={gen.task?.referenceImages ?? []} />
        ) : (
          <>
            <p className="mb-4 text-sm text-text-muted">上传场景参考图（可选，传了则锁定在该场景生成）与婚纱产品图（4–6 张必传）。</p>
            <div className="space-y-5">
              <ReferenceImageUploader
                files={sceneFile ? [sceneFile] : []}
                onChange={(files) => setSceneFile(files[0] ?? null)}
                label="场景参考图"
                hint="可选，最多 1 张。传了则强制在该场景环境内生成。"
                maxCount={1}
              />
              <ReferenceImageUploader
                files={productFiles}
                onChange={setProductFiles}
                label="婚纱产品图"
                hint="必传，4–6 张婚纱衣服产品图，生成时复用其款式与细节。"
                maxCount={6}
                minCount={4}
                required
              />
            </div>
          </>
        )}
      </section>

      {/* 生成设置（全宽） */}
      <section className={panelClass}>
        <h2 className="mb-3 text-base font-semibold text-text">生成设置</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className={labelClass}>内容主题</span>
            <select
              className={inputClass}
              value={contentTopic}
              disabled={contentTopicOptions.length === 0}
              onChange={(event) => {
                setContentTopic(event.target.value as FashionSeedingTopic);
                setContentMessage("");
                setContentNonce(0);
              }}
            >
              {contentTopicOptions.length > 0 ? contentTopicOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              )) : <option value="">主题加载中...</option>}
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
          <label className="block space-y-1.5">
            <span className={labelClass}>图片尺寸</span>
            <select
              className={inputClass}
              value={imageSize}
              onChange={(event) => {
                setImageSize(event.target.value);
                setContentMessage("");
              }}
            >
              {imageSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <StarBorder
          type="button"
          disabled={gen.isActive || gen.isSubmitting || productFiles.length < 4 || contentTopicOptions.length === 0 || loadedTopicOptionsKey !== engineTopicOptionsKey || contentPreview.images.length === 0}
          onClick={handleGenerate}
          className="w-full"
        >
          {gen.isSubmitting ? "提交中..." : `开始生成 ${imageCount} 张图`}
        </StarBorder>
        {productFiles.length < 4 && (
          <p className="mt-2 text-xs text-danger">请上传至少 4 张婚纱产品图后再生成（当前 {productFiles.length} 张）。</p>
        )}
        {gen.error && !gen.task && <FeedbackAlert feedback={gen.error} className="mt-3" />}
        {contentMessage && <p className="mt-3 text-sm text-text-muted">{contentMessage}</p>}
      </section>
      </div>

      {/* 行2：生成结果 + 小红书内容（lg 两列，移动端单列回退） */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
      <section className={panelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text">生成结果</h2>
          {completedImages.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void downloadImages(completedImages)}
            >
              下载全部 {completedImages.length} 张图
            </Button>
          )}
        </div>
        {showResultGrid ? (
          <ImageGenerationGrid
            subTaskStatus={gen.subTaskStatus}
            totalCount={gen.totalCount || imageCount}
            altPrefix={contentPreview.titles[0]}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-text-muted">尚未生成</p>
            <p className="mt-1 text-xs text-text-subtle">点击「开始生成」，结果将在此逐张展示。</p>
          </div>
        )}
      </section>

      {/* 小红书内容（全宽，含内容逻辑模块） */}
      <section className={panelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text">小红书内容</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => copyText(contentPreview.titles.join("\n"), "已复制标题。")}>
              复制标题
            </Button>
            <Button variant="secondary" size="sm" onClick={() => copyText(contentPreview.body, "已复制正文。")}>
              复制正文
            </Button>
            <Button variant="secondary" size="sm" onClick={() => copyText(contentPreview.tags.join(" "), "已复制标签。")}>
              复制标签
            </Button>
            <Button variant="secondary" size="sm" disabled={gen.isActive || gen.isSubmitting} onClick={handleShuffleVariant}>
              换一版
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-text">{contentPreview.topic}</h3>
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
          {/* 内容逻辑（V2 重构时漏渲染，note 数据一直有，复制全文也带） */}
          <div>
            <h4 className="mb-1.5 text-sm font-medium text-text">内容逻辑</h4>
            <p className="whitespace-pre-line rounded-md bg-bg px-4 py-3 text-sm leading-7 text-text-muted ring-1 ring-border/70">
              {contentPreview.note}
            </p>
          </div>
        </div>
      </section>
      </div>

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
    </>
  );
}
