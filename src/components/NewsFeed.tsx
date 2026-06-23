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
        {/* Lead story skeleton */}
        <div className="border-b border-white/[0.05] pb-10">
          <div className="h-3 w-20 animate-pulse rounded-full bg-ink-700/60 mb-5" />
          <div className="space-y-3">
            <div className="h-8 w-full animate-pulse rounded-lg bg-ink-700/60" />
            <div className="h-8 w-4/5 animate-pulse rounded-lg bg-ink-700/60" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-ink-700/40" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-ink-700/40" />
          </div>
          <div className="mt-4 h-3 w-32 animate-pulse rounded bg-ink-700/30" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-white/[0.05] pb-7">
            <div className="h-6 w-3/4 animate-pulse rounded-lg bg-ink-700/60" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-ink-700/40" />
            <div className="mt-3 h-3 w-28 animate-pulse rounded bg-ink-700/30" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="border-t border-white/[0.05] pt-6 text-sm text-slate-500">
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
        className="group block border-b border-white/[0.05] pb-10 mb-8"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-400">
          Top story
        </span>
        <h2 className="mt-4 font-serif text-3xl font-bold leading-[1.1] tracking-tight text-white transition group-hover:text-brand-200 sm:text-4xl">
          {lead.displayTitle || lead.title}
        </h2>
        {lead.text && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
            {lead.text.slice(0, 220)}…
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full border border-white/[0.06] bg-ink-800/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {lead.site}
          </span>
          <span className="text-xs text-slate-700">{timeAgo(lead.publishedDate)}</span>
          <span className="ml-auto text-xs font-medium text-brand-400 opacity-0 transition group-hover:opacity-100">
            Read →
          </span>
        </div>
      </a>

      {/* Rest of stories */}
      <ul className="space-y-0">
        {rest.map((n, i) => (
          <li key={i} className="border-b border-white/[0.05] py-7 last:border-0">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
              <h3 className="font-serif text-xl font-bold leading-snug text-white transition group-hover:text-brand-200 sm:text-2xl">
                {n.displayTitle || n.title}
              </h3>
              {n.text && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {n.text.slice(0, 160)}…
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full border border-white/[0.05] bg-ink-800/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {n.site}
                </span>
                <span className="text-xs text-slate-700">{timeAgo(n.publishedDate)}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
