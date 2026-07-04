import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { SearchForm } from "@/components/SearchForm";
import { PageTransition } from "@/components/PageTransition";
import { IntelligenceHub } from "@/components/IntelligenceHub";
import { Greeting } from "@/components/Greeting";
import { TickerTape } from "@/components/TickerTape";

export const metadata: Metadata = {
  title: "Dashboard | StockLens",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: recent }, { data: savedStocks }, profileResult] = await Promise.all([
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
    supabase
      .from("user_profiles")
      .select("first_name, investor_type")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const initialWatchlist = (savedStocks ?? []).map((r) => r.ticker);

  // Prefer the profile first name; fall back to a cleaned-up email prefix.
  // (profileResult.error covers the un-migrated user_profiles table too.)
  const profileFirstName =
    !profileResult.error && profileResult.data?.first_name
      ? profileResult.data.first_name
      : null;
  // Fallback: extract only the alphabetic segment before the first dot, digit, or @
  // so "banka.samik082@gmail.com" → "Banka" rather than "Banka.samik082"
  const emailPrefix = user.email?.split("@")[0] ?? "there";
  const cleanedEmailPrefix = emailPrefix.match(/^[a-zA-Z]+/)?.[0] ?? "there";
  const rawName = profileFirstName ?? cleanedEmailPrefix;
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const investorType =
    (!profileResult.error && profileResult.data?.investor_type) || null;

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      {initialWatchlist.length > 0 && <TickerTape />}
      <PageTransition>
        <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">

          {/* Greeting */}
          <div className="mb-8">
            <Greeting name={firstName} />
            {investorType && (
              <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                <span style={{ color: `rgb(var(--t-accent))` }}>◆</span>
                Research tailored for {investorType}s
              </p>
            )}
          </div>

          {/* Intelligence hub: watchlist strip + market/earnings/political cards */}
          <div className="mb-8">
            <IntelligenceHub hasWatchlist={initialWatchlist.length > 0} />
          </div>

          {/* Two-panel layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_296px]">

            {/* Left — Research terminal */}
            <div className="surface p-6">
              <div className="mb-1 flex items-center gap-2">
                <span style={{ color: `rgb(var(--t-accent))` }}>▮</span>
                <span className="label">Research Terminal</span>
              </div>
              <p className="mb-5 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
                Generate Research Report — every claim cited to its source.
              </p>
              <SearchForm initialWatchlist={initialWatchlist} />

              {/* Data sources footer */}
              <div
                className="mt-6 flex flex-wrap gap-2 border-t pt-4"
                style={{ borderColor: `rgb(var(--t-text) / 0.06)` }}
              >
                {["Finnhub", "Twelve Data", "SEC EDGAR", "Gemini AI", "Senate eFD"].map((s) => (
                  <span
                    key={s}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-medium"
                    style={{
                      borderColor: `rgb(var(--t-text) / 0.08)`,
                      color: `rgb(var(--t-dim))`,
                      backgroundColor: `rgb(var(--t-text) / 0.03)`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — panel */}
            <div className="flex flex-col gap-4">

              {/* Recent reports */}
              <div className="surface p-4">
                <div className="label mb-3">Recent Reports</div>
                <div className="space-y-1.5">
                  {recent && recent.length > 0 ? (
                    recent.map((r) => (
                      <Link key={r.id} href={`/report/${r.id}`}>
                        <div
                          className="hover-row flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors"
                          style={{
                            borderColor: `rgb(var(--t-text) / 0.06)`,
                            backgroundColor: `rgb(var(--t-text) / 0.02)`,
                          }}
                        >
                          <div>
                            <span
                              className="font-mono text-sm font-semibold"
                              style={{ color: `rgb(var(--t-text))` }}
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
                              className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                              style={{
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
                      style={{ borderColor: `rgb(var(--t-text) / 0.06)` }}
                    >
                      <p className="text-lg" style={{ color: `rgb(var(--t-dim))` }}>◇</p>
                      <p className="mt-1 text-sm" style={{ color: `rgb(var(--t-muted))` }}>No reports yet</p>
                      <p className="text-xs mt-1" style={{ color: `rgb(var(--t-dim))` }}>Run your first analysis →</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Watchlist chips */}
              {initialWatchlist.length > 0 && (
                <div className="surface p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="label">Watchlist</span>
                    <Link
                      href="/watchlist"
                      className="hover-accent-text text-[11px] font-semibold"
                      style={{ color: `rgb(var(--t-muted))` }}
                    >
                      View all →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {initialWatchlist.map((ticker) => (
                      <Link
                        key={ticker}
                        href={`/dashboard?ticker=${ticker}`}
                        className="hover-chip rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-colors"
                        style={{
                          borderColor: `rgb(var(--t-text) / 0.1)`,
                          color: `rgb(var(--t-muted))`,
                          backgroundColor: `rgb(var(--t-text) / 0.03)`,
                        }}
                      >
                        {ticker}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="surface p-4">
                <div className="label mb-3">Quick Access</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/earnings",  icon: "◑", label: "Earnings" },
                    { href: "/news",      icon: "⬡", label: "News" },
                    { href: "/watchlist", icon: "★", label: "Watchlist" },
                    { href: "/alerts",    icon: "◎", label: "Alerts" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="hover-quick-link flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors"
                      style={{
                        borderColor: `rgb(var(--t-text) / 0.07)`,
                        color: `rgb(var(--t-muted))`,
                        backgroundColor: `rgb(var(--t-text) / 0.02)`,
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
