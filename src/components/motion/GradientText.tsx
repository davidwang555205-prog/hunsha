/**
 * GradientText -- 品牌渐变流动文字（借鉴 react-bits GradientText）
 *
 * background-clip:text + 动态 backgroundPosition 渐变流动。
 * 用品牌 --gradient-text（紫->粉->红）。用于登录页品牌标题、Logo 副标题。
 */
import { motion } from "motion/react";
import type { CSSProperties } from "react";

type GradientTextProps = {
  children: string;
  className?: string;
  /** 流动动画周期秒，默认 6；0 表示静态渐变 */
  duration?: number;
  /** 字重，默认 700 */
  weight?: number;
  as?: "span" | "h1" | "h2" | "h3" | "p";
};

export function GradientText({
  children,
  className,
  duration = 6,
  weight = 700,
  as = "span"
}: GradientTextProps) {
  const MotionTag = motion[as];

  const style: CSSProperties = {
    backgroundImage: "var(--gradient-text)",
    backgroundSize: "200% 100%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    fontWeight: weight
  };

  // duration=0 时静态渐变（无流动）
  if (duration <= 0) {
    const Tag = as;
    return (
      <Tag className={className} style={style}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      style={style}
      animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </MotionTag>
  );
}
