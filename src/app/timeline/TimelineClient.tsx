"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TimelineEvent } from "@/app/api/timeline/route";
import type { HistoricalPrice } from "@/lib/twelvedata";

// ---- Autocomplete ticker picker ---------------------------------------------

interface Suggestion { symbol: string; name: string; exchange: string }

function TickerSearch({ onSelect }: { onSelect: (symbol: string, name: string) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch_ = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const results: Suggestion[] = data.results ?? [];
        setSuggestions(results);
        setOpen(results.length > 0);
      }
    } catch {}
    setLoading(false);
  }, []);

  function onInput(val: string) {
    setQuery(val.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetch_(val.trim()), 280);
  }

  function pick(s: Suggestion) {
    setQuery(s.symbol);
    setSuggestions([]);
    setOpen(false);
    onSelect(s.symbol, s.name);
  }

  return (
    <div className="relative">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onFocus={(e) => {
              if (suggestions.length > 0) setOpen(true);
              (e.target as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.6)`;
              (e.target as HTMLElement).style.boxShadow = `0 0 0 2px rgb(var(--t-accent) / 0.1)`;
            }}
            onBlur={(e) => {
              setTimeout(() => setOpen(false), 150);
              (e.target as HTMLElement).style.borderColor = `rgb(var(--t-border))`;
              (e.target as HTMLElement).style.boxShadow = ``;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && query.trim()) {
                setOpen(false);
                onSelect(query.trim(), "");
              }
            }}
            placeholder="e.g. NVDA"
            autoComplete="off"
            spellCheck={false}
            data-testid="timeline-ticker-input"
            className="w-full rounded-xl border px-4 py-3 font-mono text-xl tracking-wider outline-none transition"
            style={{
              borderColor: `rgb(var(--t-border))`,
              backgroundColor: `rgb(var(--t-card))`,
              color: `rgb(var(--t-text))`,
            }}
          />
          {open && (
            <div
              className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border shadow-2xl"
              style={{ borderColor: `rgb(var(--t-border) / 0.8)`, backgroundColor: `rgb(var(--t-card))` }}
            >
              {loading ? (
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
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover-row"
                        style={{ color: `rgb(var(--t-text))` }}
                        data-testid="timeline-suggestion"
                      >
                        <span className="font-mono text-sm font-semibold">{s.symbol}</span>
                        <span className="truncate text-xs" style={{ color: `rgb(var(--t-muted))` }}>{s.name}</span>
                        <span className="ml-auto text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>{s.exchange}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { if (query.trim()) { setOpen(false); onSelect(query.trim(), ""); } }}
          disabled={!query.trim()}
          className="btn-accent px-5 py-3 text-sm disabled:opacity-40"
          data-testid="timeline-load-btn"
        >
          Load
        </button>
      </div>
      {/* Quick-pick presets */}
      <div className="mt-3 flex flex-wrap gap-2">
        {["AAPL","NVDA","TSLA","MSFT","AMZN"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setQuery(p); setOpen(false); onSelect(p, ""); }}
            className="rounded-full border px-3 py-1 font-mono text-xs font-semibold transition"
            style={{
              borderColor: query === p ? `rgb(var(--t-accent) / 0.5)` : `rgb(var(--t-border))`,
              backgroundColor: query === p ? `rgb(var(--t-accent) / 0.1)` : ``,
              color: query === p ? `rgb(var(--t-accent))` : `rgb(var(--t-muted))`,
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Event colour / shape helpers -------------------------------------------

type EventType = "earnings" | "news" | "politician" | "insider" | "analystChange";

const EVENT_STYLES: Record<EventType, { color: string; label: string }> = {
  earnings:      { color: "var(--t-accent)", label: "Earnings" },
  news:          { color: "var(--t-success)", label: "News" },
  politician:    { color: "var(--t-warn)", label: "Politician trade" },
  insider:       { color: "20, 184, 166", label: "Insider transaction" },
  analystChange: { color: "100, 116, 139", label: "Analyst shift" },
};

function dotColor(type: EventType) {
  return `rgb(${EVENT_STYLES[type].color})`;
}

// ---- Recharts custom price tooltip ------------------------------------------

function PriceTooltip({ active, payload }: { active?: boolean; payload?: { payload: HistoricalPrice }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const up = d.changePercent >= 0;
  return (
    <div
      className="rounded-xl border px-3 py-2.5 shadow-xl backdrop-blur-sm"
      style={{
        borderColor: `rgb(var(--t-border) / 0.8)`,
        backgroundColor: `rgb(var(--t-card))`,
      }}
    >
      <p className="mb-1 text-[11px]" style={{ color: `rgb(var(--t-dim))` }}>{d.date}</p>
      <p className="font-mono text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
        ${d.close.toFixed(2)}
      </p>
      <p
        className="text-xs font-semibold"
        style={{ color: up ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
      >
        {up ? "+" : ""}{d.changePercent.toFixed(2)}%
      </p>
    </div>
  );
}

// ---- Event popover ----------------------------------------------------------

function EventPopover({
  event,
  onClose,
}: {
  event: TimelineEvent;
  onClose: () => void;
}) {
  const isEarnings = event.type === "earnings";
  const isBeat = event.beat === true;
  const isMiss = event.beat === false;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [nudge, setNudge] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rightOverflow = rect.right - (window.innerWidth - 8);
    const leftOverflow = 8 - rect.left;
    if (rightOverflow > 0) setNudge(-rightOverflow);
    else if (leftOverflow > 0) setNudge(leftOverflow);
  }, []);

  return (
    <div ref={wrapRef} style={nudge ? { transform: `translateX(${nudge}px)` } : undefined}>
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="w-64 rounded-xl border shadow-2xl"
      style={{
        borderColor: `rgb(${EVENT_STYLES[event.type].color} / 0.3)`,
        backgroundColor: `rgb(var(--t-card))`,
      }}
      data-testid="event-popover"
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: `rgb(var(--t-border) / 0.5)` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor(event.type) }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: dotColor(event.type) }}
          >
            {EVENT_STYLES[event.type].label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 text-xs"
          style={{ color: `rgb(var(--t-dim))` }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="px-3 py-3 space-y-1.5">
        <p
          className="text-[11px] font-medium"
          style={{ color: `rgb(var(--t-dim))` }}
        >
          {new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
          })}
        </p>
        <p
          className="text-xs leading-relaxed"
          style={{ color: `rgb(var(--t-text))` }}
        >
          {event.detail}
        </p>
        {isEarnings && (isBeat || isMiss) && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: isBeat ? `rgb(var(--t-success) / 0.12)` : `rgb(var(--t-danger) / 0.12)`,
              color: isBeat ? `rgb(var(--t-success))` : `rgb(var(--t-danger))`,
            }}
          >
            {isBeat ? "▲ Beat" : "▼ Miss"}
          </span>
        )}
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[10px] underline"
            style={{ color: `rgb(var(--t-accent))` }}
          >
            Read article ↗
          </a>
        )}
      </div>
    </motion.div>
    </div>
  );
}

// ---- Event markers row ------------------------------------------------------
// Positioned absolutely within a container that mirrors the chart's X-axis span.

const CHART_Y_AXIS_W = 62;   // px — matches recharts YAxis width={62}
const CHART_RIGHT_M = 16;    // px — matches recharts margin.right

function EventMarkersRow({
  prices,
  events,
  activeId,
  onToggle,
}: {
  prices: HistoricalPrice[];
  events: TimelineEvent[];
  activeId: string | null;
  onToggle: (ev: TimelineEvent) => void;
}) {
  const first = new Date(prices[0].date + "T12:00:00").getTime();
  const last  = new Date(prices[prices.length - 1].date + "T12:00:00").getTime();
  const range = last - first || 1;

  function xPct(dateStr: string) {
    const t = new Date(dateStr + "T12:00:00").getTime();
    return Math.max(0, Math.min(100, ((t - first) / range) * 100));
  }

  // Group events by date to avoid too many overlapping markers.
  // If multiple events fall on the same date, stack them.
  const groups = new Map<string, TimelineEvent[]>();
  for (const ev of events) {
    if (!groups.has(ev.date)) groups.set(ev.date, []);
    groups.get(ev.date)!.push(ev);
  }

  const activeEvent = events.find((e) => e.id === activeId) ?? null;

  return (
    <div
      className="relative"
      style={{
        height: 40,
        paddingLeft: CHART_Y_AXIS_W,
        paddingRight: CHART_RIGHT_M,
      }}
    >
      <div className="relative h-full">
        {/* Thin horizontal guide line */}
        <div
          className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
          style={{ backgroundColor: `rgb(var(--t-border) / 0.5)` }}
        />

        {[...groups.entries()].map(([date, group]) => {
          const x = xPct(date);
          const isActive = group.some((e) => e.id === activeId);
          const topEvent = group[0];

          return (
            <div
              key={date + group.map((e) => e.type).join()}
              className="absolute flex flex-col-reverse items-center"
              style={{ left: `${x}%`, top: "50%", transform: "translate(-50%, -50%)" }}
            >
              {/* Popover: centered on dot, viewport-aware nudge handled inside EventPopover */}
              <AnimatePresence>
                {isActive && activeEvent && (
                  <div
                    className="absolute bottom-full mb-4 z-30"
                    style={{ left: "50%", transform: "translateX(-50%)" }}
                  >
                    <EventPopover
                      event={activeEvent}
                      onClose={() => onToggle(activeEvent)}
                    />
                  </div>
                )}
              </AnimatePresence>

              {/* Dot(s) — stacked if multiple same date */}
              {group.slice(0, 3).map((ev, i) => (
                <motion.button
                  key={ev.id}
                  type="button"
                  onClick={() => onToggle(ev)}
                  aria-label={ev.title}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className="flex h-4 w-4 items-center justify-center rounded-full border-2 transition-transform hover:scale-125"
                  style={{
                    backgroundColor: dotColor(ev.type),
                    borderColor: `rgb(var(--t-card))`,
                    marginTop: i > 0 ? -4 : 0,
                    zIndex: 10 - i,
                    outline: ev.id === activeId ? `2px solid ${dotColor(ev.type)}` : "none",
                    outlineOffset: 2,
                  }}
                  data-testid={`event-dot-${ev.type}`}
                  title={ev.title}
                />
              ))}
              {group.length > 3 && (
                <span className="text-[8px] font-bold" style={{ color: `rgb(var(--t-dim))` }}>
                  +{group.length - 3}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Legend -----------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {(["earnings", "news", "politician", "insider", "analystChange"] as EventType[]).map((type) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dotColor(type) }}
          />
          <span className="text-[11px]" style={{ color: `rgb(var(--t-muted))` }}>
            {EVENT_STYLES[type].label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Event list (chronological, newest first) --------------------------------

function EventBadge({ type }: { type: EventType }) {
  const labels: Record<EventType, string> = {
    earnings: "EARNINGS", news: "NEWS", politician: "TRADE",
    insider: "INSIDER", analystChange: "ANALYST",
  };
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: `rgb(${EVENT_STYLES[type].color} / 0.12)`,
        color: dotColor(type),
      }}
    >
      {labels[type]}
    </span>
  );
}

function EventListItem({ event, onFocus }: { event: TimelineEvent; onFocus: (ev: TimelineEvent) => void }) {
  const isEarnings = event.type === "earnings";
  const isBeat = event.beat === true;
  const isMiss = event.beat === false;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-stretch gap-0 rounded-xl overflow-hidden mb-2"
      style={{
        border: `1px solid rgba(255,255,255,0.06)`,
        backgroundColor: `rgba(255,255,255,0.02)`,
      }}
    >
      {/* Left colour accent bar */}
      <div
        className="w-1 shrink-0 rounded-l-xl"
        style={{ backgroundColor: dotColor(event.type) }}
      />

      <div className="flex flex-1 items-start gap-3 px-4 py-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px]"
              style={{
                color: `rgb(var(--t-dim))`,
                fontFamily: `var(--font-mono), ui-monospace, monospace`,
              }}
            >
              {new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric"
              })}
            </span>
            <EventBadge type={event.type} />
            {isEarnings && (isBeat || isMiss) && (
              <span
                className="text-[10px] font-semibold"
                style={{ color: isBeat ? `rgb(var(--t-success))` : `rgb(var(--t-danger))` }}
              >
                {isBeat ? "▲ Beat" : "▼ Miss"}
              </span>
            )}
          </div>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: `rgb(var(--t-text))` }}
          >
            {event.detail}
          </p>
          {event.link && (
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-[10px] underline"
              style={{ color: `rgb(var(--t-accent))` }}
            >
              Source ↗
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => onFocus(event)}
          className="shrink-0 rounded-lg border px-2 py-1 text-[10px] transition self-start mt-0.5"
          style={{ borderColor: `rgba(255,255,255,0.08)`, color: `rgb(var(--t-dim))`, backgroundColor: `rgba(255,255,255,0.03)` }}
          title="Show on chart"
        >
          ↑ Chart
        </button>
      </div>
    </motion.div>
  );
}

// ---- Main client component --------------------------------------------------

interface TimelineData {
  ticker: string;
  prices: HistoricalPrice[];
  events: TimelineEvent[];
}

export function TimelineClient() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTicker, setCurrentTicker] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Scroll to chart when a list item is focused
  const chartRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside the marker row
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-testid^='event-dot']") &&
          !target.closest("[data-testid='event-popover']")) {
        setActiveId(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function loadTimeline(symbol: string) {
    setLoading(true);
    setError("");
    setData(null);
    setActiveId(null);
    setCurrentTicker(symbol);
    try {
      const res = await fetch(`/api/timeline?ticker=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load."); return; }
      setData(json as TimelineData);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleActive(ev: TimelineEvent) {
    setActiveId((prev) => (prev === ev.id ? null : ev.id));
  }

  function focusOnChart(ev: TimelineEvent) {
    setActiveId(ev.id);
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const earningsForChart = (data?.events ?? []).filter((e) => e.type === "earnings");
  const tickInterval = data?.prices.length
    ? Math.max(1, Math.floor(data.prices.length / 8))
    : 30;

  // Sorted newest-first for the list
  const eventsNewestFirst = [...(data?.events ?? [])].reverse();

  return (
    <div className="space-y-6">
      {/* Ticker search */}
      <div
        className="rounded-3xl border p-5"
        style={{
          borderColor: `rgba(255,255,255,0.08)`,
          backgroundColor: `var(--card-bg, rgb(var(--t-card)))`,
          backdropFilter: `var(--card-blur, none)`,
          WebkitBackdropFilter: `var(--card-blur, none)`,
          boxShadow: `var(--card-shadow, none)`,
        }}
      >
        <TickerSearch onSelect={(symbol) => loadTimeline(symbol)} />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div
          className="rounded-3xl border p-5 space-y-3"
          style={{
            borderColor: `rgba(255,255,255,0.08)`,
            backgroundColor: `var(--card-bg, rgb(var(--t-card)))`,
          }}
        >
          <div className="skeleton h-5 w-32 rounded" />
          <div className="skeleton h-72 w-full rounded" />
          <div className="skeleton h-8 w-full rounded" />
        </div>
      )}

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

      {/* Chart + markers */}
      {data && (
        <div
          ref={chartRef}
          className="overflow-hidden rounded-3xl border"
          style={{
            borderColor: `rgba(255,255,255,0.08)`,
            backgroundColor: `var(--card-bg, rgb(var(--t-card)))`,
            backdropFilter: `var(--card-blur, none)`,
            WebkitBackdropFilter: `var(--card-blur, none)`,
            boxShadow: `var(--card-shadow, none)`,
          }}
          data-testid="timeline-chart-section"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid rgba(255,255,255,0.06)` }}
          >
            <div>
              <span
                className="text-sm font-bold"
                style={{
                  color: `rgb(var(--t-text))`,
                  fontFamily: `'Clash Display', var(--font-mono), ui-monospace, monospace`,
                }}
              >
                {currentTicker}
              </span>
              <span className="ml-2 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
                12-month closing price · {data.events.length} events
              </span>
            </div>
            <Legend />
          </div>

          {/* Price chart */}
          <div className="px-2 pt-5 pb-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={data.prices}
                margin={{ top: 5, right: CHART_RIGHT_M, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={`rgb(var(--t-border))`}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  interval={tickInterval}
                  tickFormatter={(v: string) => {
                    const d = new Date(`${v}T12:00:00`);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                  tick={{ fill: `rgb(var(--t-dim))`, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fill: `rgb(var(--t-dim))`, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={CHART_Y_AXIS_W}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={PriceTooltip as React.FC} />
                {/* Earnings reference lines only — keeps chart readable */}
                {earningsForChart.map((ev) => (
                  <ReferenceLine
                    key={ev.id}
                    x={ev.date}
                    stroke={
                      ev.beat === true
                        ? `rgb(var(--t-success))`
                        : ev.beat === false
                        ? `rgb(var(--t-danger))`
                        : `rgb(var(--t-accent))`
                    }
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={`rgb(var(--t-accent))`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: `rgb(var(--t-accent))`, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Event marker dots row */}
          <div className="px-2 pb-4">
            <EventMarkersRow
              prices={data.prices}
              events={data.events}
              activeId={activeId}
              onToggle={toggleActive}
            />
          </div>
        </div>
      )}

      {/* Event list */}
      {data && data.events.length > 0 && (
        <div
          className="rounded-3xl border overflow-hidden"
          style={{
            borderColor: `rgba(255,255,255,0.08)`,
            backgroundColor: `var(--card-bg, rgb(var(--t-card)))`,
            backdropFilter: `var(--card-blur, none)`,
            WebkitBackdropFilter: `var(--card-blur, none)`,
            boxShadow: `var(--card-shadow, none)`,
          }}
          data-testid="timeline-event-list"
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: `1px solid rgba(255,255,255,0.06)` }}
          >
            <span className="text-xs font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
              All Events — {eventsNewestFirst.length} total · most recent first
            </span>
          </div>
          <div className="px-4 py-4">
            {eventsNewestFirst.map((ev) => (
              <EventListItem key={ev.id} event={ev} onFocus={focusOnChart} />
            ))}
          </div>
          <div
            className="px-5 py-3 text-center text-[10px]"
            style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, color: `rgb(var(--t-dim))` }}
          >
            Research only · not financial advice · sources: Finnhub, FMP, Twelve Data
          </div>
        </div>
      )}

      {data && data.events.length === 0 && (
        <div
          className="rounded-xl border px-5 py-4 text-sm"
          style={{
            borderColor: `rgb(var(--t-border) / 0.5)`,
            color: `rgb(var(--t-muted))`,
          }}
        >
          No events found for {currentTicker} in the past year.
        </div>
      )}
    </div>
  );
}
