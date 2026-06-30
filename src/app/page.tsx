import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <Navbar email={user?.email} />
      <PageTransition>
        <main className="mx-auto max-w-5xl px-4">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <section className="relative py-24 md:py-32">
            {/* Background glow */}
            <div
              className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-96 rounded-full blur-3xl opacity-20"
              style={{ backgroundColor: `rgb(var(--t-accent))` }}
            />

            <div className="relative max-w-3xl">
              <div
                className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
                style={{
                  borderColor: `rgb(var(--t-accent) / 0.25)`,
                  backgroundColor: `rgb(var(--t-accent) / 0.08)`,
                  color: `rgb(var(--t-accent))`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-glow-pulse"
                  style={{ backgroundColor: `rgb(var(--t-accent))` }}
                />
                Research, not advice
              </div>

              <h1
                className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
                style={{ color: `rgb(var(--t-text))` }}
              >
                Research any stock.{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.6), rgb(var(--t-accent)))`,
                    backgroundSize: "200% auto",
                    animation: "gradient-x 4s ease infinite",
                  }}
                >
                  Every claim cited.
                </span>
              </h1>

              <p
                className="mt-6 max-w-xl text-lg leading-relaxed"
                style={{ color: `rgb(var(--t-muted))` }}
              >
                Institutional-grade AI research. Real financials from Finnhub and
                SEC EDGAR, earnings intelligence, political trading signals, and
                AI analysis — all in plain English, all cited.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href={user ? "/dashboard" : "/login"}
                  className="group inline-flex items-center gap-2 btn-accent text-sm px-6 py-3"
                >
                  {user ? "Open dashboard" : "Get started — it's free"}
                  <span className="transition group-hover:translate-x-0.5">→</span>
                </Link>
                <Link
                  href="/earnings"
                  className="btn-ghost text-sm px-6 py-3"
                >
                  Earnings Intelligence
                </Link>
              </div>

              <p
                className="mt-5 text-xs"
                style={{ color: `rgb(var(--t-dim))` }}
              >
                StockLens never says "buy" or "sell." Research tool, not financial advice.
              </p>
            </div>
          </section>

          {/* ── Feature grid ──────────────────────────────────────────────── */}
          <section
            className="border-t py-20"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <div className="mb-12">
              <h2
                className="text-3xl font-bold tracking-tight"
                style={{ color: `rgb(var(--t-text))` }}
              >
                Everything serious investors need
              </h2>
              <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
                One platform. Seven research modules. All cited.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="hover-card rounded-2xl border p-5"
                  style={{
                    borderColor: `rgb(var(--t-border) / 0.7)`,
                    backgroundColor: `rgb(var(--t-surface))`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold font-mono"
                      style={{
                        backgroundColor: `rgb(var(--t-accent) / 0.1)`,
                        color: `rgb(var(--t-accent))`,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: `rgb(var(--t-text))` }}
                      >
                        {f.title}
                      </p>
                      <p
                        className="mt-1 text-xs leading-relaxed"
                        style={{ color: `rgb(var(--t-muted))` }}
                      >
                        {f.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── How it works ──────────────────────────────────────────────── */}
          <section
            className="border-t py-20"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <h2
              className="mb-12 text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Three steps
            </h2>
            <div className="grid gap-10 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={i} className="relative">
                  {i < STEPS.length - 1 && (
                    <div
                      className="absolute top-5 left-full w-full h-px hidden sm:block"
                      style={{ background: `linear-gradient(to right, rgb(var(--t-accent) / 0.3), transparent)` }}
                    />
                  )}
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl border font-mono text-sm font-bold"
                    style={{
                      borderColor: `rgb(var(--t-accent) / 0.3)`,
                      backgroundColor: `rgb(var(--t-accent) / 0.08)`,
                      color: `rgb(var(--t-accent))`,
                    }}
                  >
                    {i + 1}
                  </div>
                  <h3
                    className="mt-4 text-base font-semibold"
                    style={{ color: `rgb(var(--t-text))` }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: `rgb(var(--t-muted))` }}
                  >
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Trust bar ─────────────────────────────────────────────────── */}
          <section
            className="border-t py-12"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <div className="flex flex-wrap items-center justify-center gap-8 text-center text-xs">
              {["SEC EDGAR", "Finnhub", "Twelve Data", "Gemini AI", "Supabase", "Vercel"].map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-2"
                  style={{ color: `rgb(var(--t-dim))` }}
                >
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: `rgb(var(--t-border))` }}
                  />
                  {s}
                </span>
              ))}
            </div>
          </section>

          <footer
            className="border-t py-8 text-center text-xs"
            style={{
              borderColor: `rgb(var(--t-border) / 0.4)`,
              color: `rgb(var(--t-dim))`,
            }}
          >
            StockLens is for research and education only. Nothing here is financial advice.
          </footer>
        </main>
      </PageTransition>
    </div>
  );
}

const FEATURES = [
  { title: "Company Overview", body: "What the company does, sector, industry, market cap — from Finnhub." },
  { title: "Financial Health", body: "Revenue, net income, profit margin, debt, and operating cash flow — rated 1–10." },
  { title: "Earnings Intelligence", body: "EPS beats/misses, surprise %, trend charts, AI summary." },
  { title: "Recent News", body: "Curated headlines from Finnhub filtered to your ticker." },
  { title: "Politician Trading", body: "Disclosed Senate and House trades via STOCK Act filings." },
  { title: "Bull & Bear Case", body: "AI-generated upside and risk factors based on real data." },
  { title: "Final Verdict", body: "Plain-English summary with Low/Medium/High confidence level." },
];

const STEPS = [
  { title: "Enter a ticker", body: "AAPL, NVDA, TSLA — anything on major exchanges. Use ⌘K to search by company name." },
  { title: "Pick your sections", body: "Toggle the parts you want. We only fetch what you ask for, keeping it fast." },
  { title: "Read with sources", body: "Every number, claim, and section links out to the exact data source." },
];
