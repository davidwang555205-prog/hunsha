/**
 * TrendLineChart -- 折线趋势图（纯 SVG），admin 概览趋势图用。
 * 苹果克制风：细线 1.75、极淡网格、语义色、图例小圆点。
 * 支持多线（分模型链路）+ y 轴 percent(0-100%)/auto 模式。
 * 线条 non-scaling-stroke 保证宽度响应式不变形；文字用 HTML overlay 避免缩放变形。
 */
import type { ReactNode } from "react";

export type TrendSeries = {
  name: string;
  data: number[];
  color: string;
};

type TrendLineChartProps = {
  /** x 轴日期标签，长度需与每条 series.data 一致 */
  labels: string[];
  series: TrendSeries[];
  height?: number;
  /** y 轴模式：percent=0-100%（成功率），auto=按数据范围从 0 起 */
  yMode?: "percent" | "auto";
  ySuffix?: string;
  emptyHint?: ReactNode;
  className?: string;
};

const PLOT_LEFT = 34; // y 轴标签占位宽度

export function TrendLineChart({
  labels,
  series,
  height = 200,
  yMode = "auto",
  ySuffix = "",
  emptyHint = "暂无趋势数据",
  className = ""
}: TrendLineChartProps) {
  const hasData = labels.length > 1 && series.some((s) => s.data.length > 1);

  const yMin = 0;
  let yMax = yMode === "percent" ? 100 : 1;
  if (hasData) {
    const all = series.flatMap((s) => s.data).filter((v) => Number.isFinite(v));
    if (all.length) {
      yMax = yMode === "percent" ? 100 : Math.max(1, Math.max(...all));
    }
  }
  const yRange = yMax - yMin || 1;

  // 4 段网格刻度（0/25/50/75/100）
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    pct: 1 - p,
    label: `${Math.round(yMin + yRange * p)}${ySuffix}`
  }));

  const toPath = (data: number[]) => {
    if (data.length < 2) return "";
    const sx = 100 / (data.length - 1);
    return data
      .map((v, i) => {
        const x = i * sx;
        const y = ((yMax - v) / yRange) * 100;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  return (
    <div className={className}>
      {/* 图例 */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-caption text-text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        {hasData ? (
          <>
            {/* y 轴标签 */}
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute -translate-y-1/2 text-caption text-text-subtle"
                style={{ left: 0, top: `${t.pct * 100}%` }}
              >
                {t.label}
              </span>
            ))}
            {/* 绘图区 */}
            <svg
              className="absolute inset-y-0"
              style={{ left: PLOT_LEFT, width: `calc(100% - ${PLOT_LEFT}px)`, height: "100%" }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1="0"
                  x2="100"
                  y1={(t.pct * 100).toFixed(2)}
                  y2={(t.pct * 100).toFixed(2)}
                  stroke="rgb(var(--color-border))"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.6}
                />
              ))}
              {series.map((s) => (
                <path
                  key={s.name}
                  d={toPath(s.data)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-subtle">
            {emptyHint}
          </div>
        )}
      </div>
      {/* x 轴标签：首尾 */
      hasData && labels.length > 1 && (
        <div className="mt-1 flex justify-between" style={{ paddingLeft: PLOT_LEFT }}>
          <span className="text-caption text-text-subtle">{labels[0]}</span>
          <span className="text-caption text-text-subtle">{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
