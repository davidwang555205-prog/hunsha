/**
 * ImageGallery -- 生成图展示（settings/content/history 三处复用）
 *
 * 3:4 统一比例，rounded-md，用 SpotlightCard 包裹 hover 柔光跟随。
 * 空态显示占位骨架。
 */
import type { GeneratedImage } from "../../types/api";
import { SpotlightCard } from "../motion/SpotlightCard";

type ImageGalleryProps = {
  images: GeneratedImage[];
  /** alt 前缀，通常为记录标题 */
  altPrefix: string;
  /** 列数：settings 用 2-3 列，content/history 用 2 列 */
  columns?: 2 | 3;
  /** 空态占位高度 */
  emptyClassName?: string;
};

const columnsClass = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3"
};

export function ImageGallery({ images, altPrefix, columns = 2, emptyClassName }: ImageGalleryProps) {
  if (!images.length) {
    return <div className={`min-h-[240px] rounded-md bg-surface ring-1 ring-border/70 ${emptyClassName ?? ""}`} aria-label={`${altPrefix}占位`} />;
  }

  return (
    <div className={`grid gap-3 ${columnsClass[columns]}`}>
      {images.map((image, index) => (
        <SpotlightCard key={image.id} className="overflow-hidden rounded-md bg-bg ring-1 ring-border" radius={200}>
          <figure>
            <img
              className="aspect-[3/4] w-full object-cover"
              src={image.url}
              alt={`${altPrefix} ${index + 1}`}
              loading="lazy"
            />
            <figcaption className="px-3 py-2 text-xs text-text-muted">图 {index + 1}</figcaption>
          </figure>
        </SpotlightCard>
      ))}
    </div>
  );
}
