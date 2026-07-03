"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, THEMES, type Theme } from "@/contexts/ThemeContext";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface Item {
  id: string;
  type: "nav" | "ticker" | "theme" | "action";
  label: string;
  sublabel?: string;
  icon: string;
  action: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", href: "/dashboard" },
  { label: "Market News", icon: "⬡", href: "/news" },
  { label: "Earnings Intelligence", icon: "◑", href: "/earnings" },
  { label: "Alerts", icon: "◎", href: "/alerts" },
  { label: "Price Explainer", icon: "⌁", href: "/explain" },
  { label: "Settings", icon: "⊙", href: "/settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tickers, setTickers] = useState<SearchResult[]>([]);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTickers([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const searchTickers = useCallback(async (q: string) => {
    if (q.length < 1) { setTickers([]); return; }
    setTickerLoading(true);
    try {
      const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setTickers(data.results ?? []);
      }
    } catch {}
    setTickerLoading(false);
  }, []);

  function onQueryChange(val: string) {
    setQuery(val);
    setActiveIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTickers(val.trim()), 250);
  }

  const items: Item[] = [];

  if (!query) {
    NAV_ITEMS.forEach((n) =>
      items.push({
        id: `nav-${n.href}`,
        type: "nav",
        label: n.label,
        icon: n.icon,
        action: () => { router.push(n.href); setOpen(false); },
      })
    );
    THEMES.forEach((t) =>
      items.push({
        id: `theme-${t.id}`,
        type: "theme",
        label: `Theme: ${t.label}`,
        sublabel: t.description,
        icon: "◐",
        action: () => { setTheme(t.id as Theme); setOpen(false); },
      })
    );
  } else {
    NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())).forEach((n) =>
      items.push({
        id: `nav-${n.href}`,
        type: "nav",
        label: n.label,
        icon: n.icon,
        action: () => { router.push(n.href); setOpen(false); },
      })
    );
    tickers.forEach((t) =>
      items.push({
        id: `ticker-${t.symbol}`,
        type: "ticker",
        label: t.symbol,
        sublabel: `${t.name} · ${t.exchange}`,
        icon: "◈",
        action: () => {
          router.push(`/dashboard?ticker=${t.symbol}`);
          setOpen(false);
        },
      })
    );
    if (query.length >= 1 && query.match(/^[A-Z.]{1,6}$/i)) {
      items.push({
        id: "action-report",
        type: "action",
        label: `Research "${query.toUpperCase()}"`,
        sublabel: "Generate AI research report",
        icon: "→",
        action: () => {
          router.push(`/dashboard?ticker=${query.toUpperCase()}`);
          setOpen(false);
        },
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[activeIndex]) {
      items[activeIndex].action();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: "rgba(5,7,15,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh] px-4 pointer-events-none">
            <motion.div
              className="w-full max-w-xl pointer-events-auto overflow-hidden shadow-2xl"
              style={{
                borderRadius: "1.5rem",
                border: "1px solid rgb(var(--t-text) / 0.1)",
                backgroundColor: "rgba(10,13,26,0.92)",
                backdropFilter: "blur(32px) saturate(180%)",
                WebkitBackdropFilter: "blur(32px) saturate(180%)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgb(var(--t-text) / 0.08)",
              }}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* Input */}
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid rgb(var(--t-text) / 0.07)" }}
              >
                <span className="text-lg shrink-0" style={{ color: `rgb(var(--t-accent))` }}>⌘</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value.toUpperCase())}
                  onKeyDown={onKeyDown}
                  placeholder="Search companies, navigate, switch theme…"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: `rgb(var(--t-text))` }}
                />
                {tickerLoading && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2"
                    style={{ borderColor: `rgb(var(--t-text) / 0.15)`, borderTopColor: `rgb(var(--t-accent))` }}
                  />
                )}
                <kbd
                  className="shrink-0 rounded-lg border px-2 py-1 text-[10px] font-mono"
                  style={{ borderColor: "rgb(var(--t-text) / 0.1)", color: `rgb(var(--t-dim))`, backgroundColor: "rgb(var(--t-text) / 0.04)" }}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {items.length === 0 ? (
                  <div className="py-10 text-center text-sm" style={{ color: `rgb(var(--t-dim))` }}>
                    No results
                  </div>
                ) : (
                  items.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(i)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors"
                      style={{
                        backgroundColor: i === activeIndex ? `rgba(212,175,55,0.08)` : "transparent",
                      }}
                    >
                      <span className="shrink-0 text-base w-5 text-center" style={{ color: `rgb(var(--t-accent))` }}>
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium" style={{ color: `rgb(var(--t-text))` }}>{item.label}</div>
                        {item.sublabel && (
                          <div className="text-[11px] truncate" style={{ color: `rgb(var(--t-muted))` }}>{item.sublabel}</div>
                        )}
                      </div>
                      {i === activeIndex && (
                        <kbd
                          className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono"
                          style={{ borderColor: "rgb(var(--t-text) / 0.1)", color: `rgb(var(--t-dim))` }}
                        >
                          ↵
                        </kbd>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div
                className="px-5 py-3 flex items-center gap-5"
                style={{ borderTop: "1px solid rgb(var(--t-text) / 0.07)" }}
              >
                {[["↑↓", "navigate"], ["↵", "select"], ["esc", "close"]].map(([key, hint]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <kbd
                      className="rounded border px-1.5 py-0.5 text-[10px] font-mono"
                      style={{ borderColor: "rgb(var(--t-text) / 0.1)", color: `rgb(var(--t-dim))` }}
                    >
                      {key}
                    </kbd>
                    <span className="text-[10px]" style={{ color: `rgb(var(--t-dim))` }}>{hint}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
