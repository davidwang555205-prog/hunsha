/**
 * ImageLightbox -- 图片放大预览（createPortal 到 body）
 *
 * 全屏遮罩 + 居中大图，支持多图左右切换、单张下载。
 * Portal 绕过 FadeIn 的 transform 包含块（与 Modal 同理），避免 fixed 失效跑到页面底部。
 * ESC 关闭，←/→ 切换，点遮罩关闭。
 */
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useBodyScrollLock } from "../../lib/useBodyScrollLock";

export type LightboxImage = {
  url: string;
  name?: string;
  downloadUrl?: string;
};

type ImageLightboxProps = {
  open: boolean;
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  /** 传入则显示「下载本张」按钮 */
  onDownload?: (index: number) => void;
};

export function ImageLightbox({ open, images, index, onClose, onIndexChange, onDownload }: ImageLightboxProps) {
  const total = images.length;
  const current = images[index];

  const go = useCallback(
    (delta: number) => {
      if (total <= 1) return;
      const next = (index + delta + total) % total;
      onIndexChange(next);
    },
    [index, total, onIndexChange]
  );

  // 锁 body 滚动：走引用计数 hook，避免与外层 Drawer/Modal 的 prev 快照互相污染
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // capture 阶段抢先 + 阻断传播：lightbox 打开时 ESC 只关 lightbox，
        // 不冒泡到外层 Drawer/Modal 的 keydown handler（否则 ESC 连带关闭抽屉）
        event.stopImmediatePropagation();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.stopImmediatePropagation();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.stopImmediatePropagation();
        go(1);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onClose, go]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && current && (
        <motion.div
          className="fixed inset-0 z-modal-overlay flex items-center justify-center bg-text/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          {total > 1 && (
            <button
              type="button"
              aria-label="上一张"
              onClick={(event) => {
                event.stopPropagation();
                go(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-surface/80 p-2 text-text ring-1 ring-border transition hover:bg-surface"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <motion.figure
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={current.url}
              alt={current.name ?? "预览"}
              className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-lg"
            />
            <figcaption className="mt-3 flex items-center gap-3 text-sm text-text-muted">
              <span className="truncate">{current.name ?? `图 ${index + 1}`}</span>
              {total > 1 && <span className="shrink-0">{index + 1} / {total}</span>}
              {onDownload && (
                <button
                  type="button"
                  onClick={() => onDownload(index)}
                  className="shrink-0 rounded-md bg-surface px-3 py-1 text-xs font-medium text-text ring-1 ring-border transition hover:bg-bg"
                >
                  下载本张
                </button>
              )}
            </figcaption>
          </motion.figure>

          {total > 1 && (
            <button
              type="button"
              aria-label="下一张"
              onClick={(event) => {
                event.stopPropagation();
                go(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-surface/80 p-2 text-text ring-1 ring-border transition hover:bg-surface"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-surface/80 p-2 text-text ring-1 ring-border transition hover:bg-surface"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
