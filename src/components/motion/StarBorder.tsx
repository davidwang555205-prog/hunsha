/**
 * StarBorder -- 星光流边框（借鉴 react-bits StarBorder，纯 CSS 零依赖）
 *
 * 两个 radial-gradient 光斑沿边框水平往返流动，形成星光流边框。
 * 用于主 CTA 按钮（"开始生成"）增强视觉焦点。
 * 配色已接项目 token：内部按钮 bg-primary，星光默认粉红（var(--color-rose)）。
 * 需在 tailwind.config 注册 star-movement-top/bottom keyframes。
 */
import type { ElementType, ReactNode, CSSProperties } from "react";

type StarBorderProps<T extends ElementType> = React.ComponentPropsWithoutRef<T> & {
  as?: T;
  className?: string;
  children?: ReactNode;
  /** 星光颜色，默认粉红 */
  color?: string;
  speed?: CSSProperties["animationDuration"];
  thickness?: number;
};

export function StarBorder<T extends ElementType = "button">({
  as,
  className = "",
  color = "rgb(var(--color-rose))",
  speed = "8s",
  thickness = 1,
  children,
  ...rest
}: StarBorderProps<T>) {
  const Component = (as || "button") as ElementType;

  return (
    <Component
      className={`group relative inline-block overflow-hidden rounded-md ${className}`}
      {...(rest as object)}
      style={{ padding: `${thickness}px 0`, ...((rest as { style?: CSSProperties }).style ?? {}) }}
    >
      <div
        aria-hidden
        className="absolute bottom-[-11px] right-[-250%] z-0 h-[50%] w-[300%] animate-star-movement-bottom rounded-full opacity-70"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <div
        aria-hidden
        className="absolute left-[-250%] top-[-10px] z-0 h-[50%] w-[300%] animate-star-movement-top rounded-full opacity-70"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <div className="relative z-[1] rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-white transition duration-fast ease-out group-disabled:opacity-60">
        {children}
      </div>
    </Component>
  );
}
