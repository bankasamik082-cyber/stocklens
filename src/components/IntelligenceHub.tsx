"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, CalendarClock, Landmark } from "lucide-react";

// ---- Types -------------------------------------------------------------------

interface WatchQuote {
  ticker: string;
  price: number | null;
  changePercent: number | null;
  spark: number[];
}

interface UpcomingEarning {
  ticker: string;
  companyName: string;
  date: string;
  hour: string;
}

interface SenateTrade {
  name: string;
  ticker: string;
  type: string;
  amount: string;
  date: string;
}

// ---- Sparkline ----------------------------------------------------------------

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return null;
  const w = 64;
  const h = 22;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 3) - 1.5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        stroke={up ? `rgb(var(--t-success))` : `rgb(var(--t-danger))`}
      />
    </svg>
  );
}

// ---- Watchlist strip ------------------------------------------------------------

function WatchlistStrip({ hasWatchlist }: { hasWatchlist: boolean }) {
  const [quotes, setQuotes] = useState<WatchQuote[] | null>(null);

  useEffect(() => {
    if (!hasWatchlist) { setQuotes([]); return; }
    let cancelled = false;
    fetch("/api/watchlist/quotes")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setQuotes(d.quotes ?? []); })
      .catch(() => { if (!cancelled) setQuotes([]); });
    return () => { cancelled = true; };
  }, [hasWatchlist]);

  if (!hasWatchlist) {
    return (
      <div className="card hover-card px-5 py-4 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
        ★ Add stocks to your watchlist to see live prices here.
      </div>
    );
  }

  if (quotes === null) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[86px] w-[150px] shrink-0 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) return null;

  return (
    <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {quotes.map((q) => {
        const up = (q.changePercent ?? 0) >= 0;
        return (
          <Link
            key={q.ticker}
            href={`/dashboard?ticker=${q.ticker}`}
            className="card hover-card min-w-[150px] shrink-0 px-4 py-3"
            data-testid={`watch-card-${q.ticker}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-base font-bold" style={{ color: `rgb(var(--t-text))` }}>
                {q.ticker}
              </span>
              {q.changePercent != null && (
                <span
                  className="font-mono text-[11px] font-semibold"
                  style={{ color: up ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
                >
                  {up ? "+" : ""}{q.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <span className="font-mono text-sm" style={{ color: `rgb(var(--t-muted))` }}>
                {q.price != null ? `$${q.price.toFixed(2)}` : "—"}
              </span>
              <Sparkline points={q.spark} up={up} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ---- Intelligence cards -----------------------------------------------------------

function CardShell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color: `rgb(var(--t-accent))` }}>{icon}</span>
        <span className="label">{title}</span>
      </div>
      {children}
    </div>
  );
}

function MarketSummaryCard() {
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore last generated brief (persists across visits)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sl-market-brief");
      if (raw) {
        const saved = JSON.parse(raw) as { summary: string; generatedAt: string };
        // Only show briefs from the last 24h
        if (Date.now() - new Date(saved.generatedAt).getTime() < 24 * 60 * 60 * 1000) {
          setSummary(saved.summary);
          setGeneratedAt(saved.generatedAt);
        }
      }
    } catch {}
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/market-summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate.");
      setSummary(data.summary);
      setGeneratedAt(data.generatedAt);
      try {
        localStorage.setItem(
          "sl-market-brief",
          JSON.stringify({ summary: data.summary, generatedAt: data.generatedAt })
        );
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CardShell icon={<Sparkles size={14} strokeWidth={2.2} />} title="Market Intelligence">
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-5/6" />
          <div className="skeleton h-3.5 w-4/6" />
        </div>
      ) : summary ? (
        <>
          <p className="text-[13px] leading-relaxed" style={{ color: `rgb(var(--t-muted))` }}>
            {summary}
          </p>
          <div className="mt-3 flex items-center justify-between">
            {generatedAt && (
              <span className="text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
                Generated {new Date(generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button onClick={generate} className="hover-accent-text text-[11px] font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
              Refresh ↻
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={generate}
          className="hover-accent-text text-sm font-semibold"
          style={{ color: `rgb(var(--t-accent))` }}
          data-testid="generate-brief-btn"
        >
          Generate your daily brief →
        </button>
      )}
      {error && <p className="mt-2 text-xs" style={{ color: `rgb(var(--t-danger))` }}>{error}</p>}
    </CardShell>
  );
}

function UpcomingEarningsCard() {
  const [earnings, setEarnings] = useState<UpcomingEarning[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist/upcoming-earnings")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setEarnings(d.earnings ?? []); })
      .catch(() => { if (!cancelled) setEarnings([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <CardShell icon={<CalendarClock size={14} strokeWidth={2.2} />} title="Upcoming Earnings">
      {earnings === null ? (
        <div className="space-y-2">
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
        </div>
      ) : earnings.length === 0 ? (
        <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
          No notable earnings scheduled in the next 45 days.
        </p>
      ) : (
        <div className="space-y-2">
          {earnings.map((e) => (
            <div key={e.ticker} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-sm font-bold" style={{ color: `rgb(var(--t-text))` }}>
                  {e.ticker}
                </span>
                <span className="ml-2 truncate text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                  {e.companyName}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                  {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {e.hour && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ backgroundColor: `rgb(var(--t-accent) / 0.12)`, color: `rgb(var(--t-accent))` }}
                  >
                    {e.hour}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function PoliticalTradesCard() {
  const [trades, setTrades] = useState<SenateTrade[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/political/recent")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setTrades(d.trades ?? []); })
      .catch(() => { if (!cancelled) setTrades([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <CardShell icon={<Landmark size={14} strokeWidth={2.2} />} title="Recent Political Trades">
      {trades === null ? (
        <div className="space-y-2">
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
        </div>
      ) : trades.length === 0 ? (
        <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
          No recent Senate disclosures found.
        </p>
      ) : (
        <div className="space-y-2.5">
          {trades.map((t, i) => {
            const isBuy = t.type.toLowerCase().includes("purchase") || t.type.toLowerCase().includes("buy");
            return (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold" style={{ color: `rgb(var(--t-text))` }}>
                    {t.name}
                  </p>
                  <p className="text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
                    {t.amount} · {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-xs font-bold" style={{ color: `rgb(var(--t-accent))` }}>
                    {t.ticker}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{
                      backgroundColor: isBuy ? `rgb(var(--t-success) / 0.12)` : `rgb(var(--t-danger) / 0.12)`,
                      color: isBuy ? `rgb(var(--t-success))` : `rgb(var(--t-danger))`,
                    }}
                  >
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

// ---- Exported hub -----------------------------------------------------------------

export function IntelligenceHub({ hasWatchlist }: { hasWatchlist: boolean }) {
  return (
    <div className="space-y-4">
      <WatchlistStrip hasWatchlist={hasWatchlist} />
      <div className="grid gap-4 md:grid-cols-3">
        <MarketSummaryCard />
        <UpcomingEarningsCard />
        <PoliticalTradesCard />
      </div>
    </div>
  );
}
