"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import type { EarningsRecord } from "@/app/api/earnings/route";

interface EarningsData {
  ticker: string;
  earnings: EarningsRecord[];
  summary: string;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-900/60 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
      <div className="mt-1.5 font-mono text-lg font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-ink-800 px-3 py-2 text-xs shadow-lg">
      <p className="font-mono font-semibold text-white">{label}</p>
      <p className={val >= 0 ? "text-emerald-400" : "text-rose-400"}>
        {val >= 0 ? "Beat" : "Missed"} by {Math.abs(val).toFixed(2)}%
      </p>
    </div>
  );
}

export function EarningsClient() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<EarningsData | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/earnings?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load earnings.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const chartData = data
    ? data.earnings.slice(-8).map((r) => ({
        label: `${r.year}Q${r.quarter}`,
        surprise: +(r.surprisePercent ?? 0).toFixed(2),
        actual: r.actual,
        estimate: r.estimate,
        beat: (r.surprisePercent ?? 0) >= 0,
      }))
    : [];

  const beats = data ? data.earnings.filter((r) => (r.surprise ?? 0) > 0).length : 0;
  const total = data ? data.earnings.length : 0;
  const avgSurprise = data
    ? (data.earnings.reduce((s, r) => s + (r.surprisePercent ?? 0), 0) / total).toFixed(1)
    : "0";

  return (
    <div className="space-y-8">
      {/* Search */}
      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          id="earnings-ticker"
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          maxLength={10}
          className="w-40 rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-2.5 font-mono text-sm font-semibold uppercase text-white placeholder-slate-600 outline-none backdrop-blur transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          disabled={loading || !ticker.trim()}
          className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:from-brand-400 hover:to-brand-500 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Analyze"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-white">{data.ticker}</span>
            <span className="text-sm text-slate-500">EPS Earnings Intelligence</span>
          </div>

          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Beat Rate"
              value={`${beats}/${total}`}
              sub={`${((beats / total) * 100).toFixed(0)}% of quarters`}
            />
            <StatCard
              label="Avg EPS Surprise"
              value={`${Number(avgSurprise) >= 0 ? "+" : ""}${avgSurprise}%`}
            />
            <StatCard
              label="Quarters of Data"
              value={String(total)}
              sub="EPS history"
            />
          </div>

          {/* AI summary */}
          {data.summary && (
            <div className="rounded-xl border border-brand-500/15 bg-brand-500/5 px-5 py-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-brand-400">
                AI Trend Summary
              </p>
              <p className="text-sm leading-relaxed text-slate-300">{data.summary}</p>
              <p className="mt-2 text-[10px] text-slate-700">Not financial advice. Research only.</p>
            </div>
          )}

          {/* Bar chart — EPS surprise % */}
          <div className="rounded-2xl border border-white/[0.07] bg-ink-800/40 p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              EPS Surprise % — Last 8 Quarters
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="surprise" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.beat ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.75)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-ink-800/40">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Period", "Estimate", "Actual", "Surprise", "Surprise %"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.earnings].reverse().map((r, i) => {
                  const beat = (r.surprise ?? 0) >= 0;
                  return (
                    <tr key={i} className="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {r.year}Q{r.quarter}
                        <span className="ml-2 text-slate-700">{r.period}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-300">
                        ${r.estimate?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-white">
                        ${r.actual?.toFixed(2) ?? "—"}
                      </td>
                      <td className={`px-4 py-3 font-mono text-sm ${beat ? "text-emerald-400" : "text-rose-400"}`}>
                        {r.surprise !== null
                          ? `${beat ? "+" : ""}${r.surprise.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className={`px-4 py-3 font-mono text-sm ${beat ? "text-emerald-400" : "text-rose-400"}`}>
                        {r.surprisePercent !== null
                          ? `${beat ? "+" : ""}${r.surprisePercent.toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-700">
            Data from Finnhub. EPS figures are non-GAAP where reported. Past earnings performance does not predict future results.
          </p>
        </motion.div>
      )}
    </div>
  );
}
