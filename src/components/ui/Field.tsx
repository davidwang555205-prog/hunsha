/**
 * Field -- label + 控件包装（label 上 input 下，间距 --space-3）
 *
 * 通过 render prop 或 children 传入控件，统一 label/错误信息布局。
 * 替代原 App.tsx 的 <label className="block space-y-2"> 模式。
 */
import type { ReactNode } from "react";

type FieldProps = {
  label: ReactNode;
  /** 控件，通常为 Input/Select/Textarea */
  children: ReactNode;
  /** 可选错误信息，渲染在控件下方 */
  error?: string;
  /** 可选说明文字 */
  hint?: ReactNode;
  className?: string;
  /** label 旁的可选附加（如必填标记） */
  labelExtra?: ReactNode;
};

export function Field({ label, children, error, hint, className = "", labelExtra }: FieldProps) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="flex items-center justify-between text-sm font-medium text-text">
        <span>{label}</span>
        {labelExtra}
      </span>
      {children}
      {hint && <span className="block text-xs leading-5 text-text-muted">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}
