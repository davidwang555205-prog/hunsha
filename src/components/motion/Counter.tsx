/**
 * Counter -- 数字滚动（借鉴 react-bits Counter）
 *
 * useSpring + useTransform 逐位翻牌。用于后台统计卡数字（账号数/请求/成功/失败）、额度剩余。
 * 进入视口时触发动画。
 */
import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";

type CounterProps = {
  value: number;
  /** 持续毫秒，默认 800 */
  duration?: number;
  className?: string;
  /** 千分位格式化，默认 false */
  format?: boolean;
};

export function Counter({ value, duration = 800, className, format = false }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const motionValue = useMotionValue(0);
  // stiffness 由 duration 近似：短 duration -> 高 stiffness
  const spring = useSpring(motionValue, { stiffness: 60, damping: 18, duration: duration / 1000 });
  const display = useTransform(spring, (latest) => {
    const rounded = Math.round(latest);
    return format ? rounded.toLocaleString("zh-CN") : String(rounded);
  });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}
