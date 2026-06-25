"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SECTION_LABELS, SECTION_ORDER, type SectionId } from "@/lib/types";

const PRESETS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];

interface Suggestion {
  symbol: string;
  name: string;
  exchange: string;
}

interface SearchFormProps {
  initialWatchlist?: string[];
}

export function SearchForm({ initialWatchlist = [] }: SearchFormProps) {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [selected, setSelected] = useState<SectionId[]>([...SECTION_ORDER]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Watchlist
  const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
  const [watchlistPending, setWatchlistPending] = useState(false);

  const tickerUpper = ticker.trim().toUpperCase();
  const isSaved = watchlist.includes(tickerUpper);

  // Close dropdown on click outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setSuggLoading(true);
    try {
      const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowDropdown((data.results ?? []).length > 0);
      }
    } catch {
      // silent
    } finally {
      setSuggLoading(false);
    }
  }, []);

  function onTickerChange(val: string) {
    setTicker(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val.trim()), 300);
  }

  function selectSuggestion(symbol: string) {
    setTicker(symbol);
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }

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

  async function handleToggleWatchlist() {
    if (!tickerUpper || watchlistPending) return;
    setWatchlistPending(true);
    try {
      if (isSaved) {
        const res = await fetch("/api/watchlist/remove", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: tickerUpper }),
        });
        if (res.ok) setWatchlist((prev) => prev.filter((w) => w !== tickerUpper));
      } else {
        const res = await fetch("/api/watchlist/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: tickerUpper }),
        });
        if (res.ok) setWatchlist((prev) => [tickerUpper, ...prev]);
      }
    } finally {
      setWatchlistPending(false);
    }
  }

  async function handleRemoveWatchlist(t: string) {
    const res = await fetch("/api/watchlist/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: t }),
    });
    if (res.ok) setWatchlist((prev) => prev.filter((w) => w !== t));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-ink-800/50 shadow-card backdrop-blur-sm">
        <LoadingState ticker={ticker.toUpperCase()} />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Ticker input + autocomplete — relative z-10 so the dropdown stacking
            context paints above the sections card that follows in the DOM */}
        <div className="relative z-10 rounded-2xl border border-white/[0.07] bg-ink-800/50 p-5 shadow-card backdrop-blur-sm">
          <label
            htmlFor="ticker"
            className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500"
          >
            Stock ticker
          </label>

          <div className="flex items-center gap-3">
            {/* Input + dropdown wrapper */}
            <div ref={dropdownRef} className="relative flex-1">
              <input
                ref={inputRef}
                id="ticker"
                value={ticker}
                onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowDropdown(false);
                }}
                placeholder="e.g. AAPL"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-ink-600 bg-ink-900/80 px-4 py-3.5 font-mono text-xl tracking-wider text-white placeholder-ink-600 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              />

              {/* Autocomplete dropdown */}
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900 shadow-2xl">
                  {suggLoading ? (
                    <div className="px-4 py-3 text-xs text-slate-500">Searching…</div>
                  ) : suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500">No results</div>
                  ) : (
                    <ul>
                      {suggestions.map((s) => (
                        <li key={s.symbol}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault(); // prevent blur before click
                              selectSuggestion(s.symbol);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-ink-800"
                          >
                            <span className="font-mono text-sm font-semibold text-white">
                              {s.symbol}
                            </span>
                            <span className="truncate text-xs text-slate-500">
                              {s.name}
                            </span>
                            <span className="ml-auto shrink-0 text-[10px] text-slate-700">
                              {s.exchange}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Watchlist star button */}
            {tickerUpper && (
              <button
                type="button"
                onClick={handleToggleWatchlist}
                disabled={watchlistPending}
                title={isSaved ? "Remove from watchlist" : "Add to watchlist"}
                className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl border text-xl transition disabled:opacity-40 ${
                  isSaved
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-ink-600 bg-ink-900/60 text-slate-500 hover:border-ink-500 hover:text-slate-300"
                }`}
              >
                {isSaved ? "★" : "☆"}
              </button>
            )}
          </div>

          {/* Preset chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setTicker(p);
                  setSuggestions([]);
                  setShowDropdown(false);
                }}
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
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Sections
              </span>
              <span className="ml-2 text-xs text-slate-700">
                {selected.length}/{SECTION_ORDER.length} selected
              </span>
            </div>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelected([...SECTION_ORDER])}
                className="font-medium text-brand-400 transition hover:text-brand-300"
              >
                All
              </button>
              <span className="text-ink-600">·</span>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="font-medium text-slate-600 transition hover:text-slate-400"
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
                  className={`flex cursor-pointer select-none items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    on
                      ? "border-brand-500/40 bg-brand-500/10 text-white"
                      : "border-white/[0.05] bg-ink-900/40 text-slate-500 hover:border-white/[0.08] hover:text-slate-300"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      on ? "border-brand-500 bg-brand-500" : "border-ink-600 bg-ink-900"
                    }`}
                  >
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

      {/* Watchlist — always visible so users can discover the feature */}
      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-ink-800/50 p-5 shadow-card backdrop-blur-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Watchlist
        </h2>
        {watchlist.length === 0 ? (
          <p className="text-xs text-slate-700">
            No tickers saved yet. Type a ticker above and click{" "}
            <span className="text-slate-500">☆</span> to save it here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {watchlist.map((t) => (
              <div
                key={t}
                className={`group flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                  t === tickerUpper
                    ? "border-brand-500/50 bg-brand-500/15"
                    : "border-ink-600 bg-ink-900/60 hover:border-ink-500"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTicker(t);
                    setSuggestions([]);
                    setShowDropdown(false);
                  }}
                  className={`font-mono text-xs font-semibold transition ${
                    t === tickerUpper ? "text-brand-300" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {t}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveWatchlist(t)}
                  title={`Remove ${t}`}
                  className="text-[10px] text-slate-700 transition hover:text-red-400 group-hover:text-slate-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
