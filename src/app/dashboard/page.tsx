import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { SearchForm } from "@/components/SearchForm";
import { PageTransition } from "@/components/PageTransition";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: recent }, { data: savedStocks }] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, ticker, selected_sections, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("saved_stocks")
      .select("ticker")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const initialWatchlist = (savedStocks ?? []).map((r) => r.ticker);
  const firstName = user.email?.split("@")[0];

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="mb-10">
            <p className="text-sm text-slate-500 mb-1">
              Welcome back, <span className="text-slate-400">{firstName}</span>
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">New analysis</h1>
            <p className="mt-1.5 text-slate-500">
              Enter a ticker and choose what to include — every section cites its sources.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <div>
              <SearchForm initialWatchlist={initialWatchlist} />
            </div>

            <aside>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600">
                Recent reports
              </h2>
              <div className="space-y-2">
                {recent && recent.length > 0 ? (
                  recent.map((r) => (
                    <Link key={r.id} href={`/report/${r.id}`}>
                      <div className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-800/40 px-4 py-3 transition hover:border-brand-500/25 hover:bg-ink-800/60">
                        <div>
                          <span className="font-mono text-sm font-semibold text-white">
                            {r.ticker}
                          </span>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {new Date(r.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">
                            {(r.selected_sections as string[]).length}
                          </Badge>
                          <span className="text-slate-700 transition group-hover:text-slate-500 text-xs">→</span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-ink-600 p-6 text-center">
                    <p className="text-sm text-slate-600">No reports yet.</p>
                    <p className="mt-1 text-xs text-slate-700">
                      Run your first analysis to see it here.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.04] bg-ink-800/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Data sources
                </p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div>Finnhub — Financials & profile</div>
                  <div>Twelve Data — Price history</div>
                  <div>SEC EDGAR — Filings</div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
