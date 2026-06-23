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
      <p className="mt-4 border-t border-white/[0.05] pt-3 text-xs text-slate-700">
        Sources: none available for this section.
      </p>
    );
  }
  return (
    <div className="mt-5 border-t border-white/[0.05] pt-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-700">
        Sources
      </p>
      <ul className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-ink-900/60 px-3 py-1 text-xs text-brand-400 transition hover:border-brand-500/30 hover:text-brand-300"
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
    <div className="rounded-xl border border-white/[0.06] bg-ink-900/60 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
      <div className="mt-1.5 font-mono text-base font-semibold text-white">{value}</div>
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
      {shown.map((id) => (
        <section
          key={id}
          className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-800/40 backdrop-blur-sm"
        >
          {/* Section header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {SECTION_LABELS[id]}
            </h3>
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
          <p className="text-sm leading-relaxed text-slate-300">
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
          <p className="text-sm leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-300">Why this score: </span>
            {f.scoreRationale}
          </p>
        </div>
      );
    }
    case "recentNews": {
      const items = report.recentNews?.items ?? [];
      if (items.length === 0)
        return <p className="text-sm text-slate-500">No recent news found for this ticker.</p>;
      return (
        <ul className="space-y-4">
          {items.map((n, i) => (
            <li key={i} className="border-b border-white/[0.05] pb-4 last:border-0 last:pb-0">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-white hover:text-brand-300 transition"
              >
                {n.title}
              </a>
              <p className="mt-1 text-xs text-slate-600">{n.date}</p>
              {n.summary && (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{n.summary}…</p>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "politicianTrading": {
      const p = report.politicianTrading;
      if (!p) return <Empty />;
      if (!p.hasData) return <p className="text-sm text-slate-500">{p.note}</p>;
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-widest text-slate-700">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Party</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3">Amount</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {p.trades.map((t, i) => (
                <tr key={i} className="border-t border-white/[0.04]">
                  <td className="py-2.5 pr-4 text-sm">{t.name}</td>
                  <td className="py-2.5 pr-4 text-sm text-slate-500">{t.party}</td>
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
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{t.date}</td>
                  <td className="py-2.5 font-mono text-xs text-slate-400">{t.amountRange}</td>
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
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] text-emerald-400 font-bold">
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
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-[10px] text-rose-400 font-bold">
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
          <p className="text-sm leading-relaxed text-slate-300">{v.summary}</p>
          <p className="text-xs text-slate-700">
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
  return <p className="text-sm text-slate-600">Data is limited for this section.</p>;
}
