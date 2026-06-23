export function LoadingState({ ticker }: { ticker: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-2 border-ink-700 border-t-brand-400 animate-spin" />
        <div className="absolute inset-1 rounded-full border border-brand-500/20 animate-ping" style={{ animationDuration: "2s" }} />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          Building your <span className="font-mono text-brand-400">{ticker}</span> report
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Pulling financials, news, and filings — this takes about 30 seconds.
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        {["Financials", "News", "SEC filings", "Writing"].map((step, i) => (
          <span
            key={step}
            className="rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1 text-xs text-slate-400"
            style={{ animationDelay: `${i * 0.2}s` }}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-700/60 ${className}`} />;
}
