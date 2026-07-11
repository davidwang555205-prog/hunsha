/** @type {import('tailwindcss').Config} */
// 品牌设计系统：所有颜色引用 styles/tokens.css 的 CSS 变量，单一事实源。
// 语义命名（primary/accent/danger/bg/surface/border/text），禁止硬编码色值散落组件。
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)"
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          soft: "var(--color-accent-soft)"
        },
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)"
        },
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
          subtle: "var(--color-text-subtle)"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
      fontSize: {
        display: ["var(--text-display)", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["var(--text-h1)", { lineHeight: "1.3", fontWeight: "700" }],
        h2: ["var(--text-h2)", { lineHeight: "1.4", fontWeight: "600" }],
        h3: ["var(--text-h3)", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["var(--text-body)", { lineHeight: "1.6" }],
        sm: ["var(--text-sm)", { lineHeight: "1.5" }],
        caption: ["var(--text-caption)", { lineHeight: "1.5", fontWeight: "500" }]
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)"
      },
      backgroundImage: {
        "brand-gradient": "var(--gradient-brand)",
        "soft-gradient": "var(--gradient-soft)",
        "text-gradient": "var(--gradient-text)"
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        in: "var(--ease-in)",
        spring: "var(--ease-spring)"
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)"
      }
    }
  },
  plugins: []
};
