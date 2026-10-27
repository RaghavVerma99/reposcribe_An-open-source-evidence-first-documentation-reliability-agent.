/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A near-black editorial surface with warm paper type. Color is a
        // signal, not decoration: the signal palette appears on rules, status,
        // and one accent word per section.
        canvas: "#060606",
        paper: "#f4f4ef",
        surface: "#0c0c0c",
        "surface-elevated": "#141414",
        subtle: "#171717",
        "subtle-elevated": "#202020",
        ink: {
          DEFAULT: "#f4f4ef",
          muted: "#a3a39c",
          faint: "#767670",
        },
        line: {
          DEFAULT: "#262624",
          strong: "#3d3d39",
        },
        accent: {
          DEFAULT: "#22c55e",
          hover: "#4ade80",
          soft: "#071a0f",
          strong: "#6ee7a0",
        },
        signal: {
          lime: "#d8ff3e",
          coral: "#ff6a4d",
          azure: "#6aa8ff",
          amber: "#ffc24b",
          lilac: "#b9a6ff",
        },
        ok: { DEFAULT: "#22c55e", soft: "#08210f" },
        warn: { DEFAULT: "#f59e0b", soft: "#261806" },
        danger: { DEFAULT: "#f87171", soft: "#26100f" },
        info: { DEFAULT: "#38bdf8", soft: "#071b26" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Bricolage Grotesque"', "Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
        hand: ["Caveat", "cursive"],
      },
      fontSize: {
        "2xs": ["10.5px", { lineHeight: "15px", letterSpacing: "0.04em" }],
        display: ["60px", { lineHeight: "62px", letterSpacing: "-0.045em", fontWeight: "700" }],
        h1: ["36px", { lineHeight: "42px", letterSpacing: "-0.03em", fontWeight: "700" }],
        h2: ["26px", { lineHeight: "33px", letterSpacing: "-0.025em", fontWeight: "700" }],
        h3: ["15.5px", { lineHeight: "22px", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["13.5px", { lineHeight: "22px" }],
      },
      borderRadius: {
        control: "9px",
        panel: "16px",
        chip: "999px",
      },
      boxShadow: {
        panel: "inset 0 1px 0 0 rgba(255,255,255,0.035)",
        lift: "0 24px 64px -32px rgba(0,0,0,0.9), inset 0 1px 0 0 rgba(255,255,255,0.04)",
        focus: "0 0 0 2px #000000, 0 0 0 4px rgba(34,197,94,0.42)",
      },
      transitionDuration: {
        DEFAULT: "160ms",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        blink: {
          "0%, 45%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 560ms cubic-bezier(0.22, 0.7, 0.24, 1) both",
        "fade-in": "fade-in 500ms ease-out both",
        blink: "blink 1.15s steps(1, end) infinite",
      },
    },
  },
  plugins: [],
};
