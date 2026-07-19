/**
 * ImageGenerationGrid -- 生成图占位网格（skeleton 逐张填充）
 *
 * 基于 subTaskStatus 渲染 N 张 3:4 卡。生成中与完成态共用：
 * pending 显示“排队中”，processing 显示“AI 正在生成”（取得通道槽位后），
 * success 显示真实图（点击放大预览 + 悬浮下载按钮），failed/cancelled 显示占位文字。
 * 轮询更新 subTaskStatus 时，逐张从 skeleton 变真实图。
 */
import { useState } from "react";
import { Spinner } from "../ui/Spinner";
import { ImageLightbox, type LightboxImage } from "../ui/ImageLightbox";
import { downloadImage } from "../../lib/download";
import type { SubTaskStatus } from "../../types/api";

type ImageGenerationGridProps = {
  subTaskStatus: SubTaskStatus[];
  totalCount: number;
  altPrefix: string;
};

export function ImageGenerationGrid({ subTaskStatus, totalCount, altPrefix }: ImageGenerationGridProps) {
  const [previewIndex, setPreviewIndex] = useState(-1);

  const items = Array.from({ length: totalCount }, (_, i) => {
    const matched = subTaskStatus.find((s) => s.index === i);
    return matched ?? ({ index: i, status: "pending" as const, image: null, error: null, latencyMs: 0 });
  });

  // 可预览的成功图（按 index 排序）
  const successItems = items.filter((s) => s.status === "success" && s.image);
  const lightboxImages: LightboxImage[] = successItems.map((s) => ({
    url: s.image!.url,
    name: s.image!.name ?? `${altPrefix} ${s.index + 1}`,
    downloadUrl: s.image!.downloadUrl
  }));

  const openPreview = (itemIndex: number) => {
    const li = successItems.findIndex((s) => s.index === itemIndex);
    if (li >= 0) setPreviewIndex(li);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((sub) => {
          const url = sub.status === "success" ? sub.image?.url : null;
          return (
            <div key={sub.index} className="group relative overflow-hidden rounded-lg border border-border bg-bg shadow-sm transition duration-base ease-out hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40">
              <div className="relative flex aspect-[3/4] items-center justify-center bg-bg">
                {url ? (
                  <>
                    <button type="button" onClick={() => openPreview(sub.index)} className="h-full w-full" aria-label="放大预览">
                      <img src={url} alt={`${altPrefix} ${sub.index + 1}`} className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      aria-label="下载本张"
                      title="下载本张"
                      onClick={() => sub.image && void downloadImage(sub.image)}
                      className="absolute right-1 top-1 rounded bg-surface/80 p-1 text-text opacity-0 ring-1 ring-border transition hover:bg-surface group-hover:opacity-100"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v8M3.5 6.5L7 10l3.5-3.5M2 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                ) : sub.status === "failed" ? (
                  <span className="text-xs text-danger">失败</span>
                ) : sub.status === "cancelled" ? (
                  <span className="text-xs text-text-subtle">已取消</span>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-surface/70" />
                    <div className="relative flex flex-col items-center gap-3 text-text-subtle">
                      <div className="flex items-center gap-1.5" aria-hidden>
                        <span className="generation-loading-dot" />
                        <span className="generation-loading-dot" />
                        <span className="generation-loading-dot" />
                      </div>
                      {sub.status === "processing" ? <Spinner size={18} className="text-primary" /> : null}
                      <span className="text-[11px]">{sub.status === "processing" ? "AI 正在生成" : "排队中"}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="px-2 py-1.5">
                <span className="text-xs text-text-muted">{sub.image?.name ?? `图 ${sub.index + 1}`}</span>
              </div>
            </div>
          );
        })}
      </div>

      <ImageLightbox
        open={previewIndex >= 0}
        images={lightboxImages}
        index={Math.max(0, previewIndex)}
        onClose={() => setPreviewIndex(-1)}
        onIndexChange={setPreviewIndex}
        onDownload={(i) => {
          const target = successItems[i];
          if (target?.image) void downloadImage(target.image);
        }}
      />
    </>
  );
}
