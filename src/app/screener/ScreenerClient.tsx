"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { ScreenerResult } from "@/app/api/screener/route";

const EXAMPLE_QUERIES = [
  "Profitable semiconductor companies",
  "Large-cap tech with strong cash flow",
  "Healthcare companies with recent senator buying",
  "Mega-cap finance stocks",
  "Energy companies",
  "Consumer companies profitable",
];

function formatMarketCap(capB: number): string {
  if (capB >= 1000) return `$${(capB / 1000).toFixed(1)}T`;
  return `$${capB.toFixed(0)}B`;
}

function ResultCard({ result }: { result: ScreenerResult }) {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3 transition-all"
      style={{
        borderColor: `rgb(var(--t-text) / 0.08)`,
        backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
        backdropFilter: `var(--card-blur, none)`,
        WebkitBackdropFilter: `var(--card-blur, none)`,
        boxShadow: `var(--card-shadow, none)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-lg font-bold"
              style={{ color: `rgb(var(--t-accent))` }}
            >
              {result.ticker}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: `rgb(var(--t-accent) / 0.1)`,
                color: `rgb(var(--t-accent))`,
              }}
            >
              {result.sector}
            </span>
          </div>
          <p
            className="mt-0.5 text-sm truncate max-w-[200px]"
            style={{ color: `rgb(var(--t-muted))` }}
            title={result.name}
          >
            {result.name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="font-mono text-sm font-semibold"
            style={{ color: `rgb(var(--t-text))` }}
          >
            {formatMarketCap(result.marketCapB)}
          </p>
          <p className="text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
            Market Cap
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {result.matchReasons.map((reason, i) => (
          <span
            key={i}
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
            style={{
              borderColor: `rgb(var(--t-text) / 0.08)`,
              color: `rgb(var(--t-dim))`,
              backgroundColor: `rgb(var(--t-text) / 0.03)`,
            }}
          >
            {reason}
          </span>
        ))}
      </div>

      <Link
        href={`/dashboard?ticker=${result.ticker}`}
        className="block rounded-xl border px-3 py-2 text-center text-xs font-semibold transition-colors"
        style={{
          borderColor: `rgb(var(--t-accent) / 0.3)`,
          color: `rgb(var(--t-accent))`,
          backgroundColor: `rgb(var(--t-accent) / 0.05)`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = `rgb(var(--t-accent) / 0.12)`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = `rgb(var(--t-accent) / 0.05)`;
        }}
      >
        Generate Report →
      </Link>
    </div>
  );
}

export function ScreenerClient() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScreenerResult[] | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runScreener(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screener failed.");
      setResults(data.results ?? []);
      setActiveFilters(data.filters ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runScreener(query);
  }

  function applyExample(q: string) {
    setQuery(q);
    runScreener(q);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span style={{ color: `rgb(var(--t-accent))` }}>◈</span>
          <span className="label">AI Screener</span>
        </div>
        <h1
          className="font-display text-3xl font-bold tracking-tight"
          style={{ color: `rgb(var(--t-text))` }}
        >
          Find stocks with natural language
        </h1>
        <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
          Describe what you&apos;re looking for — Gemini parses your query into filters and screens
          a universe of 50+ major stocks.
        </p>
      </div>

      {/* Search form */}
      <div
        className="surface p-6"
        style={{
          borderLeft: `3px solid rgb(var(--t-accent) / 0.4)`,
        }}
      >
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Profitable semiconductor companies with strong cash flow"
            className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
            style={{
              borderColor: `rgb(var(--t-text) / 0.12)`,
              backgroundColor: `rgb(var(--t-text) / 0.04)`,
              color: `rgb(var(--t-text))`,
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.5)`;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = `rgb(var(--t-text) / 0.12)`;
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: `rgb(var(--t-accent))`,
              color: `rgb(var(--t-bg))`,
            }}
          >
            {loading ? "Screening…" : "Screen"}
          </button>
        </form>

        {/* Example query chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-[11px] font-medium self-center" style={{ color: `rgb(var(--t-dim))` }}>
            Try:
          </span>
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => applyExample(q)}
              disabled={loading}
              className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
              style={{
                borderColor: `rgb(var(--t-text) / 0.1)`,
                color: `rgb(var(--t-muted))`,
                backgroundColor: `rgb(var(--t-text) / 0.03)`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.4)`;
                (e.currentTarget as HTMLElement).style.color = `rgb(var(--t-accent))`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `rgb(var(--t-text) / 0.1)`;
                (e.currentTarget as HTMLElement).style.color = `rgb(var(--t-muted))`;
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Active filters summary */}
      {results !== null && Object.keys(activeFilters).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: `rgb(var(--t-dim))` }}>
            Filters applied:
          </span>
          {Object.entries(activeFilters).map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                borderColor: `rgb(var(--t-accent) / 0.3)`,
                color: `rgb(var(--t-accent))`,
                backgroundColor: `rgb(var(--t-accent) / 0.07)`,
              }}
            >
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            borderColor: `rgb(var(--t-danger) / 0.3)`,
            backgroundColor: `rgb(var(--t-danger) / 0.07)`,
            color: `rgb(var(--t-danger))`,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: `rgb(var(--t-accent) / 0.3)`, borderTopColor: `rgb(var(--t-accent))` }}
          />
          <p className="mt-3 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
            Screening universe…
          </p>
        </div>
      )}

      {/* Results */}
      {results !== null && !loading && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
              {results.length === 0
                ? "No matching stocks found"
                : `${results.length} match${results.length !== 1 ? "es" : ""} found`}
            </p>
            {results.length > 0 && (
              <span className="text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
                Sorted by market cap · Free tier data
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-12 text-center"
              style={{ borderColor: `rgb(var(--t-text) / 0.08)` }}
            >
              <p className="text-2xl" style={{ color: `rgb(var(--t-dim))` }}>◇</p>
              <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
                No stocks matched your criteria in the screener universe.
              </p>
              <p className="mt-1 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                Try relaxing the filters — e.g. remove the profitability requirement.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <ResultCard key={r.ticker} result={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no search yet */}
      {results === null && !loading && !error && (
        <div
          className="rounded-2xl border border-dashed p-12 text-center"
          style={{ borderColor: `rgb(var(--t-text) / 0.06)` }}
        >
          <p className="text-3xl" style={{ color: `rgb(var(--t-dim))` }}>◈</p>
          <p className="mt-3 text-sm font-medium" style={{ color: `rgb(var(--t-muted))` }}>
            Describe what you&apos;re looking for above
          </p>
          <p className="mt-1 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
            The screener covers 50+ major US stocks across 6 sectors using live Finnhub data.
          </p>
        </div>
      )}

      <p className="text-center text-xs" style={{ color: `rgb(var(--t-dim))` }}>
        Screener uses a fixed universe of major tickers · Results are for research only, not financial advice.
      </p>
    </div>
  );
}
