"use client";

import { motion } from "framer-motion";
import { useTheme, THEMES, type Theme } from "@/contexts/ThemeContext";
import {
  usePreferences,
  type AnimationSpeed,
  type DataDensity,
} from "@/contexts/PreferencesContext";

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="rounded-xl border px-4 py-3 text-left transition"
            style={{
              borderColor: active ? `rgb(var(--t-accent) / 0.5)` : `rgb(var(--t-text) / 0.08)`,
              backgroundColor: active ? `rgb(var(--t-accent) / 0.08)` : `rgb(var(--t-text) / 0.02)`,
            }}
            data-testid={`pref-${o.id}`}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: active ? `rgb(var(--t-accent))` : `rgb(var(--t-text))` }}
            >
              {o.label}
            </span>
            {o.hint && (
              <p className="mt-0.5 text-[11px]" style={{ color: `rgb(var(--t-dim))` }}>
                {o.hint}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsClient() {
  const { theme, setTheme } = useTheme();
  const { animationSpeed, dataDensity, setAnimationSpeed, setDataDensity } =
    usePreferences();

  return (
    <div className="space-y-10">
      {/* Appearance */}
      <section>
        <div className="label mb-1">Appearance</div>
        <p className="mb-5 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
          Choose a visual theme. Switching is instant.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEMES.map((t, i) => {
            const active = theme === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setTheme(t.id as Theme)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="relative text-left overflow-hidden transition-all duration-200"
                style={{
                  borderRadius: "1.25rem",
                  border: `1px solid ${active ? t.accent + "80" : "rgb(var(--t-text) / 0.08)"}`,
                  backgroundColor: `rgb(var(--t-surface))`,
                  boxShadow: active
                    ? `0 0 0 1px ${t.accent}33, 0 8px 32px ${t.accent}18`
                    : "none",
                  transform: active ? "translateY(-1px)" : "none",
                }}
                data-testid={`theme-card-${t.id}`}
              >
                {/* Gradient preview strip */}
                <div
                  className="relative h-20 w-full overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${t.bg} 0%, ${t.accent}55 100%)`,
                  }}
                >
                  {/* Simulated mini card */}
                  <div
                    className="absolute bottom-3 right-4 w-16 h-9 rounded-xl"
                    style={{
                      backgroundColor: t.bg + "ee",
                      border: `1px solid ${t.accent}28`,
                    }}
                  />
                  {/* Accent bar */}
                  <div
                    className="absolute bottom-5 left-4 w-10 h-1.5 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${t.accent}, ${t.accent2 ?? t.accent})`,
                      boxShadow: `0 0 12px ${t.accent}80`,
                    }}
                  />
                  {/* Dot cluster */}
                  <div className="absolute top-3.5 left-4 flex gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: t.accent, opacity: 0.9 }}
                    />
                    {t.accent2 && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: t.accent2, opacity: 0.7 }}
                      />
                    )}
                  </div>
                  {/* Name in preview */}
                  <div
                    className="absolute top-3 right-4 text-[9px] font-bold tracking-widest uppercase opacity-60"
                    style={{
                      color: t.accent,
                      fontFamily: `var(--font-display), ui-monospace, monospace`,
                    }}
                  >
                    {t.id === "midnight-gold" ? "MG" : t.label.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: `rgb(var(--t-text))` }}
                    >
                      {t.label}
                    </span>
                    {active ? (
                      <motion.span
                        layoutId="theme-check"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: t.accent,
                          color: t.bg,
                        }}
                      >
                        ✓
                      </motion.span>
                    ) : (
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border"
                        style={{ borderColor: `rgb(var(--t-text) / 0.12)` }}
                      />
                    )}
                  </div>
                  <p
                    className="mt-1 text-[11px] leading-snug"
                    style={{ color: `rgb(var(--t-muted))` }}
                  >
                    {t.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Animation speed */}
      <section>
        <div className="label mb-1">Animation Speed</div>
        <p className="mb-4 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
          Control how much motion the interface uses.
        </p>
        <SegmentedControl<AnimationSpeed>
          value={animationSpeed}
          onChange={setAnimationSpeed}
          options={[
            { id: "fast", label: "Fast", hint: "Snappy, minimal transitions" },
            { id: "normal", label: "Normal", hint: "Default animations" },
            { id: "reduced", label: "Reduced Motion", hint: "No animations at all" },
          ]}
        />
      </section>

      {/* Data density */}
      <section>
        <div className="label mb-1">Data Density</div>
        <p className="mb-4 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
          Adjust card padding and spacing across the app.
        </p>
        <SegmentedControl<DataDensity>
          value={dataDensity}
          onChange={setDataDensity}
          options={[
            { id: "compact", label: "Compact", hint: "More data per screen" },
            { id: "comfortable", label: "Comfortable", hint: "Balanced default" },
            { id: "spacious", label: "Spacious", hint: "Extra breathing room" },
          ]}
        />
      </section>

      {/* About */}
      <section>
        <div className="label mb-4">About</div>
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{
            borderColor: `rgb(var(--t-text) / 0.08)`,
            backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
            backdropFilter: `var(--card-blur, none)`,
            WebkitBackdropFilter: `var(--card-blur, none)`,
          }}
        >
          {[
            ["Platform", "StockLens"],
            ["Data sources", "Finnhub, Twelve Data, SEC EDGAR, FMP"],
            ["AI", "Google Gemini 2.5 Flash"],
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
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor: `rgb(var(--t-text) / 0.08)`,
            backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
            backdropFilter: `var(--card-blur, none)`,
            WebkitBackdropFilter: `var(--card-blur, none)`,
          }}
        >
          {[
            ["⌘K / Ctrl+K", "Open command palette"],
            ["↑↓ in palette", "Navigate results"],
            ["↵ in palette", "Select result"],
            ["Esc", "Close palette / modal"],
          ].map(([keys, desc], i, arr) => (
            <div
              key={keys}
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                borderBottom: i < arr.length - 1 ? `1px solid rgb(var(--t-text) / 0.06)` : undefined,
              }}
            >
              <span className="text-sm" style={{ color: `rgb(var(--t-muted))` }}>{desc}</span>
              <kbd
                className="font-mono text-[11px] rounded-lg border px-2 py-1"
                style={{
                  borderColor: `rgb(var(--t-text) / 0.1)`,
                  color: `rgb(var(--t-dim))`,
                  backgroundColor: `rgb(var(--t-text) / 0.04)`,
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
