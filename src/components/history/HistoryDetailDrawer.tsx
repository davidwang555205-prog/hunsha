/**
 * HistoryDetailDrawer -- 历史详情抽屉（GlassSurface 玻璃态 + FadeIn 入场）
 *
 * 展开大图 + 完整正文（替代列表的 line-clamp-3 截断）。
 * Esc 关闭 + 背景遮罩点击关闭。
 */
import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "../ui/Badge";
import { formatDate } from "../../lib/format";
import type { HistoryRecord } from "../../types/api";

type HistoryDetailDrawerProps = {
  record: HistoryRecord | null;
  onClose: () => void;
};

export function HistoryDetailDrawer({ record, onClose }: HistoryDetailDrawerProps) {
  useEffect(() => {
    if (!record) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [record, onClose]);

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-text/40 p-4 backdrop-blur-sm"
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
                <Badge>{record.username}</Badge>
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

            <h2 className="text-xl font-semibold">{record.title}</h2>

            {record.images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {record.images.map((image, index) => (
                  <figure key={image.id} className="overflow-hidden rounded-md bg-bg ring-1 ring-border">
                    <img className="aspect-[3/4] w-full object-cover" src={image.url} alt={`${record.title} ${index + 1}`} />
                    <figcaption className="px-3 py-2 text-xs text-text-muted">{image.name || `图 ${index + 1}`}</figcaption>
                  </figure>
                ))}
              </div>
            )}

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-text">正文</h3>
              <p className="mt-2 whitespace-pre-line rounded-md bg-bg px-4 py-3 text-sm leading-7 text-text ring-1 ring-border/70">
                {record.status === "failed" ? record.error : record.body}
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
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
