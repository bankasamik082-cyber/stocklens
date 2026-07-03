"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Row {
  ticker: string;
  companyName: string;
  price: number | null;
  changePercent: number | null;
  earningsDate: string | null;
  earningsHour: string | null;
  headline: { title: string; url: string; date: string } | null;
}

export function WatchlistClient({ hasItems }: { hasItems: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!hasItems) { setRows([]); return; }
    let cancelled = false;
    fetch("/api/watchlist/details")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRows(d.rows ?? []); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [hasItems]);

  async function remove(ticker: string) {
    setRemoving(ticker);
    try {
      const res = await fetch("/api/watchlist/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) {
        setRows((prev) => (prev ? prev.filter((r) => r.ticker !== ticker) : prev));
        router.refresh();
      }
    } catch {} finally {
      setRemoving(null);
    }
  }

  if (!hasItems || (rows && rows.length === 0)) {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <span className="text-3xl" style={{ color: `rgb(var(--t-dim))` }}>★</span>
        <p className="mt-3 text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
          Your watchlist is empty
        </p>
        <p className="mt-1 max-w-sm text-xs" style={{ color: `rgb(var(--t-muted))` }}>
          Search for a company on the dashboard and star it to start tracking prices,
          earnings dates, and news here.
        </p>
        <Link href="/dashboard" className="btn-accent mt-5 text-sm">
          Go to Dashboard →
        </Link>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[92px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const up = (r.changePercent ?? 0) >= 0;
        return (
          <div key={r.ticker} className="card hover-card px-5 py-4" data-testid={`watchlist-row-${r.ticker}`}>
            <div className="flex items-start justify-between gap-4">
              {/* Left: identity */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/dashboard?ticker=${r.ticker}`}
                    className="hover-accent-text font-mono text-lg font-bold"
                    style={{ color: `rgb(var(--t-text))` }}
                  >
                    {r.ticker}
                  </Link>
                  <span className="truncate text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                    {r.companyName}
                  </span>
                  {r.price != null && (
                    <span className="font-mono text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
                      ${r.price.toFixed(2)}
                    </span>
                  )}
                  {r.changePercent != null && (
                    <span
                      className="font-mono text-xs font-semibold"
                      style={{ color: up ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
                    >
                      {up ? "+" : ""}{r.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {r.earningsDate && (
                    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: `rgb(var(--t-muted))` }}>
                      <span style={{ color: `rgb(var(--t-accent))` }}>◑</span>
                      Earnings{" "}
                      {new Date(r.earningsDate + "T12:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {r.earningsHour ? ` · ${r.earningsHour}` : ""}
                    </span>
                  )}
                  {r.headline && (
                    <a
                      href={r.headline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover-accent-text min-w-0 flex-1 truncate text-[11px]"
                      style={{ color: `rgb(var(--t-muted))` }}
                      title={r.headline.title}
                    >
                      ⬡ {r.headline.title}
                    </a>
                  )}
                </div>
              </div>

              {/* Right: remove */}
              <button
                onClick={() => remove(r.ticker)}
                disabled={removing === r.ticker}
                className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50"
                style={{
                  borderColor: `rgb(var(--t-text) / 0.1)`,
                  color: `rgb(var(--t-dim))`,
                }}
                title={`Remove ${r.ticker} from watchlist`}
                data-testid={`remove-${r.ticker}`}
              >
                {removing === r.ticker ? "…" : "✕ Remove"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
