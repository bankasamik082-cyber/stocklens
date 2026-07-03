"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Theme = "terminal" | "executive" | "midnight-gold" | "magma" | "liquid-glass";

const VALID_THEMES: readonly Theme[] = [
  "terminal",
  "executive",
  "midnight-gold",
  "magma",
  "liquid-glass",
];

export const THEMES: {
  id: Theme;
  label: string;
  description: string;
  bg: string;
  accent: string;
  accent2?: string;
}[] = [
  {
    id: "terminal",
    label: "Terminal",
    description: "Deep navy, electric cyan — Bloomberg meets Linear",
    bg: "#060C18",
    accent: "#00D4FF",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Warm ivory, champagne gold — premium research report",
    bg: "#FAF7F2",
    accent: "#B8870B",
  },
  {
    id: "midnight-gold",
    label: "Midnight Gold",
    description: "Near-black, rich gold — dark sophistication",
    bg: "#05070F",
    accent: "#D4AF37",
  },
  {
    id: "magma",
    label: "Magma",
    description: "Warm organic premium — human, rich, and expensive",
    bg: "#0D0805",
    accent: "#F97316",
    accent2: "#FBBF24",
  },
  {
    id: "liquid-glass",
    label: "Liquid Glass",
    description: "Ultra-frosted glass — Apple Vision Pro spatial aesthetic",
    bg: "#020408",
    accent: "#818CF8",
    accent2: "#38BDF8",
  },
];

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "terminal",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("terminal");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sl-theme") as Theme | null;
      if (stored && (VALID_THEMES as string[]).includes(stored)) {
        setThemeState(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sl-theme", theme);
    } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
