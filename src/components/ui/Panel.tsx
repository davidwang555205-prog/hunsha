/** Panel -- 卡片/面板容器（= 原 panelClass：surface 底 + 阴影 + 描边 + 圆角） */
import type { HTMLAttributes } from "react";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /** 去除内边距（仅作容器时） */
  flush?: boolean;
};

export function Panel({ className = "", flush, children, ...props }: PanelProps) {
  return (
    <section
      className={`${flush ? "" : "p-5"} rounded-md bg-surface shadow-sm ring-1 ring-border ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
