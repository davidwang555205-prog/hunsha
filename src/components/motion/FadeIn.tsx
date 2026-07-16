/**
 * FadeIn -- 入场包装器（借鉴 react-bits FadeContent/AnimatedContent）
 *
 * fade + 方向 + delay，用 motion 的 useInView 触发（进入视口才动画）。
 * 用于路由页面切换淡入、面板展开、列表 stagger 入场。
 *
 * 注意：不用 filter:blur —— 该属性会创建层叠上下文 + fixed 包含块，把页面内
 * 的 fixed 弹窗困住（被顶栏压住）。只用 opacity + transform；transform 终态
 * motion 输出 transform:none，不残留包含块。弹窗一律走 Modal（Portal 到 body）。
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

type FadeInProps = {
  children: ReactNode;
  /** 入场方向，默认 up */
  direction?: Direction;
  /** 延迟毫秒，用于 stagger */
  delay?: number;
  /** 持续毫秒，默认 240（--duration-base） */
  duration?: number;
  /** 是否仅进入视口一次后不再重播，默认 true */
  once?: boolean;
  /** 视口外的提前量，默认 0.1 */
  amount?: number;
  className?: string;
  /** 作为某个 HTML 元素渲染（默认 div） */
  as?: "div" | "section" | "article" | "li" | "span";
};

const offsetMap: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 16 },
  down: { x: 0, y: -16 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
  none: { x: 0, y: 0 }
};

export function FadeIn({
  children,
  direction = "up",
  delay = 0,
  duration = 240,
  once = true,
  amount = 0.1,
  className,
  as = "div"
}: FadeInProps) {
  const offset = offsetMap[direction];
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: duration / 1000, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}
