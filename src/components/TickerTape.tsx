"use client";

import { useEffect, useState } from "react";

interface TapeQuote {
  ticker: string;
  price: number;
  changePercent: number;
}

function TapeItem({ q }: { q: TapeQuote }) {
  const up = q.changePercent >= 0;
  return (
    <span className="inline-flex items-center gap-2 px-4">
      <span
        className="font-mono text-[11px] font-bold"
        style={{ color: `rgb(var(--t-text))` }}
      >
        {q.ticker}
      </span>
      <span className="font-mono text-[11px]" style={{ color: `rgb(var(--t-muted))` }}>
        ${q.price.toFixed(2)}
      </span>
      <span
        className="font-mono text-[11px] font-semibold"
        style={{ color: up ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
      >
        {up ? "▲" : "▼"} {up ? "+" : ""}{q.changePercent.toFixed(2)}%
      </span>
      <span aria-hidden style={{ color: `rgb(var(--t-dim))` }}>·</span>
    </span>
  );
}

export function TickerTape() {
  const [quotes, setQuotes] = useState<TapeQuote[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/watchlist/tape")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const next = (d.quotes ?? []) as TapeQuote[];
          // A transient error or empty refresh must never unmount a running
          // tape, and identical data must not re-render (which could disturb
          // the CSS animation mid-loop).
          setQuotes((prev) => {
            if (next.length === 0 && prev.length > 0) return prev;
            return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
          });
        })
        .catch(() => {});
    load();
    // Refresh in sync with the server-side 60s cache
    const interval = setInterval(load, 65 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (quotes.length === 0) return null;

  // With a short watchlist (e.g. 2 tickers) one pass of the list is far
  // narrower than the screen, so the loop's movement is barely visible.
  // Repeat the list until each half comfortably exceeds any viewport width.
  const reps = Math.max(1, Math.ceil(12 / quotes.length));
  const items = Array.from({ length: reps }, () => quotes).flat();

  return (
    <div
      className="ticker-tape"
      style={{
        height: 36,
        backgroundColor: `var(--card-bg, rgb(var(--t-card)))`,
        borderTop: `1px solid rgb(var(--t-text) / 0.06)`,
        borderBottom: `1px solid rgb(var(--t-text) / 0.06)`,
      }}
      aria-label="Watchlist ticker tape"
      data-testid="ticker-tape"
    >
      <div className="ticker-track">
        {/* Two identical copies — the animation shifts by exactly one copy's
            width (-50%) so the loop is seamless. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="ticker-copy" aria-hidden={copy === 1}>
            {items.map((q, i) => (
              <TapeItem key={`${copy}-${i}-${q.ticker}`} q={q} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
