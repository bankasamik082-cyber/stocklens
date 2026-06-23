"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SECTION_LABELS, SECTION_ORDER, type SectionId } from "@/lib/types";

const PRESETS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];

export function SearchForm() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [selected, setSelected] = useState<SectionId[]>([...SECTION_ORDER]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: SectionId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const t = ticker.trim().toUpperCase();
    if (!t) return setError("Enter a ticker, like AAPL or NVDA.");
    if (selected.length === 0) return setError("Pick at least one report section.");

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t, sections: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        setLoading(false);
        return;
      }
      router.push(`/report/${data.id}`);
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-ink-800/50 shadow-card backdrop-blur-sm">
        <LoadingState ticker={ticker.toUpperCase()} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Ticker input */}
      <div className="rounded-2xl border border-white/[0.07] bg-ink-800/50 p-5 shadow-card backdrop-blur-sm">
        <label htmlFor="ticker" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">
          Stock ticker
        </label>
        <div className="flex items-center gap-3">
          <input
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 rounded-xl border border-ink-600 bg-ink-900/80 px-4 py-3.5 font-mono text-xl tracking-wider text-white placeholder-ink-600 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
          {ticker && (
            <span className="rounded-lg border border-white/[0.06] bg-ink-700/60 px-3 py-2 font-mono text-sm text-slate-400">
              {ticker}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTicker(p)}
              className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold transition ${
                ticker === p
                  ? "border-brand-500/50 bg-brand-500/15 text-brand-300"
                  : "border-ink-600 text-slate-500 hover:border-ink-500 hover:text-slate-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="rounded-2xl border border-white/[0.07] bg-ink-800/50 p-5 shadow-card backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sections</span>
            <span className="ml-2 text-xs text-slate-700">{selected.length}/{SECTION_ORDER.length} selected</span>
          </div>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setSelected([...SECTION_ORDER])}
              className="text-brand-400 hover:text-brand-300 transition font-medium"
            >
              All
            </button>
            <span className="text-ink-600">·</span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-slate-600 hover:text-slate-400 transition font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {SECTION_ORDER.map((id) => {
            const on = selected.includes(id);
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition select-none ${
                  on
                    ? "border-brand-500/40 bg-brand-500/10 text-white"
                    : "border-white/[0.05] bg-ink-900/40 text-slate-500 hover:border-white/[0.08] hover:text-slate-300"
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                  on ? "border-brand-500 bg-brand-500" : "border-ink-600 bg-ink-900"
                }`}>
                  {on && <span className="text-[9px] font-bold text-white">✓</span>}
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(id)}
                  className="sr-only"
                />
                {SECTION_LABELS[id]}
              </label>
            );
          })}
        </div>
      </div>

      <ErrorMessage message={error} />

      <button
        type="submit"
        className="w-full rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:from-brand-400 hover:to-brand-500 hover:shadow-brand-500/35"
      >
        Generate report
      </button>
      <p className="text-center text-xs text-slate-700">
        Research only — not financial advice. Every section cites its sources.
      </p>
    </form>
  );
}
