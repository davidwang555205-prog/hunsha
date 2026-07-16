/**
 * NavIcons -- 全站统一图标集（stroke 线性风格，跟随 AppHeader SVG 体系）
 * 统一 20x20 viewBox，stroke=currentColor，便于通过 text-* 控制颜色。
 * 侧边栏、按钮、卡片入口复用同一套图标，杜绝各处 svg 各写一份（DRY）。
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8.5L10 3l7 5.5V16a1 1 0 01-1 1H4a1 1 0 01-1-1V8.5z" />
      <path d="M8 17v-5h4v5" />
    </Svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3l1.8 4.7L16.5 9.5 11.8 11.3 10 16l-1.8-4.7L3.5 9.5l4.7-1.8L10 3z" />
      <path d="M15.5 14.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2.5" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3l6 2v5c0 3.5-2.5 6.5-6 7-3.5-.5-6-3.5-6-7V5l6-2z" />
      <path d="M7.5 10l2 2 3-3.5" />
    </Svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1" />
    </Svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="7.5" r="3" />
      <path d="M3 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
      <path d="M14 5.2a3 3 0 010 5.6M15.5 16c0-2-1.2-3.7-3-4.3" />
    </Svg>
  );
}

export function CpuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
      <rect x="7.5" y="7.5" width="5" height="5" rx="0.5" />
      <path d="M8 2v2M12 2v2M8 16v2M12 16v2M2 8h2M2 12h2M16 8h2M16 12h2" />
    </Svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4.5A1.5 1.5 0 014.5 3H9l7.5 7.5a1.5 1.5 0 010 2.1l-4.4 4.4a1.5 1.5 0 01-2.1 0L3 9V4.5z" />
      <circle cx="6.5" cy="6.5" r="1.2" />
    </Svg>
  );
}

export function CoinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v7M8 8.2h3a1.5 1.5 0 010 3H8.2a1.5 1.5 0 000 3H12" />
    </Svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3l7 4-7 4-7-4 7-4z" />
      <path d="M3 11l7 4 7-4M3 13.5l7 4 7-4" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l-6 6 6 6M6 10h10" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l-6 6 6 6" />
    </Svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10a7 7 0 1 0 2-5" />
      <path d="M3 3v3h3" />
      <path d="M10 6v4l2.5 2.5" />
    </Svg>
  );
}
