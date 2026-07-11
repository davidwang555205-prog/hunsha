/**
 * ShinyText -- 光泽扫过文字（借鉴 react-bits ShinyText）
 *
 * backgroundSize:200% + 模拟金属光泽位置流动。用于主按钮文字、强调标题 hover。
 */
import { motion } from "motion/react";
import type { CSSProperties } from "react";

type ShinyTextProps = {
  children: string;
  className?: string;
  /** 扫过周期秒，默认 3 */
  duration?: number;
  disabled?: boolean;
};

export function ShinyText({ children, className, duration = 3, disabled = false }: ShinyTextProps) {
  const style: CSSProperties = {
    backgroundImage:
      "linear-gradient(110deg, currentColor 35%, rgba(255,255,255,0.85) 50%, currentColor 65%)",
    backgroundSize: "200% 100%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent"
  };

  if (disabled) {
    return (
      <span className={className} style={{ ...style, animation: "none" }}>
        {children}
      </span>
    );
  }

  return (
    <motion.span
      className={className}
      style={style}
      animate={{ backgroundPosition: ["200% 0%", "-100% 0%"] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}
