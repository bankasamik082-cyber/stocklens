"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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

type ConfidenceLevel = "Low" | "Medium" | "High";

interface MoveExplanation {
  headline: string;
  primaryDriver: { factor: string; text: string } | null;
  contributingFactors: Array<{ factor: string; text: string }>;
  confidence: ConfidenceLevel;
  noCatalyst: boolean;
}

interface MoveFactors {
  relativeVolume: number | null;
  volumeNote: string;
  moveSigma: number | null;
  avgPeerChangePercent: number | null;
  sectorWide: boolean | null;
  peers: Array<{ ticker: string; changePercent: number }>;
  prevBarDate: string | null;
  hasEarnings: boolean;
  newsCount: number;
}

interface ExplainResult {
  date: string;
  ticker: string;
  close: number;
  priceChange: number;
  priceChangePercent: number;
  factors: MoveFactors;
  explanation: MoveExplanation;
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

const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  High: "bg-t-success/15 text-t-success",
  Medium: "bg-t-warn/15 text-t-warn",
  Low: "bg-t-danger/15 text-t-danger",
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CONFIDENCE_STYLE[level]}`}
      title="How confident the explanation is, based on how clear the catalyst is."
    >
      {level} confidence
    </span>
  );
}

// Small data chips derived deterministically from the price/peer data — shown
// even when the model's narrative is terse, so the user always sees the numbers.
function FactorChips({ factors }: { factors: MoveFactors }) {
  const chips: string[] = [];
  if (factors.relativeVolume !== null) {
    chips.push(`Volume ${factors.relativeVolume}× avg (${factors.volumeNote})`);
  }
  if (factors.moveSigma !== null) {
    chips.push(`${factors.moveSigma}σ move`);
  }
  if (factors.sectorWide === true && factors.avgPeerChangePercent !== null) {
    chips.push(
      `Sector-wide · peers ${factors.avgPeerChangePercent >= 0 ? "+" : ""}${factors.avgPeerChangePercent}% avg`
    );
  } else if (factors.sectorWide === false) {
    chips.push("Stock-specific move");
  }
  if (factors.hasEarnings) chips.push("Earnings in window");
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <span
          key={i}
          className="rounded-full border border-t-border bg-t-text/[0.03] px-2.5 py-1 text-[10px] font-medium text-t-muted"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function FactorRow({ factor, text }: { factor: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 rounded-md bg-t-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-t-accent">
        {factor}
      </span>
      <p className="text-sm leading-relaxed text-t-muted">{text}</p>
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
  const searchParams = useSearchParams();
  const [ticker, setTicker] = useState("");
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [currentTicker, setCurrentTicker] = useState("");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState("");

  // Guards against re-explaining the same date and against re-running the
  // deep-link init on every render.
  const explainingRef = useRef<string | null>(null);
  const didInitRef = useRef(false);

  async function explainDate(t: string, date: string) {
    if (explainingRef.current === date) return;
    explainingRef.current = date;
    setSelectedDate(date);
    setResult(null);
    setExplainError("");
    setLoadingExplain(true);
    try {
      const res = await fetch("/api/explain-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t, date }),
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
      explainingRef.current = null;
    }
  }

  // Load price history for `t`; if `autoDate` is given (deep-link from the
  // timeline), snap to the nearest trading bar on/before it and explain it.
  async function loadPrices(t: string, autoDate?: string) {
    if (!t) return;
    setLoadingPrices(true);
    setPriceError("");
    setPrices([]);
    setSelectedDate(null);
    setResult(null);
    setCurrentTicker(t);
    try {
      const res = await fetch(`/api/explain-move?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch prices.");
      const loaded = data.prices as PricePoint[];
      setPrices(loaded);
      if (autoDate && loaded.length) {
        // Exact bar, else the most recent trading day on/before the target.
        const exact = loaded.find((p) => p.date === autoDate);
        const bar =
          exact ??
          [...loaded].reverse().find((p) => p.date <= autoDate) ??
          loaded[loaded.length - 1];
        explainDate(t, bar.date);
      }
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingPrices(false);
    }
  }

  // Deep-link support: /explain?ticker=NVDA&date=2025-01-27
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const qTicker = (searchParams.get("ticker") || "").trim().toUpperCase();
    const qDate = (searchParams.get("date") || "").trim();
    if (qTicker && /^[A-Z.\-]{1,10}$/.test(qTicker)) {
      setTicker(qTicker);
      loadPrices(qTicker, /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleFetchPrices(e: React.FormEvent) {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    loadPrices(t);
  }

  // recharts v3 passes activeLabel (the XAxis dataKey value = date string) in
  // the onClick chartData param — read it directly instead of the ref approach.
  function handleChartClick(chartData: any) {
    const date = chartData?.activeLabel as string | undefined;
    if (!date) return;
    const point = prices.find((p) => p.date === date);
    if (!point) return;
    if (point.date === selectedDate && result) return;
    explainDate(currentTicker, date);
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
              <div className="flex flex-wrap items-center gap-3">
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
                <span className="ml-auto">
                  <ConfidenceBadge level={result.explanation.confidence} />
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-accent border-t-transparent" />
                <span className="text-sm text-t-muted">
                  Analyzing news, peers, volume and events for {selectedDate}…
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
                {/* Headline */}
                <p className="text-base font-semibold leading-snug text-t-text">
                  {result.explanation.headline}
                </p>

                <FactorChips factors={result.factors} />

                {/* No-catalyst fallback */}
                {result.explanation.noCatalyst && (
                  <div className="mt-4 rounded-xl border border-t-warn/30 bg-t-warn/[0.06] px-4 py-3">
                    <p className="text-xs leading-relaxed text-t-muted">
                      No clear company-specific catalyst was found near this date.
                      The move may reflect broader market or sector conditions
                      rather than news about {result.ticker}.
                    </p>
                  </div>
                )}

                {/* Primary driver */}
                {result.explanation.primaryDriver && (
                  <div className="mt-5">
                    <p className="label mb-2 text-[10px]">Primary driver</p>
                    <FactorRow
                      factor={result.explanation.primaryDriver.factor}
                      text={result.explanation.primaryDriver.text}
                    />
                  </div>
                )}

                {/* Contributing factors */}
                {result.explanation.contributingFactors.length > 0 && (
                  <div className="mt-5">
                    <p className="label mb-2 text-[10px]">Contributing factors</p>
                    <div className="space-y-3">
                      {result.explanation.contributingFactors.map((f, i) => (
                        <FactorRow key={i} factor={f.factor} text={f.text} />
                      ))}
                    </div>
                  </div>
                )}

                <SourceList sources={result.sources} />
                <p className="mt-4 text-xs text-t-dim">
                  Research only — not financial advice. Data from Twelve Data,
                  Finnhub and FMP.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
