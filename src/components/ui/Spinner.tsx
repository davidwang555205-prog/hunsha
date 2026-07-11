/** Spinner -- 加载指示（SVG 旋转环，主色） */
type SpinnerProps = {
  size?: number;
  className?: string;
};

export function Spinner({ size = 18, className }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
