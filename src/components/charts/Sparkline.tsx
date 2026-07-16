/**
 * Sparkline -- 迷你折线（纯 SVG，无坐标轴），指标卡内嵌趋势用。
 * 苹果克制风：细线 + 极淡面积填充。宽度响应式（preserveAspectRatio=none），
 * 描边用 vectorEffect=non-scaling-stroke 保证缩放时线宽不变形。
 */
type SparklineProps = {
  data: number[];
  color?: string;
  /** viewBox 宽度（内部坐标系），不影响实际渲染宽度（100%） */
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
  className?: string;
};

export function Sparkline({
  data,
  color = "rgb(var(--color-primary))",
  width = 100,
  height = 32,
  strokeWidth = 1.5,
  fill = true,
  className = ""
}: SparklineProps) {
  if (data.length < 2) {
    return <svg width="100%" height={height} className={className} aria-hidden />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 2;
  const innerH = height - pad * 2;
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)},${height} L0,${height} Z`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {fill && <path d={area} fill={color} fillOpacity={0.12} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
