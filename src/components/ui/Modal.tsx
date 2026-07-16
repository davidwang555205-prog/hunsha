/**
 * Modal -- 统一弹窗组件（createPortal 到 body）
 *
 * 解决全站弹窗三宗罪：
 *   ① FadeIn 的 filter/transform 包含块困住 fixed 定位；
 *   ② 被顶栏 header(z-30) 压住；
 *   ③ 内容超长时底部按钮被裁剪不可见。
 * Portal 渲染到 document.body，绕过所有祖先层叠上下文；内层 max-h-[90vh]
 * overflow-y-auto；ESC/点遮罩关闭；锁定 body 滚动。z-index 走 token。
 */
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useBodyScrollLock } from "../../lib/useBodyScrollLock";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  /** 底部操作区（按钮等），固定在弹窗底部不随内容滚动 */
  footer?: ReactNode;
};

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl"
};

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md p-1 text-text-muted transition hover:bg-bg hover:text-text"
      aria-label="关闭"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function Modal({ open, onClose, title, children, size = "md", footer }: ModalProps) {
  // 锁定 body 滚动：引用计数 hook，与 Drawer/Lightbox 共用，避免 prev 快照污染
  useBodyScrollLock(open);

  // ESC 关闭（冒泡阶段：内层 Lightbox 的 capture handler 会先拦截 ESC）
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-modal-overlay flex items-center justify-center bg-text/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.section
            className={`relative flex max-h-[90vh] w-full ${sizeClass[size]} flex-col overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border`}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {title ? (
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold text-text">{title}</h3>
                <CloseButton onClick={onClose} />
              </div>
            ) : (
              <div className="absolute right-2 top-2 z-base">
                <CloseButton onClick={onClose} />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
                {footer}
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
