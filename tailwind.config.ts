import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "glow-sm": "0 0 20px -5px rgba(79, 112, 240, 0.3)",
        "glow-md": "0 0 35px -8px rgba(79, 112, 240, 0.4)",
        "card": "0 4px 24px -4px rgba(0, 0, 0, 0.5), 0 1px 4px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 32px -6px rgba(0, 0, 0, 0.6), 0 1px 4px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "shimmer": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
      },
      animation: {
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "gradient-x": "gradient-x 4s ease infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
