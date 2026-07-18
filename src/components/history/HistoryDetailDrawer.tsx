/**
 * HistoryDetailDrawer -- 历史详情抽屉（GlassSurface 玻璃态 + FadeIn 入场）
 *
 * 展开大图 + 完整正文（替代列表的 line-clamp-3 截断）。
 * createPortal 到 body：绕过 App.tsx 的 FadeIn transform 包含块，避免 fixed 失效跑到页面底部。
 * 图片可点击放大预览（ImageLightbox）+ 下载，复用生成页能力。
 * 失败态：不渲染生成图（防破裂图）、正文始终展示、额外显示失败原因块。
 * ESC 关闭 + 背景遮罩点击关闭 + 锁定 body 滚动。
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ImageLightbox } from "../ui/ImageLightbox";
import { useBodyScrollLock } from "../../lib/useBodyScrollLock";
import { formatDate } from "../../lib/format";
import { downloadImage } from "../../lib/download";
import { copyText } from "../../lib/clipboard";
import { firstTitle, splitTitles } from "../../lib/titles";
import { XHSNotePanel } from "./XHSNotePanel";
import { ModelInvocationTimeline } from "./ModelInvocationTimeline";
import type { HistoryRecord } from "../../types/api";

type HistoryDetailDrawerProps = {
  record: HistoryRecord | null;
  onClose: () => void;
  /** 管理员视角：展示给大模型的提示词（用户侧不展示） */
  isAdmin?: boolean;
};

