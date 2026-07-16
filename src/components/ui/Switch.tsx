/**
 * Switch -- 开关（受控）
 *
 * 视觉明显的启用/停用切换，替代纯文字按钮。
 * checked=true 启用（success 亮色），checked=false 关闭（灰色轨道）。
 */
type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-success" : "bg-bg ring-1 ring-border"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform duration-fast ease-out ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}
