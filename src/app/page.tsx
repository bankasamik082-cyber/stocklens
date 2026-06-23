import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/types";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <Navbar email={user?.email} />

      <main className="mx-auto max-w-5xl px-4">
        {/* Hero */}
        <section className="grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-glow-pulse" />
              Research, not advice
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Research any stock.{" "}
              <span className="text-gradient">Every claim cited.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-400">
              Type a ticker, pick what you want in the report, and StockLens
              pulls real financials, news and SEC filings — then writes it up in
              plain English with sources under every section.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:shadow-brand-500/40 hover:from-brand-400 hover:to-brand-500"
              >
                {user ? "Open dashboard" : "Get started — it's free"}
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-ink-600 px-6 py-3 font-medium text-slate-300 transition hover:border-ink-500 hover:bg-ink-800/60 hover:text-white"
              >
                How it works
              </a>
            </div>
            <p className="mt-5 text-xs text-slate-600">
              StockLens never says "buy" or "sell." It's a research tool, not financial advice.
            </p>
          </div>

          {/* Demo card */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-500/10 to-transparent blur-2xl" />
            <div className="relative rounded-2xl border border-white/[0.08] bg-ink-800/70 p-6 shadow-card backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Research Report</div>
                  <span className="font-mono text-2xl font-bold tracking-wider text-white">NVDA</span>
                </div>
                <Badge tone="good">Score 8/10</Badge>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Strong fundamentals with exceptional margin expansion. Revenue growth driven by AI infrastructure demand, though elevated valuation prices in continued dominance.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Revenue", val: "$60.9B", trend: "+122%" },
                  { label: "Margin", val: "55.0%", trend: "+18pp" },
                  { label: "Cash Flow", val: "$26.9B", trend: "↑" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/[0.06] bg-ink-900/60 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-600">{s.label}</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-white">{s.val}</div>
                    <div className="mt-0.5 text-[10px] text-emerald-400">{s.trend}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-white/[0.06] pt-3 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Sources</span>
                <span className="text-[10px] text-brand-400">FMP · SEC EDGAR 10-K · Market News</span>
              </div>
            </div>
          </div>
        </section>

        {/* Report sections */}
        <section id="how" className="border-t border-white/[0.05] py-16">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Pick what goes in your report
            </h2>
            <p className="mt-2 text-slate-500">
              Seven sections. Choose all of them or just the ones you care about.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECTION_ORDER.map((id, i) => (
              <div
                key={id}
                className="group rounded-2xl border border-white/[0.06] bg-ink-800/40 p-5 transition hover:border-brand-500/25 hover:bg-ink-800/60"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 font-mono text-xs font-bold text-brand-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{SECTION_LABELS[id]}</p>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      {DESCRIPTIONS[id]}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="border-t border-white/[0.05] py-16">
          <h2 className="mb-10 text-3xl font-bold tracking-tight text-white">Three steps</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={i} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute top-4 left-full w-full h-px bg-gradient-to-r from-brand-500/30 to-transparent hidden sm:block" />
                )}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 font-mono text-sm font-bold text-brand-300">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-t border-white/[0.05] py-12">
          <div className="flex flex-wrap items-center justify-center gap-8 text-center text-xs text-slate-600">
            {["Powered by SEC EDGAR", "Financial Modeling Prep", "OpenAI", "Supabase"].map((s) => (
              <span key={s} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-ink-600" />
                {s}
              </span>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-slate-700">
          StockLens is for research and education only. Nothing here is financial advice.
        </footer>
      </main>
    </div>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  companyOverview: "What it does, sector, industry and market cap.",
  financialHealth: "Revenue, income, margin, debt, cash flow and a 1–10 score.",
  recentNews: "A handful of recent headlines with links.",
  politicianTrading: "Disclosed Senate/House trades, when available.",
  bullCase: "Three plain reasons it could do well.",
  bearCase: "Three plain risks to weigh.",
  finalVerdict: "A short summary with a Low/Medium/High confidence level.",
};

const STEPS = [
  {
    title: "Enter a ticker",
    body: "AAPL, NVDA, TSLA — anything on the major exchanges.",
  },
  {
    title: "Pick your sections",
    body: "Toggle the parts you want. We only fetch what you ask for.",
  },
  {
    title: "Read with sources",
    body: "Every section links out to the data it was built from.",
  },
];
