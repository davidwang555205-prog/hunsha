/**
 * HistoryCard -- 历史单卡（SpotlightCard 包裹）
 *
 * 3:4 缩略图 + 元信息（主题/日期/状态徽标）。复制/下载聚合为下拉。
 * 点击卡片展开详情抽屉（onOpenDetail）。
 * 图片懒加载（loading="lazy"）。
 * 操作菜单 createPortal 到 body + fixed 定位 + z-popover，避免被 SpotlightCard 层叠上下文遮挡。
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SpotlightCard } from "../motion/SpotlightCard";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatDate } from "../../lib/format";
import { copyText as copyToClipboard } from "../../lib/clipboard";
import { downloadImage, downloadImages, normalizeImageDisplayName } from "../../lib/download";
import type { HistoryRecord } from "../../types/api";

type HistoryCardProps = {
  record: HistoryRecord;
  categoryName?: string;
  showGenerationMeta?: boolean;
  onOpenDetail: (record: HistoryRecord) => void;
  onOpenXHS?: (record: HistoryRecord) => void;
  onMessage: (message: string) => void;
};

const MENU_WIDTH = 168; // w-40(160px) + 容错，用于右对齐定位

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs < 0) return "耗时未记录";
  if (durationMs < 60_000) return `耗时 ${(durationMs / 1000).toFixed(1)} 秒`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `耗时 ${minutes} 分 ${seconds} 秒`;
}

export function HistoryCard({ record, categoryName, showGenerationMeta = false, onOpenDetail, onOpenXHS, onMessage }: HistoryCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    onMessage(`已复制${label}。`);
    setMenuOpen(false);
  };

  // 菜单打开时：点击外部 / ESC 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (!menuOpen) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        // 右对齐按钮、落在下方，左侧不溢出视窗
        setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) });
      }
    }
    setMenuOpen((open) => !open);
  };

  const visibleImages = record.images.slice(0, 3);
  const extraImageCount = Math.max(0, record.images.length - visibleImages.length);
  const hasCopy = Boolean(record.body.trim() || record.tags.length > 0);
  const categoryLabel = categoryName ?? (record.categoryId ? "已删除类目" : "未分类");

  return (
    <SpotlightCard className="rounded-lg bg-surface p-4 ring-1 ring-border" radius={220}>
      <div className="grid items-center gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_auto]">
        {/* 历史列表始终只展示紧凑图片带；正文和标签留给详情抽屉。 */}
        <button type="button" onClick={() => onOpenDetail(record)} className="text-left">
          {record.status === "success" && record.images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {visibleImages.map((image, index) => (
                <figure key={image.id} className="relative min-w-0 overflow-hidden rounded-lg ring-1 ring-border">
                  <img
                    className="aspect-[3/4] w-full object-cover"
                    src={image.thumbUrl ?? image.url}
                    alt={`历史生成图 ${index + 1}`}
                    loading="lazy"
                  />
                  {index === visibleImages.length - 1 && extraImageCount > 0 && (
                    <figcaption className="absolute inset-0 flex items-center justify-center bg-text/55 text-sm font-semibold text-white">
                      +{extraImageCount}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-lg bg-bg text-sm text-text-muted ring-1 ring-border">
              {record.status === "failed" ? "失败" : "无图"}
            </div>
          )}
        </button>

        {/* 所有任务共用同一元信息区，避免图片任务出现空白文案栏。 */}
        <button type="button" onClick={() => onOpenDetail(record)} className="min-w-0 space-y-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{categoryLabel}</Badge>
            <Badge>{formatDate(record.createdAt)}</Badge>
            {record.username && <Badge>{record.username}</Badge>}
            {record.status === "success" ? (
              <Badge variant="success">成功</Badge>
            ) : (
              <Badge variant="danger">失败</Badge>
            )}
            <Badge>{hasCopy ? "图文内容" : "仅生成图片"}</Badge>
          </div>
          <p className="text-sm text-text-muted">
            {record.status === "failed" ? record.error || "本次生成失败" : `已生成 ${record.images.length} 张图片`}
          </p>
          {showGenerationMeta && (
            <p className="text-xs text-text-muted">
              线路：{record.channelName || "未记录线路"} · 模型：{record.model || "未记录模型"} · {formatDuration(record.durationMs)}
            </p>
          )}
        </button>

        {/* 复制/下载聚合下拉（portal 到 body，避免被 SpotlightCard 层叠上下文遮挡） */}
        <div className="flex flex-row gap-2 lg:flex-col">
          <Button
            ref={btnRef}
            variant="secondary"
            size="sm"
            onClick={toggleMenu}
          >
            操作 ▾
          </Button>
          <Button variant="secondary" size="sm" onClick={() => (onOpenXHS ?? onOpenDetail)(record)}>
            小红书数据
          </Button>
          {menuOpen &&
            createPortal(
              <div
                ref={menuRef}
                className="fixed z-popover w-40 rounded-md bg-surface p-1 shadow-lg ring-1 ring-border"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                {hasCopy && (
                  <>
                    {record.body && (
                      <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => void handleCopy(record.body, "正文")}>
                        复制正文
                      </button>
                    )}
                    {record.tags.length > 0 && (
                      <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => void handleCopy(record.tags.join(" "), "标签")}>
                        复制标签
                      </button>
                    )}
                  </>
                )}
                {record.status === "success" && record.images.length > 0 && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg"
                      onClick={() => {
                        void downloadImages(record.images);
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
                          void downloadImage(image, undefined, index);
                          setMenuOpen(false);
                        }}
                      >
                        下载 {normalizeImageDisplayName(image.name, index)}
                      </button>
                    ))}
                  </>
                )}
              </div>,
              document.body
            )}
        </div>
      </div>
    </SpotlightCard>
  );
}
