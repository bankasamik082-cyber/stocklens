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
  const [ticker, setTicker]   = useState("");
  const [selected, setSelected] = useState<SectionId[]>([...SECTION_ORDER]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [suggLoading, setSuggLoading]   = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const [watchlist, setWatchlist]               = useState<string[]>(initialWatchlist);
  const [watchlistPending, setWatchlistPending] = useState(false);

  const tickerUpper = ticker.trim().toUpperCase();
  const isSaved     = watchlist.includes(tickerUpper);

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
    if (q.length < 1) { setSuggestions([]); setShowDropdown(false); return; }
    setSuggLoading(true);
    try {
      const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowDropdown((data.results ?? []).length > 0);
      }
    } catch {}
    setSuggLoading(false);
  }, []);

  function onTickerChange(val: string) {
    setTicker(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val.trim()), 300);
  }

  function selectSuggestion(symbol: string) {
    setTicker(symbol); setSuggestions([]); setShowDropdown(false);
    inputRef.current?.focus();
  }

  function toggle(id: SectionId) {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
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
      if (!res.ok) { setError(data.error || "Something went wrong."); setLoading(false); return; }
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
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: tickerUpper }),
        });
        if (res.ok) setWatchlist((prev) => prev.filter((w) => w !== tickerUpper));
      } else {
        const res = await fetch("/api/watchlist/add", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: tickerUpper }),
        });
        if (res.ok) setWatchlist((prev) => [tickerUpper, ...prev]);
      }
    } finally { setWatchlistPending(false); }
  }

  async function handleRemoveWatchlist(t: string) {
    const res = await fetch("/api/watchlist/remove", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: t }),
    });
    if (res.ok) setWatchlist((prev) => prev.filter((w) => w !== t));
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border backdrop-blur-sm"
        style={{
          borderColor: `rgb(var(--t-border) / 0.7)`,
          backgroundColor: `rgb(var(--t-card))`,
        }}
      >
        <LoadingState ticker={ticker.toUpperCase()} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Ticker input */}
      <div className="relative z-10">
        <label
          htmlFor="ticker"
          className="label mb-2 block"
        >
          Stock ticker
        </label>

        <div className="flex items-center gap-3">
          <div ref={dropdownRef} className="relative flex-1">
            <input
              ref={inputRef}
              id="ticker"
              value={ticker}
              onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
              onFocus={(e) => {
                if (suggestions.length > 0) setShowDropdown(true);
                (e.target as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.6)`;
                (e.target as HTMLElement).style.boxShadow = `0 0 0 3px rgb(var(--t-accent) / 0.1)`;
              }}
              onBlur={(e) => {
                (e.target as HTMLElement).style.borderColor = `rgb(var(--t-border))`;
                (e.target as HTMLElement).style.boxShadow = ``;
              }}
              onKeyDown={(e) => { if (e.key === "Escape") setShowDropdown(false); }}
              placeholder="e.g. AAPL"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border px-4 py-3.5 font-mono text-xl tracking-wider outline-none transition"
              style={{
                borderColor: `rgb(var(--t-border))`,
                backgroundColor: `rgb(var(--t-card))`,
                color: `rgb(var(--t-text))`,
              }}
            />

            {/* Autocomplete dropdown */}
            {showDropdown && (
              <div
                className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border shadow-2xl"
                style={{
                  borderColor: `rgb(var(--t-border) / 0.8)`,
                  backgroundColor: `rgb(var(--t-card))`,
                }}
              >
                {suggLoading ? (
                  <div className="px-4 py-3 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                    Searching…
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                    No results
                  </div>
                ) : (
                  <ul>
                    {suggestions.map((s) => (
                      <li key={s.symbol}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.symbol); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
                          style={{ color: `rgb(var(--t-text))` }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.backgroundColor = `rgb(var(--t-accent) / 0.06)`)
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.backgroundColor = ``)
                          }
                        >
                          <span className="font-mono text-sm font-semibold">{s.symbol}</span>
                          <span className="truncate text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                            {s.name}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
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

          {/* Watchlist star */}
          {tickerUpper && (
            <button
              type="button"
              onClick={handleToggleWatchlist}
              disabled={watchlistPending}
              title={isSaved ? "Remove from watchlist" : "Add to watchlist"}
              className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl border text-xl transition disabled:opacity-40"
              style={{
                borderColor: isSaved ? `rgb(var(--t-warn) / 0.4)` : `rgb(var(--t-border))`,
                backgroundColor: isSaved ? `rgb(var(--t-warn) / 0.1)` : `rgb(var(--t-card))`,
                color: isSaved ? `rgb(var(--t-warn))` : `rgb(var(--t-dim))`,
              }}
            >
              {isSaved ? "★" : "☆"}
            </button>
          )}
        </div>

        {/* Preset chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = ticker === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setTicker(p); setSuggestions([]); setShowDropdown(false); }}
                className="rounded-full border px-3 py-1 font-mono text-xs font-semibold transition"
                style={{
                  borderColor: active ? `rgb(var(--t-accent) / 0.5)` : `rgb(var(--t-border))`,
                  backgroundColor: active ? `rgb(var(--t-accent) / 0.1)` : ``,
                  color: active ? `rgb(var(--t-accent))` : `rgb(var(--t-muted))`,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: `rgb(var(--t-border) / 0.7)`,
          backgroundColor: `rgb(var(--t-card))`,
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="label">Sections</span>
            <span
              className="ml-2 text-xs"
              style={{ color: `rgb(var(--t-dim))` }}
            >
              {selected.length}/{SECTION_ORDER.length} selected
            </span>
          </div>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setSelected([...SECTION_ORDER])}
              className="font-medium transition"
              style={{ color: `rgb(var(--t-accent))` }}
            >
              All
            </button>
            <span style={{ color: `rgb(var(--t-border))` }}>·</span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="font-medium transition"
              style={{ color: `rgb(var(--t-muted))` }}
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
                className="flex cursor-pointer select-none items-center gap-3 rounded-xl border px-4 py-3 text-sm transition"
                style={{
                  borderColor: on ? `rgb(var(--t-accent) / 0.4)` : `rgb(var(--t-border) / 0.6)`,
                  backgroundColor: on ? `rgb(var(--t-accent) / 0.06)` : ``,
                  color: on ? `rgb(var(--t-text))` : `rgb(var(--t-muted))`,
                }}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
                  style={{
                    borderColor: on ? `rgb(var(--t-accent))` : `rgb(var(--t-border))`,
                    backgroundColor: on ? `rgb(var(--t-accent))` : ``,
                  }}
                >
                  {on && (
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: `rgb(var(--t-bg))` }}
                    >
                      ✓
                    </span>
                  )}
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
        className="btn-accent w-full py-3.5 text-sm"
      >
        Generate report
      </button>
      <p className="text-center text-xs" style={{ color: `rgb(var(--t-dim))` }}>
        Research only — not financial advice. Every section cites its sources.
      </p>
    </form>
  );
}
