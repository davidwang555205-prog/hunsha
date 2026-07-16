/**
 * Button -- 按钮（cva 变体，全状态设计 §5.7）
 *
 * 变体：primary（品牌渐变）/ secondary（描边）/ ghost（幽灵）/ danger（红色）
 * 状态：default/hover/active/focus/disabled/loading
 * props 范式遵循 react-bits：className 透传 + ...props 透传到根 DOM。
 */
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Spinner";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium",
    "transition duration-fast ease-out active:scale-[0.98]",
    "focus-visible:ring-2 focus-visible:ring-primary-50",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-sm hover:bg-primary-600",
        secondary: "bg-surface text-text ring-1 ring-border hover:bg-bg hover:ring-border-strong",
        ghost: "text-text-muted hover:bg-bg hover:text-text",
        danger: "bg-danger text-white shadow-sm hover:brightness-95",
        link: "text-primary px-1 py-0.5 font-normal underline-offset-2 hover:underline"
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2.5 text-sm",
        lg: "px-5 py-3 text-base"
      },
      block: {
        true: "w-full",
        false: ""
      }
    },
    defaultVariants: { variant: "primary", size: "md", block: false }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    children: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, block, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
});

export { buttonVariants };
