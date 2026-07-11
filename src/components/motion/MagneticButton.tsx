/**
 * MagneticButton -- 磁吸按钮（借鉴 react-bits MagneticButton）
 *
 * 鼠标靠近时按钮向光标方向微位移吸附（spring 弹性回弹）。
 * 用于登录主 CTA、主生图按钮（克制，仅关键 CTA）。
 * 复用 ui/Button 的样式：通过 children + className 透传，保持视觉一致。
 */
import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

type MagneticButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /** 最大位移 px，默认 10 */
  strength?: number;
};

export function MagneticButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  strength = 10
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 22 });
  const springY = useSpring(y, { stiffness: 260, damping: 22 });

  const handleMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = event.clientX - (rect.left + rect.width / 2);
    const relY = event.clientY - (rect.top + rect.height / 2);
    // 按按钮尺寸比例缩放位移，保证吸附幅度一致
    x.set((relX / rect.width) * strength * 2);
    y.set((relY / rect.height) * strength * 2);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.97 }}
      className={className}
    >
      {loading ? "处理中..." : children}
    </motion.button>
  );
}
