"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { CommandPalette } from "@/components/CommandPalette";
import { PersonalizationEffects } from "@/components/PersonalizationEffects";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <CommandPalette />
        <PersonalizationEffects />
        {children}
      </PreferencesProvider>
    </ThemeProvider>
  );
}
