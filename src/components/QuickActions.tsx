"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function QuickActions({
  ticker,
  initiallySaved,
}: {
  ticker: string;
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);

  async function toggleWatchlist() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(saved ? "/api/watchlist/remove" : "/api/watchlist/add", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) {
        setSaved(!saved);
        router.refresh();
      }
    } catch {} finally {
      setSaving(false);
    }
  }

  const itemClass =
    "hover-quick-link flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap";
  const itemStyle = {
    borderColor: `rgb(var(--t-text) / 0.08)`,
    color: `rgb(var(--t-muted))`,
    backgroundColor: `rgb(var(--t-text) / 0.02)`,
  } as const;

  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
      <Link href={`/dashboard?ticker=${ticker}`} className={itemClass} style={itemStyle}>
        <span style={{ color: `rgb(var(--t-accent))` }}>⟳</span> Generate New Report
      </Link>
      <button
        onClick={toggleWatchlist}
        disabled={saving}
        className={`${itemClass} disabled:opacity-50`}
        style={saved ? { ...itemStyle, color: `rgb(var(--t-accent))`, borderColor: `rgb(var(--t-accent) / 0.35)` } : itemStyle}
        data-testid="quick-watchlist-btn"
      >
        <span style={{ color: `rgb(var(--t-accent))` }}>{saved ? "★" : "☆"}</span>
        {saved ? "On Watchlist" : "Add to Watchlist"}
      </button>
      <Link href={`/compare?ticker=${ticker}`} className={itemClass} style={itemStyle}>
        <span style={{ color: `rgb(var(--t-accent))` }}>⧉</span> Compare
      </Link>
      <Link href={`/timeline?ticker=${ticker}`} className={itemClass} style={itemStyle}>
        <span style={{ color: `rgb(var(--t-accent))` }}>⌁</span> Open Timeline
      </Link>
      <button
        onClick={() => window.dispatchEvent(new Event("sl-open-chat"))}
        className={itemClass}
        style={itemStyle}
      >
        <span style={{ color: `rgb(var(--t-accent))` }}>✦</span> Open Chat
      </button>
    </div>
  );
}
