/**
 * AnimatedTooltip -- 悬浮提示气泡（借鉴 react-bits AnimatedTooltip）
 *
 * hover/focus 触发，气泡淡入上浮。用于工作台参数字段旁"?"说明。
 * 纯受控：children 为触发元素，content 为提示文案。
 */
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

type AnimatedTooltipProps = {
  content: ReactNode;
  children: ReactNode;
  /** 气泡位置，默认 top */
  side?: "top" | "bottom";
};

export function AnimatedTooltip({ content, children, side = "top" }: AnimatedTooltipProps) {
  const [open, setOpen] = useState(false);
  const yOffset = side === "top" ? -6 : 6;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: yOffset, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: yOffset, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-md bg-[var(--color-text)] px-3 py-2 text-xs leading-5 text-surface shadow-md ${
              side === "top" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
