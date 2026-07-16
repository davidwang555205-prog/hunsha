/**
 * ProgressBar -- 进度条（品牌紫->粉渐变 + 动效）
 *
 * 用于生图进度反馈。value 0-100，不确定态（indeterminate）走扫描动画。
 * 诚实标注：进度为估算，调用方文案带"预计"字样。
 */
type ProgressBarProps = {
  /** 0-100，未提供则走 indeterminate 扫描态 */
  value?: number;
  /** 活跃态（生成中）：叠加流动光效，停顿时也传达"工作中"，避免误判卡死 */
  active?: boolean;
  className?: string;
};

export function ProgressBar({ value, active = false, className = "" }: ProgressBarProps) {
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

  // 流动高光：活跃且未到头/尾时叠加。宽度受真实进度约束可能在单张生成期间停顿，
  // 故靠持续流动的高光 + 末端呼吸光点传达"工作中"，避免误判卡死
  const showFlow = active && clamped > 0 && clamped < 100;

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-bg ring-1 ring-border ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="进度"
    >
      {/* 填充体：宽度=估算进度（诚实标注），内部叠加持续流动高光 */}
      <div
        className="relative h-full overflow-hidden rounded-full bg-brand-gradient transition-[width] duration-base ease-out"
        style={{ width: `${clamped}%` }}
      >
        {showFlow && (
          <div
            className="absolute inset-0 animate-[shimmer-flow_1.6s_linear_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
              backgroundSize: "200% 100%"
            }}
          />
        )}
      </div>
      {/* 末端光点：锚定当前进度位置，宽度停顿时呼吸脉冲，证明条还活着 */}
      {showFlow && (
        <div
          className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.7)] animate-[edge-pulse_1.6s_ease-in-out_infinite]"
          style={{ left: `${clamped}%` }}
        />
      )}
    </div>
  );
}
