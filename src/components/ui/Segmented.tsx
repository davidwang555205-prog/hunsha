/**
 * Segmented -- 分段切换器，统一 tab / 范围 / 状态筛选等切换交互。
 *
 * 胶囊风格：容器浅底，选中项 primary 底色，未选中 text-muted + hover。
 * 替代散落的裸 <button> tab（HistoryPage 时间范围、AdminEnginesPage tab 等），保持视觉统一。
 */
type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className
}: SegmentedProps<T>) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div
      className={["inline-flex items-center gap-1 rounded-md bg-bg p-1", className].filter(Boolean).join(" ")}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              "rounded font-medium transition active:scale-[0.98]",
              pad,
              active
                ? "bg-primary text-white shadow-sm"
                : "text-text-muted hover:bg-surface hover:text-text"
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
