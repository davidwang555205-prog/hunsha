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
import { downloadImage, downloadImages } from "../../lib/download";
import { firstTitle } from "../../lib/titles";
import type { HistoryRecord } from "../../types/api";

type HistoryCardProps = {
  record: HistoryRecord;
  onOpenDetail: (record: HistoryRecord) => void;
  onMessage: (message: string) => void;
};

const MENU_WIDTH = 168; // w-40(160px) + 容错，用于右对齐定位

export function HistoryCard({ record, onOpenDetail, onMessage }: HistoryCardProps) {
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

  return (
    <SpotlightCard className="rounded-lg bg-surface p-4 ring-1 ring-border" radius={220}>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto]">
        {/* 缩略图区（点击展开详情） */}
        <button type="button" onClick={() => onOpenDetail(record)} className="text-left">
          {record.status === "success" && record.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {record.images.map((image, index) => (
                <figure key={image.id} className="min-w-0">
                  <img
                    className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-border"
                    src={image.thumbUrl ?? image.url}
                    alt={`${firstTitle(record.title)} ${index + 1}`}
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
            {record.username && <Badge>{record.username}</Badge>}
            {record.status === "success" ? (
              <Badge variant="success">成功</Badge>
            ) : (
              <Badge variant="danger">失败</Badge>
            )}
            <Badge variant="primary">{record.topic === "生成设置" ? "生成设置" : "内容"}</Badge>
          </div>
          <h3 className="text-base font-semibold">{firstTitle(record.title)}</h3>
          <p className="line-clamp-3 text-sm leading-6 text-text-muted">{record.body || record.error || "无内容"}</p>
          <div className="flex flex-wrap gap-2">
            {record.tags.slice(0, 8).map((tag) => (
              <span key={tag} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-text-muted ring-1 ring-primary-100">
                {tag}
              </span>
            ))}
          </div>
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
          <Button variant="secondary" size="sm" onClick={() => onOpenDetail(record)}>
            小红书数据
          </Button>
          {menuOpen &&
            createPortal(
              <div
                ref={menuRef}
                className="fixed z-popover w-40 rounded-md bg-surface p-1 shadow-lg ring-1 ring-border"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => void handleCopy(record.title, "标题")}>
                  复制标题
                </button>
                <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => void handleCopy(record.body, "正文")}>
                  复制正文
                </button>
                <button type="button" className="block w-full rounded px-3 py-1.5 text-left text-xs text-text hover:bg-bg" onClick={() => void handleCopy(record.tags.join(" "), "标签")}>
                  复制标签
                </button>
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
                          void downloadImage(image);
                          setMenuOpen(false);
                        }}
                      >
                        下载图 {index + 1}
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
