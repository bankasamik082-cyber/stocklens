"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { CommandPalette } from "@/components/CommandPalette";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <CommandPalette />
        {children}
      </PreferencesProvider>
    </ThemeProvider>
  );
}
