import { Badge, scoreTone, confidenceTone } from "@/components/Badge";
import {
  GeneratedReport,
  SECTION_LABELS,
  SECTION_ORDER,
  SectionId,
  Source,
  SourcesBySection,
} from "@/lib/types";

function Sources({ sources }: { sources?: Source[] }) {
  if (!sources || sources.length === 0) {
    return (
      <p
        className="mt-4 border-t pt-3 text-xs"
        style={{
          borderColor: `rgb(var(--t-border) / 0.4)`,
          color: `rgb(var(--t-dim))`,
        }}
      >
        Sources: none available for this section.
      </p>
    );
  }
  return (
    <div
      className="mt-5 border-t pt-4"
      style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
    >
      <p
        className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: `rgb(var(--t-dim))` }}
      >
        Sources
      </p>
      <ul className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-pill"
            >
              <span className="text-[10px]">↗</span>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: `rgb(var(--t-border) / 0.6)`,
        backgroundColor: `rgb(var(--t-card))`,
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: `rgb(var(--t-dim))` }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 font-mono text-base font-semibold"
        style={{ color: `rgb(var(--t-text))` }}
      >
        {value}
      </div>
    </div>
  );
}

export function ReportView({
  report,
  sources,
  selected,
}: {
  report: GeneratedReport;
  sources: SourcesBySection;
  selected: SectionId[];
}) {
  const shown = SECTION_ORDER.filter((id) => selected.includes(id));

  return (
    <div className="space-y-4">
      {shown.map((id, idx) => (
        <section
          key={id}
          className="overflow-hidden rounded-2xl border backdrop-blur-sm"
          style={{
            borderColor: `rgb(var(--t-border) / 0.7)`,
            backgroundColor: `rgb(var(--t-surface))`,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: `rgb(var(--t-border) / 0.5)` }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-bold"
                style={{
                  backgroundColor: `rgb(var(--t-accent) / 0.1)`,
                  color: `rgb(var(--t-accent))`,
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: `rgb(var(--t-muted))` }}
              >
                {SECTION_LABELS[id]}
              </h3>
            </div>
            {sectionBadge(id, report)}
          </div>
          <div className="px-5 py-5">
            {renderSection(id, report)}
            <Sources sources={sources[id]} />
          </div>
        </section>
      ))}
    </div>
  );
}

function sectionBadge(id: SectionId, report: GeneratedReport) {
  if (id === "financialHealth" && report.financialHealth) {
    const s = report.financialHealth.score;
    return <Badge tone={scoreTone(s)}>Score {s}/10</Badge>;
  }
  if (id === "finalVerdict" && report.finalVerdict) {
    const c = report.finalVerdict.confidence;
    return <Badge tone={confidenceTone(c)}>Confidence: {c}</Badge>;
  }
  if (id === "bullCase") return <Badge tone="good">Upside</Badge>;
  if (id === "bearCase") return <Badge tone="bad">Risks</Badge>;
  return undefined;
}

function renderSection(id: SectionId, report: GeneratedReport) {
  switch (id) {
    case "companyOverview": {
      const o = report.companyOverview;
      if (!o) return <Empty />;
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: `rgb(var(--t-muted))` }}>
            {o.whatItDoes || "Data is limited."}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Sector" value={o.sector} />
            <Stat label="Industry" value={o.industry} />
            <Stat label="Market cap" value={o.marketCap} />
          </div>
        </div>
      );
    }
    case "financialHealth": {
      const f = report.financialHealth;
      if (!f) return <Empty />;
      return (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Revenue" value={f.revenue} />
            <Stat label="Net income" value={f.netIncome} />
            <Stat label="Profit margin" value={f.profitMargin} />
            <Stat label="Debt" value={f.debt} />
            <Stat label="Operating cash flow" value={f.cashFlow} />
          </div>
          <p className="text-sm leading-relaxed" style={{ color: `rgb(var(--t-muted))` }}>
            <span className="font-semibold" style={{ color: `rgb(var(--t-text))` }}>
              Why this score:{" "}
            </span>
            {f.scoreRationale}
          </p>
        </div>
      );
    }
    case "recentNews": {
      const items = report.recentNews?.items ?? [];
      if (items.length === 0)
        return (
          <p className="text-sm" style={{ color: `rgb(var(--t-muted))` }}>
            No recent news found for this ticker.
          </p>
        );
      return (
        <ul className="space-y-4">
          {items.map((n, i) => (
            <li
              key={i}
              className="border-b pb-4 last:border-0 last:pb-0"
              style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
            >
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold transition"
                style={{ color: `rgb(var(--t-text))` }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color = `rgb(var(--t-accent))`)
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = `rgb(var(--t-text))`)
                }
              >
                {n.title}
              </a>
              <p className="mt-1 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                {n.date}
              </p>
              {n.summary && (
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: `rgb(var(--t-muted))` }}
                >
                  {n.summary}…
                </p>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "politicianTrading": {
      const p = report.politicianTrading;
      if (!p) return <Empty />;
      if (!p.hasData)
        return (
          <p className="text-sm" style={{ color: `rgb(var(--t-muted))` }}>
            {p.note}
          </p>
        );
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: `rgb(var(--t-dim))` }}
              >
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Party</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3">Amount</th>
              </tr>
            </thead>
            <tbody style={{ color: `rgb(var(--t-muted))` }}>
              {p.trades.map((t, i) => (
                <tr
                  key={i}
                  className="border-t"
                  style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
                >
                  <td className="py-2.5 pr-4 text-sm">{t.name}</td>
                  <td
                    className="py-2.5 pr-4 text-sm"
                    style={{ color: `rgb(var(--t-dim))` }}
                  >
                    {t.party}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge
                      tone={
                        /purchase|buy/i.test(t.transactionType)
                          ? "good"
                          : /sale|sell/i.test(t.transactionType)
                          ? "warn"
                          : "neutral"
                      }
                    >
                      {t.transactionType}
                    </Badge>
                  </td>
                  <td
                    className="py-2.5 pr-4 font-mono text-xs"
                    style={{ color: `rgb(var(--t-dim))` }}
                  >
                    {t.date}
                  </td>
                  <td
                    className="py-2.5 font-mono text-xs"
                    style={{ color: `rgb(var(--t-muted))` }}
                  >
                    {t.amountRange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "bullCase": {
      const reasons = report.bullCase?.reasons ?? [];
      if (reasons.length === 0) return <Empty />;
      return (
        <ul className="space-y-3">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold text-[10px]"
                style={{
                  backgroundColor: `rgb(var(--t-success) / 0.12)`,
                  color: `rgb(var(--t-success))`,
                }}
              >
                ↑
              </span>
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "bearCase": {
      const risks = report.bearCase?.risks ?? [];
      if (risks.length === 0) return <Empty />;
      return (
        <ul className="space-y-3">
          {risks.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold text-[10px]"
                style={{
                  backgroundColor: `rgb(var(--t-danger) / 0.12)`,
                  color: `rgb(var(--t-danger))`,
                }}
              >
                ↓
              </span>
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "finalVerdict": {
      const v = report.finalVerdict;
      if (!v) return <Empty />;
      return (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: `rgb(var(--t-muted))` }}>
            {v.summary}
          </p>
          <p className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
            This is a research summary, not financial advice.
          </p>
        </div>
      );
    }
    default:
      return <Empty />;
  }
}

function Empty() {
  return (
    <p className="text-sm" style={{ color: `rgb(var(--t-dim))` }}>
      Data is limited for this section.
    </p>
  );
}
