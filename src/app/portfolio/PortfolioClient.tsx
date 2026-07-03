"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { InfoTooltip } from "@/components/InfoTooltip";
import { parseBrokerCsv, type ParsedHolding } from "@/lib/csvImport";

interface Holding {
  id: string;
  ticker: string;
  shares: number;
  avgCost: number | null;
  purchasedDate: string | null;
  companyName: string;
  sector: string | null;
  price: number | null;
  value: number | null;
  gainDollar: number | null;
  gainPercent: number | null;
  earningsDate: string | null;
  earningsHour: string | null;
  news: Array<{ title: string; url: string; date: string }>;
}

interface Suggestion { symbol: string; name: string; exchange: string }

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

// Sector palette derived from the theme accent plus fixed hues that read on
// every theme background.
const SECTOR_COLORS = [
  "rgb(var(--t-accent))",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#c084fc",
  "#fb923c",
  "#94a3b8",
];

// ---- Ticker autocomplete input -----------------------------------------------

function TickerInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onInput(v: string) {
    onChange(v.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = v.trim();
      if (!q) { setSuggestions([]); setOpen(false); return; }
      try {
        const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          const results: Suggestion[] = (data.results ?? []).slice(0, 6);
          setSuggestions(results);
          setOpen(results.length > 0);
        }
      } catch {}
    }, 250);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="NVDA"
        maxLength={10}
        className="input-base font-mono text-sm font-semibold uppercase"
        data-testid="portfolio-ticker-input"
      />
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border shadow-2xl"
          style={{ borderColor: `rgb(var(--t-border) / 0.8)`, backgroundColor: `rgb(var(--t-card))` }}
        >
          {suggestions.map((s) => (
            <button
              key={s.symbol}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.symbol);
                setOpen(false);
              }}
              className="hover-row flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <span className="font-mono text-xs font-bold" style={{ color: `rgb(var(--t-text))` }}>
                {s.symbol}
              </span>
              <span className="truncate text-[11px]" style={{ color: `rgb(var(--t-muted))` }}>
                {s.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- CSV import ----------------------------------------------------------------

function CsvImport({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedHolding[] | null>(null);
  const [detected, setDetected] = useState<string>("");
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseBrokerCsv(String(reader.result ?? ""));
      if (result.error && result.rows.length === 0) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setPreview(result.rows);
      setSkipped(result.skipped);
      setDetected(
        result.detected
          ? `Detected columns — ticker: "${result.detected.ticker}", shares: "${result.detected.shares}"${result.detected.cost ? `, cost: "${result.detected.cost}"` : ""}`
          : ""
      );
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/portfolio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setPreview(null);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-ghost text-xs"
          data-testid="csv-import-btn"
        >
          ⇪ Import from broker (CSV)
        </button>
        <InfoTooltip text="Export your holdings CSV from your broker's app or website (Robinhood, Schwab, Fidelity, E*Trade all support this), then upload it here. Columns are detected automatically." />
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />

      {error && (
        <p className="mt-2 text-xs" style={{ color: `rgb(var(--t-danger))` }}>{error}</p>
      )}

      {preview && (
        <div
          className="mt-3 rounded-xl border p-4"
          style={{ borderColor: `rgb(var(--t-accent) / 0.3)`, backgroundColor: `rgb(var(--t-accent) / 0.04)` }}
          data-testid="csv-preview"
        >
          <p className="text-xs font-semibold" style={{ color: `rgb(var(--t-text))` }}>
            Preview: {preview.length} holding{preview.length === 1 ? "" : "s"} will be imported
            {skipped > 0 && (
              <span className="font-normal" style={{ color: `rgb(var(--t-dim))` }}>
                {" "}· {skipped} non-stock row{skipped === 1 ? "" : "s"} skipped
              </span>
            )}
          </p>
          {detected && (
            <p className="mt-0.5 text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>{detected}</p>
          )}
          <div className="mt-2 max-h-44 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ color: `rgb(var(--t-dim))` }}>
                  <th className="py-1 pr-3 font-semibold">Ticker</th>
                  <th className="py-1 pr-3 font-semibold">Shares</th>
                  <th className="py-1 font-semibold">Avg Cost</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.ticker} style={{ color: `rgb(var(--t-muted))` }}>
                    <td className="py-1 pr-3 font-mono font-bold" style={{ color: `rgb(var(--t-text))` }}>
                      {r.ticker}
                    </td>
                    <td className="py-1 pr-3 font-mono">{r.shares}</td>
                    <td className="py-1 font-mono">
                      {r.avg_cost != null ? `$${r.avg_cost.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirmImport}
              disabled={importing}
              className="btn-accent px-4 py-1.5 text-xs disabled:opacity-50"
              data-testid="csv-confirm-btn"
            >
              {importing ? "Importing…" : `Import ${preview.length} holdings`}
            </button>
            <button onClick={() => setPreview(null)} className="btn-ghost px-4 py-1.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main client ----------------------------------------------------------------

export function PortfolioClient() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [loadError, setLoadError] = useState("");

  // Manual entry form
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [date, setDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  // AI summary
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(() => {
    fetch("/api/portfolio/details")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); setHoldings([]); }
        else { setHoldings(d.holdings ?? []); setLoadError(""); }
      })
      .catch(() => { setLoadError("Failed to load portfolio."); setHoldings([]); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setAdding(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.trim(),
          shares: Number(shares),
          avg_cost: avgCost.trim() ? Number(avgCost) : null,
          purchased_date: date || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add holding.");
      setTicker(""); setShares(""); setAvgCost(""); setDate("");
      setHoldings(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add holding.");
    } finally {
      setAdding(false);
    }
  }

  async function removeHolding(id: string) {
    setHoldings((prev) => (prev ? prev.filter((h) => h.id !== id) : prev));
    await fetch("/api/portfolio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    load();
  }

  async function generateSummary() {
    if (!holdings || holdings.length === 0) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/portfolio/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: holdings.map((h) => ({ ticker: h.ticker, sector: h.sector, value: h.value })),
          earningsSoon: holdings.filter((h) => h.earningsDate).map((h) => h.ticker),
        }),
      });
      const data = await res.json();
      if (res.ok) setSummary(data.summary);
    } catch {} finally {
      setSummarizing(false);
    }
  }

  const totalValue = (holdings ?? []).reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost = (holdings ?? []).reduce(
    (s, h) => s + (h.avgCost != null ? h.avgCost * h.shares : 0),
    0
  );
  const holdingsWithCost = (holdings ?? []).filter((h) => h.avgCost != null && h.value != null);
  const costOfPriced = holdingsWithCost.reduce((s, h) => s + h.avgCost! * h.shares, 0);
  const valueOfPriced = holdingsWithCost.reduce((s, h) => s + h.value!, 0);
  const totalGain = valueOfPriced - costOfPriced;
  const totalGainPct = costOfPriced > 0 ? (totalGain / costOfPriced) * 100 : null;

  const sectorData = (() => {
    const map = new Map<string, number>();
    for (const h of holdings ?? []) {
      if (h.value == null) continue;
      const key = h.sector || "Other";
      map.set(key, (map.get(key) ?? 0) + h.value);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  })();

  const earningsSoon = (holdings ?? [])
    .filter((h) => h.earningsDate)
    .sort((a, b) => (a.earningsDate! > b.earningsDate! ? 1 : -1));

  const newsItems = (holdings ?? []).flatMap((h) =>
    h.news.slice(0, 2).map((n) => ({ ...n, ticker: h.ticker }))
  );

  return (
    <div className="space-y-6">
      {/* ---- Add holdings ---- */}
      <div className="card p-6">
        <div className="label mb-4">Add Holdings</div>
        <form onSubmit={addHolding} className="grid gap-3 sm:grid-cols-[1fr_100px_120px_150px_auto]">
          <TickerInput value={ticker} onChange={setTicker} />
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="Shares"
            inputMode="decimal"
            className="input-base font-mono text-sm"
            data-testid="portfolio-shares-input"
          />
          <input
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            placeholder="Avg cost $"
            inputMode="decimal"
            className="input-base font-mono text-sm"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-base font-mono text-sm"
            style={{ colorScheme: "inherit" }}
          />
          <button
            type="submit"
            disabled={adding || !ticker.trim() || !shares.trim()}
            className="btn-accent text-sm disabled:opacity-50"
            data-testid="portfolio-add-btn"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {formError && (
          <p className="mt-2 text-xs" style={{ color: `rgb(var(--t-danger))` }}>{formError}</p>
        )}
        <div className="mt-4 border-t pt-4" style={{ borderColor: `rgb(var(--t-text) / 0.06)` }}>
          <CsvImport onImported={() => { setHoldings(null); load(); }} />
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-t-danger/30 bg-t-danger/10 px-4 py-3 text-sm text-t-danger">
          {loadError}
        </div>
      )}

      {holdings === null && !loadError && (
        <div className="space-y-3">
          <div className="skeleton h-24 w-full rounded-2xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      )}

      {holdings && holdings.length === 0 && !loadError && (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="text-3xl" style={{ color: `rgb(var(--t-dim))` }}>◫</span>
          <p className="mt-3 text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
            No holdings yet
          </p>
          <p className="mt-1 max-w-sm text-xs" style={{ color: `rgb(var(--t-muted))` }}>
            Add a position manually above, or import your broker&apos;s CSV export.
          </p>
        </div>
      )}

      {holdings && holdings.length > 0 && (
        <>
          {/* ---- Total value ---- */}
          <div className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="label mb-1">Total Portfolio Value</div>
                <p
                  className="font-mono font-bold"
                  style={{ fontSize: "2.5rem", lineHeight: 1.1, color: `rgb(var(--t-text))` }}
                  data-testid="portfolio-total"
                >
                  {money(totalValue)}
                </p>
              </div>
              {totalGainPct != null && totalCost > 0 && (
                <div className="text-right">
                  <div className="label mb-1">Total Gain / Loss</div>
                  <p
                    className="font-mono text-xl font-bold"
                    style={{ color: totalGain >= 0 ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
                  >
                    {totalGain >= 0 ? "+" : ""}{money(totalGain)}{" "}
                    <span className="text-sm">({totalGain >= 0 ? "+" : ""}{totalGainPct.toFixed(2)}%)</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ---- Holdings table ---- */}
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: `rgb(var(--t-border) / 0.6)` }}>
                  {["Ticker", "Company", "Shares", "Avg Cost", "Price", "Value", "Gain/Loss", ""].map((h) => (
                    <th key={h} className="label whitespace-nowrap px-4 py-3 text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const up = (h.gainDollar ?? 0) >= 0;
                  return (
                    <tr
                      key={h.id}
                      className="border-t transition hover:bg-t-accent/[0.04]"
                      style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
                      data-testid={`holding-row-${h.ticker}`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-bold" style={{ color: `rgb(var(--t-accent))` }}>
                        {h.ticker}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                        {h.companyName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: `rgb(var(--t-text))` }}>
                        {h.shares.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                        {h.avgCost != null ? `$${h.avgCost.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: `rgb(var(--t-text))` }}>
                        {h.price != null ? `$${h.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
                        {h.value != null ? money(h.value) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold"
                        style={{ color: h.gainDollar == null ? `rgb(var(--t-dim))` : up ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
                      >
                        {h.gainDollar != null
                          ? `${up ? "+" : ""}${money(h.gainDollar)} (${up ? "+" : ""}${h.gainPercent!.toFixed(1)}%)`
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => removeHolding(h.id)}
                          className="text-xs transition hover:opacity-70"
                          style={{ color: `rgb(var(--t-dim))` }}
                          title={`Remove ${h.ticker}`}
                          aria-label={`Remove ${h.ticker}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---- Insights grid ---- */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Sector allocation */}
            <div className="card p-5">
              <div className="label mb-3">Sector Allocation</div>
              {sectorData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="h-40 w-40 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sectorData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={42}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {sectorData.map((_, i) => (
                            <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => money(Number(v))}
                          contentStyle={{
                            backgroundColor: `rgb(var(--t-card))`,
                            border: `1px solid rgb(var(--t-border))`,
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5">
                    {sectorData.map((s, i) => (
                      <li key={s.name} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                        />
                        <span className="truncate" style={{ color: `rgb(var(--t-muted))` }}>{s.name}</span>
                        <span className="ml-auto font-mono font-semibold" style={{ color: `rgb(var(--t-text))` }}>
                          {totalValue > 0 ? ((s.value / totalValue) * 100).toFixed(1) : "0"}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                  Sector data unavailable for these holdings.
                </p>
              )}
            </div>

            {/* Earnings exposure */}
            <div className="card p-5">
              <div className="label mb-3">Earnings — Next 30 Days</div>
              {earningsSoon.length > 0 ? (
                <ul className="space-y-2.5">
                  {earningsSoon.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono font-bold" style={{ color: `rgb(var(--t-text))` }}>
                        {h.ticker}
                      </span>
                      <span className="truncate text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                        {h.companyName}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-xs" style={{ color: `rgb(var(--t-warn))` }}>
                        {new Date(h.earningsDate! + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {h.earningsHour && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ backgroundColor: `rgb(var(--t-warn) / 0.12)` }}
                          >
                            {h.earningsHour}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                  None of your holdings report earnings in the next 30 days.
                </p>
              )}
            </div>
          </div>

          {/* ---- AI summary ---- */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="label">✦ AI Portfolio Summary</span>
              <button
                onClick={generateSummary}
                disabled={summarizing}
                className="hover-accent-text text-xs font-semibold disabled:opacity-50"
                style={{ color: `rgb(var(--t-accent))` }}
                data-testid="portfolio-summary-btn"
              >
                {summarizing ? "Generating…" : summary ? "Regenerate ↻" : "Generate →"}
              </button>
            </div>
            {summarizing ? (
              <div className="space-y-2">
                <div className="skeleton h-3.5 w-full" />
                <div className="skeleton h-3.5 w-5/6" />
              </div>
            ) : summary ? (
              <>
                <p className="text-sm leading-relaxed" style={{ color: `rgb(var(--t-muted))` }}>
                  {summary}
                </p>
                <p className="mt-2 text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
                  Factual composition summary only — not financial advice.
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                A factual 3–4 sentence description of your portfolio&apos;s composition.
              </p>
            )}
          </div>

          {/* ---- News affecting holdings ---- */}
          {newsItems.length > 0 && (
            <div className="card p-5">
              <div className="label mb-3">Recent News — Your Holdings</div>
              <ul className="space-y-2.5">
                {newsItems.slice(0, 12).map((n, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 pt-0.5 font-mono text-[11px] font-bold" style={{ color: `rgb(var(--t-accent))` }}>
                      {n.ticker}
                    </span>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover-accent-text min-w-0 flex-1 text-xs leading-relaxed"
                      style={{ color: `rgb(var(--t-muted))` }}
                    >
                      {n.title}
                    </a>
                    <span className="shrink-0 font-mono text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>
                      {n.date}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
