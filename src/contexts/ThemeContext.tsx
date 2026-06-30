"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Theme = "terminal" | "executive" | "midnight-gold";

export const THEMES: { id: Theme; label: string; description: string }[] = [
  {
    id: "terminal",
    label: "Terminal",
    description: "Deep navy, electric cyan — Bloomberg meets Linear",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Warm ivory, champagne gold — premium research report",
  },
  {
    id: "midnight-gold",
    label: "Midnight Gold",
    description: "Near-black, rich gold — dark sophistication",
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

  // Read from localStorage on mount (client only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sl-theme") as Theme | null;
      if (stored && ["terminal", "executive", "midnight-gold"].includes(stored)) {
        setThemeState(stored);
      }
    } catch {}
  }, []);

  // Apply to <html> and persist whenever theme changes
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
