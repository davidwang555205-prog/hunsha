/**
 * Select -- 下拉选择（全状态设计）
 * 与原 inputClass 对齐，引用 design token。
 */
import { forwardRef, type SelectHTMLAttributes } from "react";

const baseClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition duration-fast ease-out focus:border-primary focus:ring-2 focus:ring-primary-50 disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-subtle";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => (
    <select ref={ref} className={`${baseClass} ${className}`} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";