export function HistoryDetailDrawer({ record, onClose, isAdmin }: HistoryDetailDrawerProps) {
  // 图片预览索引（-1 关闭）；生成图、参考图各一组
  const [genPreview, setGenPreview] = useState(-1);
  const [refPreview, setRefPreview] = useState(-1);
  // 当前已复制的提示词下标（仅做"已复制"短暂反馈）
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);

  // 锁 body 滚动：引用计数 hook，与内层 Lightbox 共用，避免 prev 快照污染导致页面永久不能滚动
  useBodyScrollLock(!!record);

  useEffect(() => {
    if (!record) return;
    // 切换记录时重置预览，避免上次残留导致新抽屉一打开就弹 lightbox
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGenPreview(-1);
    setRefPreview(-1);
    setCopiedPrompt(null);
    // ESC 关闭（冒泡阶段：内层 Lightbox 打开时其 capture handler 会先拦截 ESC，
    // 实现「先关图片预览，再 ESC 关抽屉」的层级）
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [record, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {record && (
        <motion.div
          className="fixed inset-0 z-modal-overlay flex items-center justify-center bg-text/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.section
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-surface/95 p-6 shadow-lg ring-1 ring-border"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{formatDate(record.createdAt)}</Badge>
                {record.username && <Badge>{record.username}</Badge>}
                {record.status === "success" ? <Badge variant="success">成功</Badge> : <Badge variant="danger">失败</Badge>}
                <Badge variant="primary">{record.topic}</Badge>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-surface px-3 py-1.5 text-sm text-text-muted ring-1 ring-border transition hover:bg-bg"
              >
                关闭
              </button>
            </div>

            <h2 className="text-xl font-semibold">{firstTitle(record.title)}</h2>
            {splitTitles(record.title).length > 1 && (
              <div className="mt-3">
                <h4 className="mb-1.5 text-sm font-medium text-text">标题备选</h4>
                <div className="space-y-1">
                  {splitTitles(record.title).map((t, i) => (
                    <p key={i} className="rounded-md bg-bg px-3 py-2 text-sm text-text ring-1 ring-border/70">
                      {t}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 生成图：仅成功时渲染，避免失败任务显示破裂图 */}
            {record.status === "success" && record.images.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-text">生成图</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {record.images.map((image, index) => (
                    <figure key={image.id} className="overflow-hidden rounded-md bg-bg ring-1 ring-border">
                      <button type="button" onClick={() => setGenPreview(index)} className="block w-full" aria-label={`预览图 ${index + 1}`}>
                        <img className="aspect-[3/4] w-full object-cover" src={image.thumbUrl ?? image.url} alt={`${firstTitle(record.title)} ${index + 1}`} />
                      </button>
                      <figcaption className="px-3 py-2 text-xs text-text-muted">{image.name || `图 ${index + 1}`}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            {/* 参考图（用户上传，后端存 MinIO 后返回；按 kind 分组：场景图/产品图） */}
            {(() => {
              const refs = record.referenceImages ?? [];
              if (refs.length === 0) return null;
              const sceneImgs = refs.filter((i) => i.kind === "scene");
              const productImgs = refs.filter((i) => i.kind !== "scene");
              const renderGroup = (label: string, imgs: typeof refs) =>
                imgs.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="mb-1.5 text-xs font-medium text-text-muted">{label}</h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {imgs.map((image) => {
                        const idx = refs.indexOf(image);
                        return (
                          <figure key={image.id ?? idx} className="overflow-hidden rounded-md bg-bg ring-1 ring-border">
                            <button type="button" onClick={() => setRefPreview(idx)} className="block w-full" aria-label={`预览${label} ${idx + 1}`}>
                              <img className="aspect-[4/5] w-full object-cover" src={image.thumbUrl ?? image.url} alt={`${label} ${idx + 1}`} />
                            </button>
                          </figure>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              return (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-text">参考图</h3>
                  {renderGroup("场景参考图", sceneImgs)}
                  {renderGroup("产品参考图", productImgs)}
                </div>
              );
            })()}

            {/* 失败原因 */}
            {record.status === "failed" && record.error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                <span className="font-medium">失败原因：</span>
                {record.error}
              </div>
            )}

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-text">正文</h3>
              <p className="mt-2 whitespace-pre-line rounded-md bg-bg px-4 py-3 text-sm leading-7 text-text ring-1 ring-border/70">
                {record.body}
              </p>
            </div>

            {record.tags.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-text">标签</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {record.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-primary-50 px-3 py-1 text-xs text-text-muted ring-1 ring-primary-100">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 小红书发布数据：链接首采 + 可追溯刷新快照，指标不允许人工填写。 */}
            <div className="mt-5 rounded-md border border-border bg-bg/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-text">小红书发布数据</h3>
              <XHSNotePanel taskId={record.id} isAdmin={!!isAdmin} initialURL={record.feedback?.noteUrl} />
            </div>

            {/* 给大模型的提示词（仅管理员，复盘用）。老任务未存 prompts，给空态提示避免困惑。 */}
            {isAdmin && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-text">给大模型的提示词</h3>
                {record.prompts && record.prompts.length > 0 ? (
                  <div className="space-y-2">
                    {record.prompts.map((p, i) => (
                      <details key={i} className="rounded-md bg-bg ring-1 ring-border/70">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-text-muted [&::-webkit-details-marker]:hidden">
                          <span>图 {i + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="!py-0.5 !text-xs"
                            onClick={async (event) => {
                              // 阻止冒泡与 summary 默认 toggle，避免点复制时误折叠
                              event.preventDefault();
                              event.stopPropagation();
                              try {
                                await copyText(p);
                                setCopiedPrompt(i);
                                setTimeout(() => setCopiedPrompt((cur) => (cur === i ? null : cur)), 2000);
                              } catch {
                                /* 复制失败静默，与项目其他复制处一致 */
                              }
                            }}
                          >
                            {copiedPrompt === i ? "已复制" : "复制"}
                          </Button>
                        </summary>
                        <pre className="overflow-x-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-text">{p}</pre>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md bg-bg px-3 py-2 text-xs text-text-muted ring-1 ring-border/70">
                    该任务无提示词记录（早期生成的任务未保存提示词，仅功能上线后新建任务可见）。
                  </p>
                )}
              </div>
            )}

            {isAdmin && <ModelInvocationTimeline taskId={record.id} />}
          </motion.section>

          {/* 生成图放大预览 */}
          <ImageLightbox
            open={genPreview >= 0}
            images={record.images}
            index={Math.max(0, genPreview)}
            onClose={() => setGenPreview(-1)}
            onIndexChange={setGenPreview}
            onDownload={(i) => void downloadImage(record.images[i])}
          />
          {/* 参考图放大预览 */}
          <ImageLightbox
            open={refPreview >= 0}
            images={record.referenceImages ?? []}
            index={Math.max(0, refPreview)}
            onClose={() => setRefPreview(-1)}
            onIndexChange={setRefPreview}
            onDownload={(i) => void downloadImage((record.referenceImages ?? [])[i])}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
