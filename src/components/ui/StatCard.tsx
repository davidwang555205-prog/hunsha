/**
 * StatCard -- 后台统计卡（左侧色条 + 标签 + Counter 数字）
 *
 * 用于后台 4 张统计卡（账号数/总请求/成功/失败），数字滚动入场。
 * 色条用语义色区分指标。
 */
import type { ReactNode } from "react";
import { Counter } from "../motion/Counter";

type StatCardProps = {
  label: string;
  value: number;
  /** 左侧色条 + 数字颜色，默认 primary */
  tone?: "primary" | "success" | "danger" | "warning" | "accent";
  /** 可选单位/后缀 */
  suffix?: ReactNode;
  className?: string;
};

const toneClass = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  accent: "var(--color-accent)"
};

export function StatCard({ label, value, tone = "primary", suffix, className = "" }: StatCardProps) {
  const color = toneClass[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border ${className}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1 text-2xl font-bold" style={{ color }}>
        <Counter value={value} />
        {suffix && <span className="text-sm font-medium text-text-muted">{suffix}</span>}
      </p>
    </div>
  );
}
