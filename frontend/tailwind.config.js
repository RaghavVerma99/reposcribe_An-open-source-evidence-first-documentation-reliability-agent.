/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep indigo-navy canvas instead of pitch black; the product lifts a
        // saturated violet/indigo accent out of it with very little contrast
        // risk. Hairlines and soft glows do the rest.
        canvas: "#0a0c1a",
        surface: "#101229",
        "surface-elevated": "#161a3a",
        subtle: "#181c36",
        "subtle-elevated": "#1f2444",
        ink: {
          DEFAULT: "#f0f1f8",
          muted: "#9aa0c4",
          faint: "#636b95",
        },
        line: {
          DEFAULT: "#232955",
          strong: "#2d3470",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#7c7ff5",
          glow: "#818cf8",
          soft: "#181a40",
          strong: "#c4b9ff",
          violet: "#8b5cf6",
          "violet-glow": "#a78bfa",
        },
        ok: { DEFAULT: "#10b981", soft: "#082a1f" },
        warn: { DEFAULT: "#f59e0b", soft: "#2a1f08" },
        danger: { DEFAULT: "#ef4444", soft: "#2a0e0e" },
        info: { DEFAULT: "#22d3ee", soft: "#082a35" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        display: ["64px", { lineHeight: "70px", letterSpacing: "-0.04em", fontWeight: "600" }],
        h1: ["36px", { lineHeight: "44px", letterSpacing: "-0.025em", fontWeight: "600" }],
        h2: ["22px", { lineHeight: "28px", letterSpacing: "-0.012em", fontWeight: "600" }],
        h3: ["15px", { lineHeight: "20px", letterSpacing: "-0.005em", fontWeight: "600" }],
        body: ["13.5px", { lineHeight: "20px" }],
      },
      borderRadius: {
        control: "10px",
        panel: "16px",
        chip: "999px",
      },
      boxShadow: {
        panel: "inset 0 1px 0 0 rgba(255,255,255,0.04)",
        rail: "inset -1px 0 0 0 rgba(99,102,241,0.06)",
        lift: "0 16px 48px -28px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.04)",
        glow: "0 0 0 1px rgba(124,127,245,0.55), 0 0 32px -8px rgba(99,102,241,0.55)",
        accent: "0 0 0 1px rgba(124,127,245,0.4), 0 0 28px -8px rgba(99,102,241,0.5)",
        halo: "0 0 32px -8px rgba(99,102,241,0.45), 0 0 0 1px rgba(124,127,245,0.45)",
        focus: "0 0 0 2px #0a0c1a, 0 0 0 4px rgba(124,127,245,0.32)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      backgroundImage: {
        "violet-glow":
          "radial-gradient(60% 55% at 60% 60%, rgba(124,58,237,0.22), transparent 70%)",
        "indigo-fade":
          "radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,0.16), transparent 70%)",
        "accent-gradient":
          "linear-gradient(135deg, #c4b9ff 0%, #818cf8 50%, #6366f1 100%)",
        "violet-gradient":
          "linear-gradient(135deg, #d8b4fe 0%, #a78bfa 50%, #818cf8 100%)",
      },
    },
  },
  plugins: [],
};