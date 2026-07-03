import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Legacy colors kept for existing components ──────────────────────────
      colors: {
        ink: {
          950: "#05101e",
          900: "#09152a",
          800: "#0e1e3b",
          750: "#122449",
          700: "#1a2f57",
          600: "#263f6a",
          500: "#344f80",
        },
        brand: {
          50: "#eef2ff",
          100: "#dde6ff",
          200: "#bfcfff",
          300: "#93adff",
          400: "#6b8cff",
          500: "#4f70f0",
          600: "#3a55d9",
          700: "#2e43ad",
          800: "#283889",
          900: "#243070",
        },

        // ── Semantic / theme-aware color tokens ─────────────────────────────
        t: {
          bg:      "rgb(var(--t-bg)      / <alpha-value>)",
          surface: "rgb(var(--t-surface) / <alpha-value>)",
          card:    "rgb(var(--t-card)    / <alpha-value>)",
          border:  "rgb(var(--t-border)  / <alpha-value>)",
          accent:  "rgb(var(--t-accent)  / <alpha-value>)",
          text:    "rgb(var(--t-text)    / <alpha-value>)",
          muted:   "rgb(var(--t-muted)   / <alpha-value>)",
          dim:     "rgb(var(--t-dim)     / <alpha-value>)",
          success: "rgb(var(--t-success) / <alpha-value>)",
          danger:  "rgb(var(--t-danger)  / <alpha-value>)",
          warn:    "rgb(var(--t-warn)    / <alpha-value>)",
        },
      },

      fontFamily: {
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        serif:   ["Georgia", "serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },

      boxShadow: {
        "glow-sm":    "0 0 20px -5px rgba(79, 112, 240, 0.3)",
        "glow-md":    "0 0 35px -8px rgba(79, 112, 240, 0.4)",
        "card":       "0 4px 24px -4px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 32px -6px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)",
        "t-glow":     "0 0 24px -4px rgb(var(--t-accent) / 0.35)",
        "t-card":     "0 4px 24px -4px rgb(var(--t-bg) / 0.8), 0 1px 4px rgb(var(--t-bg) / 0.5)",
        "glass":      "0 12px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)",
      },

      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },

      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },

      animation: {
        "glow-pulse":  "glow-pulse 3s ease-in-out infinite",
        "float":       "float 6s ease-in-out infinite",
        "slide-up":    "slide-up 0.4s ease-out",
        "gradient-x":  "gradient-x 5s ease infinite",
        "fade-in":     "fade-in 0.3s ease-out",
        "scale-in":    "scale-in 0.2s ease-out",
        "shimmer":     "shimmer 1.8s linear infinite",
      },

      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%":      { opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
