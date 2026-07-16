/**
 * StatCard -- 后台统计卡（标签 + CountUp 数字 + 环比箭头 + sparkline）。
 *
 * 苹果克制风：语义色仅点缀数字与箭头，不整卡铺色、无左侧色条。
 * 可选 trend（sparkline 每日序列）与 delta（环比变化），二者皆无时底部行不渲染。
 * 卡片用 flex-col + mt-auto，grid 拉齐高度时趋势行贴底对齐。
 */
import type { ReactNode } from "react";
import { CountUp } from "../motion/CountUp";
import { Sparkline } from "../charts/Sparkline";

type StatCardProps = {
  label: string;
  value: number;
  /** 数字 + sparkline 颜色，默认 primary */
  tone?: "primary" | "success" | "danger" | "warning" | "accent";
  /** 可选单位/后缀 */
  suffix?: ReactNode;
  /** sparkline 数据（最近 N 天每日值），不足 2 点不渲染 */
  trend?: number[];
  /** 环比变化：value 为展示文案（如 "12%" / "新增"），up=升/降，invert=true 时颜色反转（失败数减少为绿） */
  delta?: { value: string; up: boolean; invert?: boolean } | null;
  className?: string;
};

const toneColor = {
  primary: "rgb(var(--color-primary))",
  success: "rgb(var(--color-success))",
  danger: "rgb(var(--color-danger))",
  warning: "rgb(var(--color-warning))",
  accent: "rgb(var(--color-accent))"
};

export function StatCard({
  label,
  value,
  tone = "primary",
  suffix,
  trend,
  delta = null,
  className = ""
}: StatCardProps) {
  const color = toneColor[tone];
  const showTrend = trend && trend.length >= 2;
  return (
    <div
      className={`relative flex flex-col rounded-lg bg-surface p-5 shadow-sm ring-1 ring-border ${className}`}
    >
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1 text-2xl font-bold" style={{ color }}>
        <CountUp to={value} duration={1.2} />
        {suffix && <span className="text-sm font-medium text-text-muted">{suffix}</span>}
      </p>
      {(delta || showTrend) && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {delta ? (
            <span
              className={`inline-flex items-center gap-0.5 text-caption font-medium ${
                (delta.invert ? !delta.up : delta.up) ? "text-success" : "text-danger"
              }`}
            >
              <span aria-hidden>{delta.up ? "↑" : "↓"}</span>
              {delta.value}
            </span>
          ) : (
            <span />
          )}
          {showTrend ? (
            <div className="w-24 shrink-0">
              <Sparkline data={trend as number[]} color={color} height={28} />
            </div>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
