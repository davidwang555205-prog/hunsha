/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aura: {
          cream: "#F8F4EC",
          porcelain: "#FFFCF7",
          beige: "#E8DDCF",
          sand: "#D7C8B5",
          stone: "#BDB5AA",
          sage: "#A6AA96",
          clay: "#B58F7A",
          charcoal: "#2E2B28",
          muted: "#6F6860"
        }
      },
      boxShadow: {
        aura: "0 18px 45px rgba(78, 66, 53, 0.10)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};
