"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { CommandPalette } from "@/components/CommandPalette";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CommandPalette />
      {children}
    </ThemeProvider>
  );
}
