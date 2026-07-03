"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Theme = "terminal" | "executive" | "midnight-gold" | "magma" | "aurora";

const VALID_THEMES: readonly Theme[] = [
  "terminal",
  "executive",
  "midnight-gold",
  "magma",
  "aurora",
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
    id: "aurora",
    label: "Aurora",
    description: "Deep forest night, electric green — Bloomberg redesigned by Linear",
    bg: "#060D0A",
    accent: "#10B981",
    accent2: "#14B8A6",
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
      const stored = localStorage.getItem("sl-theme");
      // Migrate removed Liquid Glass theme to its replacement
      const migrated = stored === "liquid-glass" ? "aurora" : stored;
      if (migrated && (VALID_THEMES as string[]).includes(migrated)) {
        setThemeState(migrated as Theme);
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
