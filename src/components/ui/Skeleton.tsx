/**
 * Skeleton -- 骨架屏（脉冲占位，用于数据加载、图片占位）
 */
type SkeletonProps = {
  className?: string;
  /** 是否 3:4 图片比例占位 */
  aspect?: "3/4" | "square" | "text" | "none";
};

const aspectClass = {
  "3/4": "aspect-[3/4] w-full",
  square: "aspect-square w-full",
  text: "h-4 w-full",
  none: ""
};

export function Skeleton({ className = "", aspect = "none" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-border ${aspectClass[aspect]} ${className}`}
      aria-hidden
    />
  );
}
