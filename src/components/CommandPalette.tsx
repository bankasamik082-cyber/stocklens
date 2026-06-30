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
  const { setTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tickers, setTickers] = useState<SearchResult[]>([]);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open/close via Cmd+K / Ctrl+K
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

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setTickers([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Ticker search
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

  // Build item list
  const items: Item[] = [];

  if (!query) {
    // Navigation
    NAV_ITEMS.forEach((n) =>
      items.push({
        id: `nav-${n.href}`,
        type: "nav",
        label: n.label,
        icon: n.icon,
        action: () => { router.push(n.href); setOpen(false); },
      })
    );
    // Theme switching
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
    // Filter nav
    NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())).forEach((n) =>
      items.push({
        id: `nav-${n.href}`,
        type: "nav",
        label: n.label,
        icon: n.icon,
        action: () => { router.push(n.href); setOpen(false); },
      })
    );
    // Ticker results
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
    // Action: run report
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

  // Keyboard navigation
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

  const typeColor: Record<Item["type"], string> = {
    nav:    "text-t-accent",
    ticker: "text-t-muted",
    theme:  "text-t-muted",
    action: "text-t-accent",
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-t-bg/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4 pointer-events-none">
            <motion.div
              className="w-full max-w-xl pointer-events-auto overflow-hidden rounded-2xl card shadow-2xl"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-t-border/50">
                <span className="text-t-muted text-base shrink-0">⌘</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value.toUpperCase())}
                  onKeyDown={onKeyDown}
                  placeholder="Search companies, navigate, switch theme…"
                  className="flex-1 bg-transparent text-sm text-t-text placeholder-t-dim outline-none"
                />
                {tickerLoading && (
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-t-border border-t-accent" />
                )}
                <kbd className="shrink-0 rounded border border-t-border px-1.5 py-0.5 text-[10px] text-t-dim font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-1.5">
                {items.length === 0 ? (
                  <div className="py-10 text-center text-sm text-t-dim">
                    No results
                  </div>
                ) : (
                  items.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                        i === activeIndex
                          ? "bg-t-accent/8"
                          : "hover:bg-t-accent/5"
                      }`}
                      style={{
                        backgroundColor:
                          i === activeIndex ? `rgb(var(--t-accent) / 0.08)` : undefined,
                      }}
                    >
                      <span className={`shrink-0 text-base ${typeColor[item.type]}`} style={{ color: `rgb(var(--t-accent))` }}>
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-t-text truncate">{item.label}</div>
                        {item.sublabel && (
                          <div className="text-[11px] text-t-muted truncate">{item.sublabel}</div>
                        )}
                      </div>
                      {i === activeIndex && (
                        <kbd className="shrink-0 rounded border border-t-border px-1.5 py-0.5 text-[10px] text-t-dim font-mono">
                          ↵
                        </kbd>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="border-t border-t-border/50 px-4 py-2 flex items-center gap-4">
                {[
                  ["↑↓", "navigate"],
                  ["↵", "select"],
                  ["esc", "close"],
                ].map(([key, hint]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <kbd className="rounded border border-t-border px-1.5 py-0.5 text-[10px] font-mono text-t-dim">{key}</kbd>
                    <span className="text-[10px] text-t-dim">{hint}</span>
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
