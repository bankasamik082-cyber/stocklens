import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { SearchForm } from "@/components/SearchForm";
import { PageTransition } from "@/components/PageTransition";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: recent }, { data: savedStocks }] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, ticker, selected_sections, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("saved_stocks")
      .select("ticker")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const initialWatchlist = (savedStocks ?? []).map((r) => r.ticker);
  const firstName = user.email?.split("@")[0];

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-6xl px-4 py-10">

          {/* Header */}
          <div className="mb-10">
            <p className="label mb-2">Intelligence Hub</p>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{
                fontFamily: "'Clash Display', var(--font-sans), sans-serif",
                color: `rgb(var(--t-text))`,
              }}
            >
              Welcome back,{" "}
              <span
                style={{
                  color: `rgb(var(--t-accent))`,
                  textShadow: `0 0 32px rgb(var(--t-accent) / 0.4)`,
                }}
              >
                {firstName}
              </span>
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              AI research with every claim cited. Enter a ticker to begin.
            </p>
          </div>

          {/* Two-panel layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_296px]">

            {/* Left — Research panel */}
            <div
              className="rounded-3xl border p-6"
              style={{
                borderColor: `rgba(255,255,255,0.08)`,
                backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
                backdropFilter: `var(--card-blur, none)`,
                WebkitBackdropFilter: `var(--card-blur, none)`,
                boxShadow: `var(--card-shadow, none)`,
              }}
            >
              <div className="label mb-5">New Research</div>
              <SearchForm initialWatchlist={initialWatchlist} />

              {/* Data sources footer */}
              <div
                className="mt-6 flex flex-wrap gap-2 border-t pt-4"
                style={{ borderColor: `rgba(255,255,255,0.06)` }}
              >
                {["Finnhub", "Twelve Data", "SEC EDGAR", "Gemini AI", "Senate eFD"].map((s) => (
                  <span
                    key={s}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-medium"
                    style={{
                      borderColor: `rgba(255,255,255,0.08)`,
                      color: `rgb(var(--t-dim))`,
                      backgroundColor: `rgba(255,255,255,0.03)`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — Intelligence panel */}
            <div className="flex flex-col gap-4">

              {/* Recent reports */}
              <div
                className="rounded-3xl border p-4"
                style={{
                  borderColor: `rgba(255,255,255,0.08)`,
                  backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
                  backdropFilter: `var(--card-blur, none)`,
                  WebkitBackdropFilter: `var(--card-blur, none)`,
                  boxShadow: `var(--card-shadow, none)`,
                }}
              >
                <div className="label mb-3">Recent Reports</div>
                <div className="space-y-1.5">
                  {recent && recent.length > 0 ? (
                    recent.map((r) => (
                      <Link key={r.id} href={`/report/${r.id}`}>
                        <div
                          className="hover-row flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors"
                          style={{
                            borderColor: `rgba(255,255,255,0.06)`,
                            backgroundColor: `rgba(255,255,255,0.02)`,
                          }}
                        >
                          <div>
                            <span
                              className="font-mono text-sm font-semibold"
                              style={{
                                color: `rgb(var(--t-text))`,
                                fontFamily: `var(--font-mono), ui-monospace, monospace`,
                              }}
                            >
                              {r.ticker}
                            </span>
                            <p className="text-[10px] mt-0.5" style={{ color: `rgb(var(--t-dim))` }}>
                              {new Date(r.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                fontFamily: `var(--font-mono), ui-monospace, monospace`,
                                backgroundColor: `rgb(var(--t-accent) / 0.1)`,
                                color: `rgb(var(--t-accent))`,
                              }}
                            >
                              {(r.selected_sections as string[]).length}
                            </span>
                            <span className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>→</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div
                      className="rounded-xl border border-dashed p-5 text-center"
                      style={{ borderColor: `rgba(255,255,255,0.06)` }}
                    >
                      <p className="text-sm" style={{ color: `rgb(var(--t-muted))` }}>No reports yet</p>
                      <p className="text-xs mt-1" style={{ color: `rgb(var(--t-dim))` }}>Run your first analysis →</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Watchlist */}
              {initialWatchlist.length > 0 && (
                <div
                  className="rounded-3xl border p-4"
                  style={{
                    borderColor: `rgba(255,255,255,0.08)`,
                    backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
                    backdropFilter: `var(--card-blur, none)`,
                    WebkitBackdropFilter: `var(--card-blur, none)`,
                    boxShadow: `var(--card-shadow, none)`,
                  }}
                >
                  <div className="label mb-3">Watchlist</div>
                  <div className="flex flex-wrap gap-1.5">
                    {initialWatchlist.map((ticker) => (
                      <Link
                        key={ticker}
                        href={`/dashboard?ticker=${ticker}`}
                        className="hover-chip rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-colors"
                        style={{
                          fontFamily: `var(--font-mono), ui-monospace, monospace`,
                          borderColor: `rgba(255,255,255,0.1)`,
                          color: `rgb(var(--t-muted))`,
                          backgroundColor: `rgba(255,255,255,0.03)`,
                        }}
                      >
                        {ticker}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div
                className="rounded-3xl border p-4"
                style={{
                  borderColor: `rgba(255,255,255,0.08)`,
                  backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
                  backdropFilter: `var(--card-blur, none)`,
                  WebkitBackdropFilter: `var(--card-blur, none)`,
                  boxShadow: `var(--card-shadow, none)`,
                }}
              >
                <div className="label mb-3">Quick Access</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/earnings", icon: "◑", label: "Earnings" },
                    { href: "/news",     icon: "⬡", label: "News" },
                    { href: "/alerts",   icon: "◎", label: "Alerts" },
                    { href: "/explain",  icon: "⌁", label: "Explainer" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="hover-quick-link flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors"
                      style={{
                        borderColor: `rgba(255,255,255,0.07)`,
                        color: `rgb(var(--t-muted))`,
                        backgroundColor: `rgba(255,255,255,0.02)`,
                      }}
                    >
                      <span style={{ color: `rgb(var(--t-accent))` }}>{item.icon}</span>
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <p className="mt-8 text-center text-xs" style={{ color: `rgb(var(--t-dim))` }}>
            StockLens is for research and education only. Not financial advice.
          </p>
        </main>
      </PageTransition>
    </div>
  );
}
