/**
 * BlurText -- 逐字模糊渐显入场（借鉴 react-bits BlurText）
 *
 * 拆字为 span，用 motion stagger 逐字 opacity+blur 渐显。
 * 用于登录页主标题首次入场（克制，仅此一处）。
 */
import { motion } from "motion/react";

type BlurTextProps = {
  text: string;
  className?: string;
  /** 单字延迟毫秒，默认 35 */
  stagger?: number;
  /** 单字持续毫秒，默认 400 */
  duration?: number;
  /** 整体延迟毫秒，默认 0 */
  delay?: number;
  /** 标签，默认 h1 */
  as?: "h1" | "h2" | "h3" | "p" | "span";
};

export function BlurText({
  text,
  className,
  stagger = 35,
  duration = 400,
  delay = 0,
  as = "h1"
}: BlurTextProps) {
  const MotionTag = motion[as];
  // 按字符拆分（中文逐字），保留可读性
  const chars = Array.from(text);

  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: stagger / 1000, delayChildren: delay / 1000 }}
    >
      {chars.map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          style={{ display: "inline-block" }}
          variants={{
            hidden: { opacity: 0, filter: "blur(10px)", y: 8 },
            visible: { opacity: 1, filter: "blur(0px)", y: 0 }
          }}
          transition={{ duration: duration / 1000, ease: [0.16, 1, 0.3, 1] }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </MotionTag>
  );
}
