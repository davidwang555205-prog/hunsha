/**
 * HistoryCard -- 历史单卡（SpotlightCard 包裹）
 *
 * 3:4 缩略图 + 元信息（主题/日期/状态徽标）。复制/下载聚合为下拉。
 * 点击卡片展开详情抽屉（onOpenDetail）。
 * 图片懒加载（loading="lazy"）。
 */
import { useState } from "react";
import { SpotlightCard } from "../motion/SpotlightCard";
import { Badge } from "../ui/Badge";
import { formatDate } from "../../lib/format";
import { copyText as copyToClipboard } from "../../lib/clipboard";
import { downloadImage, downloadImages } from "../../lib/download";
import type { HistoryRecord } from "../../types/api";

type HistoryCardProps = {
  record: HistoryRecord;
  onOpenDetail: (record: HistoryRecord) => void;
  onMessage: (message: string) => void;
};

export function HistoryCard({ record, onOpenDetail, onMessage }: HistoryCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    onMessage(`已复制${label}。`);
    setMenuOpen(false);
  };

  return (
    <SpotlightCard className="rounded-lg bg-surface p-4 ring-1 ring-border" radius={220}>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto]">
        {/* 缩略图区（点击展开详情） */}
        <button type="button" onClick={() => onOpenDetail(record)} className="text-left">
          {record.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {record.images.map((image, index) => (
                <figure key={image.id} className="min-w-0">
                  <img
                    className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-border"
                    src={image.url}
                    alt={`${record.title} ${index + 1}`}
                    loading="lazy"
                  />
                  <figcaption className="mt-1 truncate text-[11px] text-text-muted">{image.name || `图片 ${index + 1}`}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-bg text-sm text-text-muted ring-1 ring-border">
              {record.status === "failed" ? "失败" : "无图"}
            </div>
          )}
        </button>

        {/* 元信息区 */}
        <button type="button" onClick={() => onOpenDetail(record)} className="space-y-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{formatDate(record.createdAt)}</Badge>
            <Badge>{record.username}</Badge>
            {record.status === "success" ? (
              <Badge variant="success">成功</Badge>
            ) : (
              <Badge variant="danger">失败</Badge>
            )}
            <Badge variant="primary">{record.topic === "生成设置" ? "生成设置" : "内容"}</Badge>
          </div>
          <h3 className="text-base font-semibold">{record.title}</h3>
          <p className="line-clamp-3 text-sm leading-6 text-text-muted">{record.status === "failed" ? record.error : record.body}</p>
          <div className="flex flex-wrap gap-2">
            {record.tags.slice(0, 8).map((tag) => (
              <span key={tag} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-text-muted ring-1 ring-primary-100">
                {tag}
              </span>
            ))}
          </div>
        </button>

        {/* 复制/下载聚合下拉 */}
        <div className="relative flex flex-row gap-2 lg:flex-col">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-surface px-3 py-2 text-xs font-medium text-text ring-1 ring-border transition duration-fast ease-out hover:bg-bg"
            onClick={() => setMenuOpen((open) => !open)}
          >
            操作 ▾
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md bg-surface p-1 shadow-lg ring-1 ring-border">
              <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => handleCopy(record.title, "标题")}>
                复制标题
              </button>
              <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => handleCopy(record.body, "正文")}>
                复制正文
              </button>
              <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => handleCopy(record.tags.join(" "), "标签")}>
                复制标签
              </button>
              {record.images.length > 0 && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg"
                    onClick={() => {
                      void downloadImages(record.images, record.title);
                      setMenuOpen(false);
                    }}
                  >
                    下载全部
                  </button>
                  {record.images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg"
                      onClick={() => {
                        void downloadImage(image, `${record.title}-${index + 1}`);
                        setMenuOpen(false);
                      }}
                    >
                      下载图 {index + 1}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}
