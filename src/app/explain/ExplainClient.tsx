"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Source } from "@/lib/types";

interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface ExplainResult {
  date: string;
  ticker: string;
  close: number;
  priceChange: number;
  priceChangePercent: number;
  explanation: string;
  sources: Source[];
}

const PRESETS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];

// Custom recharts tooltip
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: PricePoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const up = d.changePercent >= 0;
  return (
    <div className="rounded-xl border border-t-border bg-t-card px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="mb-1 text-[11px] text-t-dim">{d.date}</p>
      <p className="font-mono text-sm font-semibold text-t-text">
        ${d.close.toFixed(2)}
      </p>
      <p
        className={`text-xs font-semibold ${up ? "text-t-success" : "text-t-danger"}`}
      >
        {up ? "+" : ""}
        {d.changePercent.toFixed(2)}%
      </p>
      <p className="mt-1 text-[10px] text-t-dim">Click to explain</p>
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-5 border-t border-t-border/50 pt-4">
      <p className="label mb-2 text-[10px]">
        Sources
      </p>
      <ul className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-pill"
            >
              <span className="text-[10px]">↗</span>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExplainClient() {
  const [ticker, setTicker] = useState("");
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [currentTicker, setCurrentTicker] = useState("");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState("");

  async function handleFetchPrices(e: React.FormEvent) {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoadingPrices(true);
    setPriceError("");
    setPrices([]);
    setSelectedDate(null);
    setResult(null);
    setCurrentTicker(t);
    try {
      const res = await fetch(`/api/explain-move?ticker=${t}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch prices.");
      setPrices(data.prices as PricePoint[]);
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingPrices(false);
    }
  }

  // recharts v3 passes activeLabel (the XAxis dataKey value = date string) in
  // the onClick chartData param — read it directly instead of the ref approach.
  async function handleChartClick(chartData: any) {
    const date = chartData?.activeLabel as string | undefined;
    if (!date) return;
    const point = prices.find((p) => p.date === date);
    if (!point) return;
    if (point.date === selectedDate && result) return;

    setSelectedDate(date);
    setResult(null);
    setExplainError("");
    setLoadingExplain(true);

    try {
      const res = await fetch("/api/explain-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: currentTicker, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate explanation.");
      setResult(data as ExplainResult);
    } catch (err) {
      setExplainError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoadingExplain(false);
    }
  }

  const tickInterval = prices.length > 0 ? Math.max(1, Math.floor(prices.length / 8)) : 30;

  return (
    <div className="space-y-6">
      {/* ---- Ticker input ---- */}
      <form
        onSubmit={handleFetchPrices}
        className="card p-5"
      >
        <label
          htmlFor="explain-ticker"
          className="label mb-2 block"
        >
          Stock ticker
        </label>
        <div className="flex items-center gap-3">
          <input
            id="explain-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
            autoComplete="off"
            spellCheck={false}
            className="input-base flex-1 px-4 py-3.5 font-mono text-xl tracking-wider"
          />
          <button
            type="submit"
            disabled={loadingPrices || !ticker.trim()}
            className="btn-accent flex items-center gap-2 px-5 py-3.5 text-sm disabled:opacity-50"
          >
            {loadingPrices ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading…
              </>
            ) : (
              "Load chart"
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTicker(p)}
              className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold transition ${
                ticker === p
                  ? "border-t-accent/50 bg-t-accent/15 text-t-accent"
                  : "border-t-border text-t-muted hover-chip"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {priceError && (
          <p className="mt-3 text-sm text-t-danger">{priceError}</p>
        )}
      </form>

      {/* ---- Price chart ---- */}
      {prices.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-t-border/50 px-5 py-4">
            <div>
              <span className="font-mono text-sm font-semibold text-t-text">
                {currentTicker}
              </span>
              <span className="ml-2 text-xs text-t-muted">
                12-month closing price
              </span>
            </div>
            <span className="text-xs text-t-muted">
              Click any date to explain the move
            </span>
          </div>
          <div className="px-2 py-5">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={prices}
                margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                onClick={handleChartClick}
                style={{ cursor: "crosshair" }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgb(var(--t-border) / 0.5)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  interval={tickInterval}
                  tickFormatter={(v: string) => {
                    const d = new Date(`${v}T12:00:00`);
                    return d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  tick={{ fill: "rgb(var(--t-muted))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fill: "rgb(var(--t-muted))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={ChartTooltip as React.FC} />
                {selectedDate && (
                  <ReferenceLine
                    x={selectedDate}
                    stroke="rgb(var(--t-accent))"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="rgb(var(--t-accent))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "rgb(var(--t-accent))", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ---- Explanation panel ---- */}
      {(selectedDate || loadingExplain) && (
        <div className="card overflow-hidden">
          <div className="border-b border-t-border/50 px-5 py-4">
            {selectedDate && result ? (
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-t-text">
                  What happened on{" "}
                  {new Date(`${result.date}T12:00:00`).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${
                    result.priceChangePercent >= 0
                      ? "bg-t-success/15 text-t-success"
                      : "bg-t-danger/15 text-t-danger"
                  }`}
                >
                  {result.priceChangePercent >= 0 ? "+" : ""}
                  {result.priceChangePercent.toFixed(2)}%
                </span>
                <span className="font-mono text-xs text-t-muted">
                  ${result.close.toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-accent border-t-transparent" />
                <span className="text-sm text-t-muted">
                  Fetching news and trades for {selectedDate}…
                </span>
              </div>
            )}
          </div>

          <div className="px-5 py-5">
            {loadingExplain ? (
              <div className="space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-4/6" />
              </div>
            ) : explainError ? (
              <p className="text-sm text-t-danger">{explainError}</p>
            ) : result ? (
              <>
                <p className="text-sm leading-relaxed text-t-muted">
                  {result.explanation}
                </p>
                <SourceList sources={result.sources} />
                <p className="mt-4 text-xs text-t-dim">
                  Research only — not financial advice. Data from FMP and
                  Finnhub.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
