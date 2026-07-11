/**
 * Textarea -- 多行文本（全状态设计，可调高度）
 */
import { forwardRef, type TextareaHTMLAttributes } from "react";

const baseClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition duration-fast ease-out focus:border-primary focus:ring-2 focus:ring-primary-50 disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-subtle resize-vertical";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea ref={ref} className={`${baseClass} ${className}`} {...props} />
  )
);
Textarea.displayName = "Textarea";
