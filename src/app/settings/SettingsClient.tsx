"use client";

import { motion } from "framer-motion";
import { useTheme, THEMES, type Theme } from "@/contexts/ThemeContext";

export function SettingsClient() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <section>
        <div className="label mb-4">Appearance</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t, i) => {
            const active = theme === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setTheme(t.id as Theme)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative text-left rounded-xl border p-4 transition-all duration-150"
                style={{
                  borderColor: active
                    ? `rgb(var(--t-accent) / 0.5)`
                    : `rgb(var(--t-border) / 0.8)`,
                  backgroundColor: active
                    ? `rgb(var(--t-accent) / 0.06)`
                    : `rgb(var(--t-surface))`,
                }}
              >
                {active && (
                  <motion.span
                    layoutId="theme-check"
                    className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: `rgb(var(--t-accent))`,
                      color: `rgb(var(--t-bg))`,
                    }}
                  >
                    ✓
                  </motion.span>
                )}
                <div
                  className="mb-1 text-sm font-semibold"
                  style={{ color: `rgb(var(--t-text))` }}
                >
                  {t.label}
                </div>
                <div className="text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                  {t.description}
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* About */}
      <section>
        <div className="label mb-4">About</div>
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{
            borderColor: `rgb(var(--t-border) / 0.7)`,
            backgroundColor: `rgb(var(--t-surface))`,
          }}
        >
          {[
            ["Platform", "StockLens"],
            ["Data sources", "Finnhub, Twelve Data, SEC EDGAR, FMP"],
            ["AI", "Google Gemini 2.0 Flash"],
            ["Infrastructure", "Next.js 14, Supabase, Vercel"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span style={{ color: `rgb(var(--t-muted))` }}>{k}</span>
              <span style={{ color: `rgb(var(--t-text))` }} className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
          StockLens is for research and education only. Nothing here is financial advice.
        </p>
      </section>

      {/* Keyboard shortcuts */}
      <section>
        <div className="label mb-4">Keyboard shortcuts</div>
        <div
          className="rounded-xl border divide-y divide-t-border/50"
          style={{
            borderColor: `rgb(var(--t-border) / 0.7)`,
          }}
        >
          {[
            ["⌘K / Ctrl+K", "Open command palette"],
            ["↑↓ in palette", "Navigate results"],
            ["↵ in palette", "Select result"],
            ["Esc", "Close palette / modal"],
          ].map(([keys, desc]) => (
            <div
              key={keys}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderColor: `rgb(var(--t-border) / 0.5)` }}
            >
              <span className="text-sm" style={{ color: `rgb(var(--t-muted))` }}>{desc}</span>
              <kbd
                className="font-mono text-[11px] rounded border px-2 py-0.5"
                style={{
                  borderColor: `rgb(var(--t-border))`,
                  color: `rgb(var(--t-dim))`,
                }}
              >
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
