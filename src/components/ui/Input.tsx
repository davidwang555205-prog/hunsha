/**
 * Input -- 文本输入（全状态设计：default/hover/focus/disabled/error）
 * 与原 inputClass 对齐，引用 design token。
 */
import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

const baseClass =
  "w-full rounded-md border bg-surface px-3 py-2.5 text-sm text-text outline-none transition duration-fast ease-out disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-subtle";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    const borderClass = error
      ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
      : "border-border focus:border-primary focus:ring-2 focus:ring-primary-50";
    return <input ref={ref} className={`${baseClass} ${borderClass} ${className}`} {...props} />;
  }
);
Input.displayName = "Input";
