/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pitch-black canvas with barely-elevated panels: depth comes from
        // hairlines and surface steps, never from heavy shadows.
        canvas: "#000000",
        surface: "#08080a",
        subtle: "#111114",
        ink: { DEFAULT: "#ededf0", muted: "#a1a1aa", faint: "#82828c" },
        line: { DEFAULT: "#1e1e23", strong: "#303038" },
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#6366f1",
          soft: "#15142c",
          strong: "#a5b4fc",
        },
        ok: { DEFAULT: "#4ade80", soft: "#08210f" },
        warn: { DEFAULT: "#fbbf24", soft: "#241a05" },
        danger: { DEFAULT: "#f87171", soft: "#2a0f0f" },
        info: { DEFAULT: "#60a5fa", soft: "#0b1a33" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", "16px"],
      },
      borderRadius: {
        control: "7px",
        panel: "12px",
      },
      boxShadow: {
        panel: "inset 0 1px 0 0 rgba(255,255,255,0.035), 0 12px 32px -24px rgba(0,0,0,1)",
        rail: "inset -1px 0 0 0 rgba(255,255,255,0.04)",
        lift: "0 16px 48px -28px rgba(0,0,0,1), inset 0 1px 0 0 rgba(255,255,255,0.05)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};