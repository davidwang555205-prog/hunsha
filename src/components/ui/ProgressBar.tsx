/**
 * ProgressBar -- 进度条（品牌紫->粉渐变 + 动效）
 *
 * 用于生图进度反馈。value 0-100，不确定态（indeterminate）走扫描动画。
 * 诚实标注：进度为估算，调用方文案带"预计"字样。
 */
type ProgressBarProps = {
  /** 0-100，未提供则走 indeterminate 扫描态 */
  value?: number;
  className?: string;
};

export function ProgressBar({ value, className = "" }: ProgressBarProps) {
  const indeterminate = typeof value !== "number";
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(100, value));

  if (indeterminate) {
    return (
      <div
        className={`h-2 w-full overflow-hidden rounded-full bg-bg ring-1 ring-border ${className}`}
        role="progressbar"
        aria-label="进度"
      >
        <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-brand-gradient" />
      </div>
    );
  }

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-bg ring-1 ring-border ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="进度"
    >
      <div
        className="h-full rounded-full bg-brand-gradient transition-[width] duration-base ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
