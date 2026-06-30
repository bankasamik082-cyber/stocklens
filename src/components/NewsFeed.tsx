"use client";

import { useEffect, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";

interface NewsItem {
  title: string;
  displayTitle?: string;
  text: string;
  publishedDate: string;
  site: string;
  url: string;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/market-news");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load news.");
        if (!cancelled) setItems(data.news);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load news.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorMessage message={error} />;

  if (!items) {
    return (
      <div className="space-y-8">
        <div
          className="border-b pb-10"
          style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
        >
          <div className="skeleton h-3 w-20 mb-5" />
          <div className="space-y-3">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-4/5" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
          <div className="mt-4 skeleton h-3 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-b pb-7"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <div className="skeleton h-6 w-3/4" />
            <div className="mt-2 skeleton h-4 w-full" />
            <div className="mt-3 skeleton h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p
        className="border-t pt-6 text-sm"
        style={{
          borderColor: `rgb(var(--t-border) / 0.4)`,
          color: `rgb(var(--t-muted))`,
        }}
      >
        No news available right now.
      </p>
    );
  }

  const [lead, ...rest] = items;

  return (
    <div>
      {/* Lead story */}
      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block border-b pb-10 mb-8"
        style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: `rgb(var(--t-accent))` }}
        >
          Top story
        </span>
        <h2
          className="mt-4 font-serif text-3xl font-bold leading-[1.1] tracking-tight transition sm:text-4xl"
          style={{ color: `rgb(var(--t-text))` }}
        >
          {lead.displayTitle || lead.title}
        </h2>
        {lead.text && (
          <p
            className="mt-4 max-w-2xl text-base leading-relaxed"
            style={{ color: `rgb(var(--t-muted))` }}
          >
            {lead.text.slice(0, 220)}…
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <span
            className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: `rgb(var(--t-border) / 0.6)`,
              color: `rgb(var(--t-dim))`,
            }}
          >
            {lead.site}
          </span>
          <span className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
            {timeAgo(lead.publishedDate)}
          </span>
          <span
            className="ml-auto text-xs font-medium opacity-0 transition group-hover:opacity-100"
            style={{ color: `rgb(var(--t-accent))` }}
          >
            Read →
          </span>
        </div>
      </a>

      {/* Rest */}
      <ul className="space-y-0">
        {rest.map((n, i) => (
          <li
            key={i}
            className="border-b py-7 last:border-0"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
              <h3
                className="font-serif text-xl font-bold leading-snug transition sm:text-2xl"
                style={{ color: `rgb(var(--t-text))` }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = `rgb(var(--t-accent))`)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = `rgb(var(--t-text))`)
                }
              >
                {n.displayTitle || n.title}
              </h3>
              {n.text && (
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: `rgb(var(--t-muted))` }}
                >
                  {n.text.slice(0, 160)}…
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    borderColor: `rgb(var(--t-border) / 0.5)`,
                    color: `rgb(var(--t-dim))`,
                  }}
                >
                  {n.site}
                </span>
                <span className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                  {timeAgo(n.publishedDate)}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
