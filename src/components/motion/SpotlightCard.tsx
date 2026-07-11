/**
 * SpotlightCard -- 鼠标聚光灯卡片（借鉴 react-bits SpotlightCard）
 *
 * CSS 变量 + radial-gradient + transition:opacity，鼠标移动时柔光斑跟随。
 * 零 JS 重渲染（仅 setProperty 更新 --x/--y），性能好。
 * 用于生图结果卡片、历史卡片 hover 时主色/粉色光斑跟随。
 */
import { useRef, type ReactNode, type MouseEvent } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  /** 光斑颜色，默认主色；可传 accent（粉）等 CSS 颜色变量 */
  spotlightColor?: string;
  /** 光斑半径 px，默认 240 */
  radius?: number;
};

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "var(--color-primary)",
  radius = 240
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${event.clientX - rect.left}px`);
    el.style.setProperty("--y", `${event.clientY - rect.top}px`);
    el.style.setProperty("--opacity", "1");
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--opacity", "0");
  };

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden ${className}`}
      style={
        {
          "--x": "50%",
          "--y": "50%",
          "--opacity": "0",
          "--spotlight-color": spotlightColor,
          "--spotlight-radius": `${radius}px`
        } as React.CSSProperties
      }
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* 光斑层：radial-gradient 跟随 --x/--y，opacity 过渡 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[var(--opacity)] transition-opacity duration-300"
        style={{
          background: `radial-gradient(var(--spotlight-radius) circle at var(--x) var(--y), var(--spotlight-color), transparent 70%)`,
          opacity: 0.08
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
