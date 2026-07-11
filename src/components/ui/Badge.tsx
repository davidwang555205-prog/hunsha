/**
 * Badge -- 标签/徽标（胶囊式，全状态语义色）
 * 变体：default/primary/success/danger/warning
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
  {
    variants: {
      variant: {
        default: "bg-bg text-text-muted ring-border",
        primary: "bg-primary-50 text-primary ring-primary-100",
        success: "bg-success/10 text-success ring-success/20",
        danger: "bg-danger/10 text-danger ring-danger/20",
        warning: "bg-warning/10 text-warning ring-warning/20"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ variant, className = "", children, ...props }: BadgeProps) {
  return (
    <span className={badgeVariants({ variant, className })} {...props}>
      {children}
    </span>
  );
}
