export function LoadingState({ ticker }: { ticker: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="relative">
        <div
          className="h-12 w-12 rounded-full border-2 animate-spin"
          style={{
            borderColor: `rgb(var(--t-border))`,
            borderTopColor: `rgb(var(--t-accent))`,
          }}
        />
        <div
          className="absolute inset-1 rounded-full border animate-ping"
          style={{
            borderColor: `rgb(var(--t-accent) / 0.2)`,
            animationDuration: "2s",
          }}
        />
      </div>
      <div>
        <p className="text-lg font-semibold" style={{ color: `rgb(var(--t-text))` }}>
          Building your{" "}
          <span className="font-mono" style={{ color: `rgb(var(--t-accent))` }}>
            {ticker}
          </span>{" "}
          report
        </p>
        <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
          Pulling financials, news, and filings — this takes about 30 seconds.
        </p>
      </div>
      <div className="flex gap-2 mt-2 flex-wrap justify-center">
        {["Financials", "News", "SEC filings", "Writing"].map((step, i) => (
          <span
            key={step}
            className="rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: `rgb(var(--t-border))`,
              color: `rgb(var(--t-muted))`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
