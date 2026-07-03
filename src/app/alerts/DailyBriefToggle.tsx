"use client";

import { useState } from "react";

export function DailyBriefToggle({
  initialSubscribed,
}: {
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/daily-brief", {
        method: subscribed ? "DELETE" : "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setSubscribed(!subscribed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        onClick={toggle}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition disabled:opacity-50 ${
          subscribed
            ? "border border-t-danger/30 bg-t-danger/10 text-t-danger hover:bg-t-danger/20"
            : "btn-accent"
        }`}
        data-testid="daily-brief-toggle"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {subscribed ? "Unsubscribing…" : "Subscribing…"}
          </>
        ) : subscribed ? (
          "Unsubscribe from Daily Brief"
        ) : (
          "Subscribe to Daily Brief"
        )}
      </button>
      {subscribed && !loading && (
        <p className="text-xs text-t-muted">
          Every morning at 8:00 UTC you&apos;ll get one email covering your
          watchlist: latest headlines, earnings within 7 days, and recent
          Senate trades.
        </p>
      )}
      {error && <p className="text-xs text-t-danger">{error}</p>}
    </div>
  );
}
