"use client";

import { useState } from "react";

export function AlertToggleButton({
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
      const res = await fetch(
        subscribed ? "/api/alerts/unsubscribe" : "/api/alerts/subscribe",
        { method: subscribed ? "DELETE" : "POST" }
      );
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
            ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600"
        }`}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {subscribed ? "Unsubscribing…" : "Subscribing…"}
          </>
        ) : subscribed ? (
          "Unsubscribe from alerts"
        ) : (
          "Subscribe to alerts"
        )}
      </button>
      {subscribed && !loading && (
        <p className="text-xs text-slate-500">
          You&apos;ll receive an email whenever a tracked politician makes a new
          trade on a monitored ticker.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
