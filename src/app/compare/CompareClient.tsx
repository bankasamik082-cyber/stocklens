"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CompanyCompareData } from "@/app/api/compare/route";
import { InfoTooltip } from "@/components/InfoTooltip";

// ---- TickerPicker -----------------------------------------------------------

interface Suggestion {
  symbol: string;
  name: string;
  exchange: string;
}

interface SelectedTicker {
  symbol: string;
  name: string;
}

function TickerPicker({
  value,
  onChange,
  slotLabel,
}: {
  value: SelectedTicker | null;
  onChange: (val: SelectedTicker | null) => void;
  slotLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    setSuggLoading(true);
    try {
      const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const results: Suggestion[] = data.results ?? [];
        setSuggestions(results);
        setOpen(results.length > 0);
      }
    } catch {}
    setSuggLoading(false);
  }, []);

  function onInput(val: string) {
    setQuery(val.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val.trim()), 280);
  }

  function pick(s: Suggestion) {
    onChange({ symbol: s.symbol, name: s.name });
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  // Filled slot
  if (value) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 transition"
        style={{
          borderColor: `rgb(var(--t-accent) / 0.35)`,
          backgroundColor: `rgb(var(--t-accent) / 0.05)`,
        }}
        data-testid="ticker-slot-filled"
      >
        <div className="min-w-0">
          <div
            className="font-mono text-base font-bold tracking-wider"
            style={{ color: `rgb(var(--t-text))` }}
          >
            {value.symbol}
          </div>
          <div
            className="truncate text-[11px]"
            style={{ color: `rgb(var(--t-muted))` }}
          >
            {value.name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Remove ${value.symbol}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition"
          style={{
            backgroundColor: `rgb(var(--t-accent) / 0.12)`,
            color: `rgb(var(--t-accent))`,
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  // Empty slot — search input
  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onInput(e.target.value)}
        onFocus={(e) => {
          if (suggestions.length > 0) setOpen(true);
          (e.target as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.6)`;
          (e.target as HTMLElement).style.boxShadow = `0 0 0 2px rgb(var(--t-accent) / 0.1)`;
        }}
        onBlur={(e) => {
          // Delay so that click on suggestion can fire first
          setTimeout(() => setOpen(false), 150);
          (e.target as HTMLElement).style.borderColor = `rgb(var(--t-border))`;
          (e.target as HTMLElement).style.boxShadow = ``;
        }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder={slotLabel}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl border px-3.5 py-3 font-mono text-sm tracking-wide outline-none transition"
        style={{
          borderColor: `rgb(var(--t-border))`,
          backgroundColor: `rgb(var(--t-card))`,
          color: `rgb(var(--t-text))`,
        }}
        data-testid="ticker-input"
      />
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border shadow-2xl"
          style={{
            borderColor: `rgb(var(--t-border) / 0.8)`,
            backgroundColor: `rgb(var(--t-card))`,
          }}
        >
          {suggLoading ? (
            <div className="px-4 py-3 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
              Searching…
            </div>
          ) : (
            <ul>
              {suggestions.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover-row"
                    style={{ color: `rgb(var(--t-text))` }}
                    data-testid="ticker-suggestion"
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
  );
}

// ---- Comparison table -------------------------------------------------------

type Direction = "higher" | "lower" | "none";

interface RowDef {
  label: string;
  definition?: string;
  section: string;
  rawKey?: keyof CompanyCompareData;
  direction: Direction;
  render: (c: CompanyCompareData) => React.ReactNode;
}

function fmtEps(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `$${val.toFixed(2)}`;
}

function fmtSurprise(pct: number | null | undefined): React.ReactNode {
  if (pct === null || pct === undefined) return <span>—</span>;
  const positive = pct >= 0;
  return (
    <span style={{ color: `rgb(var(--t-${positive ? "success" : "danger"}))` }}>
      {positive ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

const ROW_DEFS: RowDef[] = [
  // Overview
  {
    section: "Overview", label: "Sector", direction: "none",
    render: (c) => c.sector || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  {
    section: "Overview", label: "Industry", direction: "none",
    render: (c) => c.industry || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  {
    section: "Overview", label: "Market Cap", definition: "Total market value of all the company's outstanding shares",
    direction: "higher", rawKey: "marketCapRaw",
    render: (c) => c.marketCap || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  // Financial Health
  {
    section: "Financial Health", label: "Revenue", definition: "Total sales generated by the company before any expenses are deducted",
    direction: "higher", rawKey: "revenueRaw",
    render: (c) => c.revenue || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  {
    section: "Financial Health", label: "Net Income", definition: "The company's profit after all expenses, taxes, and costs are paid",
    direction: "higher", rawKey: "netIncomeRaw",
    render: (c) => c.netIncome || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  {
    section: "Financial Health", label: "Total Debt", definition: "Total amount the company owes to lenders",
    direction: "lower", rawKey: "debtRaw",
    render: (c) => c.debt || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  {
    section: "Financial Health", label: "Operating Cash Flow", definition: "Cash generated from the company's core business operations",
    direction: "higher", rawKey: "operatingCashFlowRaw",
    render: (c) => c.operatingCashFlow || <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  // Earnings
  {
    section: "Earnings", label: "Last EPS (actual)", definition: "Earnings Per Share — the company's profit divided by number of shares",
    direction: "higher", rawKey: undefined,
    render: (c) => c.lastEps ? fmtEps(c.lastEps.actual) : <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  {
    section: "Earnings", label: "vs. Estimate", direction: "higher",
    rawKey: undefined,
    render: (c) => c.lastEps ? fmtSurprise(c.lastEps.surprisePct) : <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  // Analyst Consensus
  {
    section: "Analyst Consensus", label: "Bullish %", direction: "higher", rawKey: "analystBullPct",
    render: (c) => c.analystBullPct !== null
      ? (
        <span>
          <span style={{ color: `rgb(var(--t-success))` }}>{c.analystBullPct}%</span>
          {c.analystTotal !== null && (
            <span className="ml-1 text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
              / {c.analystTotal} analysts
            </span>
          )}
        </span>
      )
      : <span style={{ color: `rgb(var(--t-dim))` }}>—</span>,
  },
  // Politician Trading
  {
    section: "Politician Trading", label: "Disclosed Trades", direction: "none",
    rawKey: "politicianTradeCount",
    render: (c) => (
      <span>
        {c.politicianTradeCount > 0
          ? `${c.politicianTradeCount} trade${c.politicianTradeCount !== 1 ? "s" : ""}`
          : <span style={{ color: `rgb(var(--t-dim))` }}>None found</span>}
      </span>
    ),
  },
];

function getBestIndex(companies: CompanyCompareData[], row: RowDef): number {
  if (row.direction === "none") return -1;
  if (!row.rawKey) {
    // Special case: EPS actual and surprise %
    const vals = companies.map((c) =>
      row.label === "Last EPS (actual)"
        ? (c.lastEps?.actual ?? null)
        : (c.lastEps?.surprisePct ?? null)
    );
    const nonNull = vals.filter((v): v is number => v !== null);
    if (nonNull.length < 2) return -1;
    const best = row.direction === "higher" ? Math.max(...nonNull) : Math.min(...nonNull);
    const idx = vals.indexOf(best);
    return idx >= 0 ? idx : -1;
  }
  const vals = companies.map((c) => {
    const v = c[row.rawKey!];
    return typeof v === "number" ? v : null;
  });
  const nonNull = vals.filter((v): v is number => v !== null);
  if (nonNull.length < 2) return -1;
  const best = row.direction === "higher" ? Math.max(...nonNull) : Math.min(...nonNull);
  const idx = vals.indexOf(best);
  return idx >= 0 ? idx : -1;
}

function Skeleton() {
  return (
    <span
      className="skeleton inline-block h-4 w-20 rounded"
      style={{ opacity: 0.6 }}
    />
  );
}

function ComparisonTable({
  companies,
  loading,
}: {
  companies: CompanyCompareData[];
  loading: boolean;
}) {
  const sections = [...new Set(ROW_DEFS.map((r) => r.section))];

  const colCount = companies.length;

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: `rgb(var(--t-border) / 0.7)` }}>
      <table className="w-full border-collapse" data-testid="compare-table">
        {/* Column headers = company names */}
        <thead>
          <tr style={{ backgroundColor: `rgb(var(--t-surface))` }}>
            <th
              className="border-b border-r px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-widest"
              style={{
                borderColor: `rgb(var(--t-border) / 0.5)`,
                color: `rgb(var(--t-dim))`,
                width: "160px",
                minWidth: "140px",
              }}
            >
              Metric
            </th>
            {companies.map((c, ci) => (
              <th
                key={c.ticker}
                className="border-b px-5 py-4 text-left"
                style={{
                  borderColor: `rgb(var(--t-border) / 0.5)`,
                  borderRight: ci < colCount - 1 ? `1px solid rgb(var(--t-border) / 0.3)` : undefined,
                }}
                data-testid={`company-header-${c.ticker}`}
              >
                <div
                  className="font-mono text-lg font-bold tracking-wider"
                  style={{ color: `rgb(var(--t-text))` }}
                >
                  {c.ticker}
                </div>
                <div
                  className="mt-0.5 truncate text-[11px]"
                  style={{ color: `rgb(var(--t-muted))`, maxWidth: "160px" }}
                >
                  {c.companyName}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sections.map((section) => {
            const sectionRows = ROW_DEFS.filter((r) => r.section === section);
            return (
              <>
                {/* Section header row */}
                <tr key={`s-${section}`}>
                  <td
                    colSpan={colCount + 1}
                    className="border-b border-t px-5 py-2"
                    style={{
                      borderColor: `rgb(var(--t-border) / 0.4)`,
                      backgroundColor: `rgb(var(--t-accent) / 0.04)`,
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: `rgb(var(--t-accent))` }}
                    >
                      {section}
                    </span>
                  </td>
                </tr>

                {sectionRows.map((row, ri) => {
                  const bestIdx = loading ? -1 : getBestIndex(companies, row);
                  const isLast = ri === sectionRows.length - 1;
                  return (
                    <tr
                      key={row.label}
                      className={isLast ? "" : ""}
                      style={{ backgroundColor: `rgb(var(--t-surface))` }}
                    >
                      {/* Row label */}
                      <td
                        className="border-b border-r px-5 py-3.5 text-xs font-medium"
                        style={{
                          borderColor: `rgb(var(--t-border) / 0.4)`,
                          color: `rgb(var(--t-muted))`,
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {row.label}
                          {row.definition && <InfoTooltip text={row.definition} />}
                          {row.direction !== "none" && (
                            <span
                              className="text-[9px]"
                              style={{ color: `rgb(var(--t-dim))` }}
                              title={row.direction === "higher" ? "higher is better" : "lower is better"}
                            >
                              {row.direction === "higher" ? "↑" : "↓"}
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Data cells */}
                      {companies.map((c, ci) => {
                        const isWinner = bestIdx === ci;
                        return (
                          <td
                            key={c.ticker}
                            className="border-b px-5 py-3.5 text-sm"
                            style={{
                              borderColor: `rgb(var(--t-border) / 0.4)`,
                              borderRight: ci < colCount - 1 ? `1px solid rgb(var(--t-border) / 0.2)` : undefined,
                              borderLeft: isWinner ? `2px solid rgb(var(--t-accent) / 0.7)` : undefined,
                              backgroundColor: isWinner
                                ? `rgb(var(--t-accent) / 0.04)`
                                : undefined,
                              color: `rgb(var(--t-text))`,
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              {loading ? <Skeleton /> : row.render(c)}
                              {isWinner && !loading && (
                                <span
                                  className="shrink-0 text-[9px] font-semibold"
                                  style={{ color: `rgb(var(--t-accent))` }}
                                  title={row.direction === "higher" ? "highest" : "lowest"}
                                >
                                  {row.direction === "higher" ? "▲" : "▼"}
                                </span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Main client component --------------------------------------------------

const MAX_TICKERS = 4;

export function CompareClient() {
  const [slots, setSlots] = useState<Array<SelectedTicker | null>>([null, null, null, null]);
  const [companies, setCompanies] = useState<CompanyCompareData[] | null>(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [peers, setPeers] = useState<string[]>([]);

  const filled = slots.filter(Boolean) as SelectedTicker[];
  const canCompare = filled.length >= 2;

  // Fetch peers when exactly one slot is filled
  useEffect(() => {
    if (filled.length !== 1) { setPeers([]); return; }
    const ticker = filled[0].symbol;
    let cancelled = false;
    fetch(`/api/peers?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : { peers: [] })
      .then((d: { peers?: string[] }) => { if (!cancelled) setPeers(d.peers ?? []); })
      .catch(() => { if (!cancelled) setPeers([]); });
    return () => { cancelled = true; };
  }, [filled.length === 1 ? filled[0].symbol : ""]);

  function setSlot(index: number, val: SelectedTicker | null) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    // Reset results when inputs change
    setCompanies(null);
    setSummary("");
    setError("");
  }

  async function handleCompare() {
    if (!canCompare || loading) return;
    setLoading(true);
    setError("");
    setCompanies(null);
    setSummary("");

    // Show skeleton immediately using filled slots' data
    const skeletonData: CompanyCompareData[] = filled.map((t) => ({
      ticker: t.symbol,
      companyName: t.name,
      sector: null,
      industry: null,
      marketCap: null,
      marketCapRaw: null,
      revenue: null,
      revenueRaw: null,
      netIncome: null,
      netIncomeRaw: null,
      debt: null,
      debtRaw: null,
      operatingCashFlow: null,
      operatingCashFlowRaw: null,
      lastEps: null,
      politicianTradeCount: 0,
      analystBullPct: null,
      analystTotal: null,
    }));
    setCompanies(skeletonData);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: filled.map((t) => t.symbol) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setCompanies(null);
        return;
      }
      setCompanies(data.companies);
      setSummary(data.summary || "");
    } catch {
      setError("Network error — please try again.");
      setCompanies(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Ticker selector row */}
      <div
        className="rounded-2xl border p-5"
        style={{
          borderColor: `rgb(var(--t-border) / 0.7)`,
          backgroundColor: `rgb(var(--t-card))`,
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="label">Select tickers</span>
          <span className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
            {filled.length}/{MAX_TICKERS} selected
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.map((slot, i) => (
            <TickerPicker
              key={i}
              value={slot}
              onChange={(val) => setSlot(i, val)}
              slotLabel={`Ticker ${i + 1}`}
            />
          ))}
        </div>

        {filled.length === 1 && peers.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: `rgb(var(--t-dim))` }}>
              Compare {filled[0].symbol} with…
            </p>
            <div className="flex flex-wrap gap-2">
              {peers.map((peer) => {
                const alreadyAdded = slots.some((s) => s?.symbol === peer);
                const firstEmpty = slots.findIndex((s) => s === null);
                return (
                  <button
                    key={peer}
                    type="button"
                    disabled={alreadyAdded || firstEmpty === -1}
                    onClick={() => { if (!alreadyAdded && firstEmpty !== -1) setSlot(firstEmpty, { symbol: peer, name: peer }); }}
                    className="rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition disabled:opacity-40"
                    style={{
                      borderColor: `rgb(var(--t-border) / 0.6)`,
                      color: `rgb(var(--t-accent))`,
                      backgroundColor: `rgb(var(--t-accent) / 0.06)`,
                    }}
                  >
                    {peer}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCompare}
            disabled={!canCompare || loading}
            className="btn-accent px-6 py-2.5 text-sm disabled:opacity-40"
            data-testid="compare-btn"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>

          {!canCompare && (
            <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
              Add at least 2 tickers to compare
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: `rgb(var(--t-danger) / 0.3)`,
            backgroundColor: `rgb(var(--t-danger) / 0.08)`,
            color: `rgb(var(--t-danger))`,
          }}
        >
          {error}
        </div>
      )}

      {/* Comparison table */}
      {companies && companies.length >= 2 && (
        <ComparisonTable companies={companies} loading={loading} />
      )}

      {/* AI summary */}
      {summary && !loading && (
        <div
          className="rounded-2xl border px-6 py-5"
          style={{
            borderColor: `rgb(var(--t-accent) / 0.2)`,
            backgroundColor: `rgb(var(--t-accent) / 0.04)`,
          }}
          data-testid="ai-summary"
        >
          <div
            className="mb-3 flex items-center gap-2"
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
              style={{
                background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.6))`,
                color: `rgb(var(--t-bg))`,
              }}
            >
              AI
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: `rgb(var(--t-accent))` }}
            >
              AI Comparison Summary
            </span>
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: `rgb(var(--t-muted))` }}
          >
            {summary}
          </p>
          <p
            className="mt-3 text-[10px]"
            style={{ color: `rgb(var(--t-dim))` }}
          >
            Research only · not financial advice · based solely on cited data sources
          </p>
        </div>
      )}
    </div>
  );
}
