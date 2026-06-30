import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { MAJOR_POLITICIANS } from "@/lib/politicians";
import { PageTransition } from "@/components/PageTransition";
import { AlertToggleButton } from "./AlertToggleButton";

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subscription } = await supabase
    .from("alert_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSubscribed = !!subscription;

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="mb-10 border-b border-white/[0.05] pb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
              Trade Surveillance
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Politician Alerts
            </h1>
            <p className="mt-3 text-base text-slate-500">
              Get emailed whenever a tracked House or Senate member files a new
              stock trade on a monitored ticker. Alerts run daily via Vercel Cron.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Covers House and Senate disclosures only (STOCK Act). The President
              and Cabinet officials file under a separate system not included in
              this data source.
            </p>
          </div>

          <section className="mb-12 rounded-2xl border border-white/[0.06] bg-ink-800/40 p-6">
            <div className="mb-5 flex items-center gap-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isSubscribed ? "bg-green-400" : "bg-slate-600"
                }`}
              />
              <span className="text-sm font-medium text-slate-300">
                {isSubscribed
                  ? `Subscribed — alerts go to ${user.email}`
                  : "Not subscribed"}
              </span>
            </div>
            <AlertToggleButton initialSubscribed={isSubscribed} />
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600">
              How it works
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Daily scan",
                  body: "Once a day a cron job fetches recent trades for 25 widely-held tickers from Financial Modeling Prep's congressional disclosure data.",
                },
                {
                  step: "2",
                  title: "Filter & deduplicate",
                  body: "Results are filtered to the 20 tracked politicians below, then checked against a seen-trades log so each trade is only reported once.",
                },
                {
                  step: "3",
                  title: "Email alert",
                  body: "If new trades are found, all subscribers receive a summary email with the politician name, ticker, transaction type, date, and disclosed amount range.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-white/[0.05] bg-ink-800/30 p-4"
                >
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-400">
                    {item.step}
                  </div>
                  <p className="mb-1 text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Tracked politicians ({MAJOR_POLITICIANS.length})
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {MAJOR_POLITICIANS.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-ink-800/30 px-4 py-2.5"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500/60" />
                  <span className="text-sm text-slate-300">{name}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-700">
              This list includes politicians known for high-profile or frequent
              stock trading disclosures. Trades are sourced from Senate and House
              financial disclosure filings via Financial Modeling Prep.
            </p>
          </section>
        </main>
      </PageTransition>
    </div>
  );
}
