/**
 * GlassCard -- 毛玻璃卡片（借鉴 react-bits GlassCard）
 *
 * backdrop-blur + 半透明白底 + 软阴影。用于登录卡、Header 浮层、生图进度浮条。
 * 纯 Tailwind，零额外依赖。内容置于 relative 层避免被 blur 容器裁剪。
 */
import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** 阴影强度，默认 md */
  shadow?: "sm" | "md" | "lg";
};

const shadowClass = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg"
};

export function GlassCard({ children, className = "", shadow = "md", ...props }: GlassCardProps) {
  return (
    <div
      className={`rounded-lg border border-white/40 bg-surface/70 backdrop-blur-xl ${shadowClass[shadow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
