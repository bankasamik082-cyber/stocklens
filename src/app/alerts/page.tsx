import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { MAJOR_POLITICIANS } from "@/lib/politicians";
import { PageTransition } from "@/components/PageTransition";
import { AlertToggleButton } from "./AlertToggleButton";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
          <div
            className="mb-10 border-b pb-8"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <div className="label mb-3">Trade Surveillance</div>
            <h1
              className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Politician Alerts
            </h1>
            <p className="mt-3 text-base" style={{ color: `rgb(var(--t-muted))` }}>
              Get emailed whenever a tracked House or Senate member files a new
              stock trade on a monitored ticker. Alerts run daily via Vercel Cron.
            </p>
            <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-dim))` }}>
              Covers House and Senate disclosures only (STOCK Act). The President
              and Cabinet officials file under a separate system not included in
              this data source.
            </p>
          </div>

          {/* Subscription card */}
          <section
            className="mb-10 rounded-2xl border p-6"
            style={{
              borderColor: `rgb(var(--t-border) / 0.7)`,
              backgroundColor: `rgb(var(--t-surface))`,
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: isSubscribed
                    ? `rgb(var(--t-success))`
                    : `rgb(var(--t-dim))`,
                }}
              />
              <span className="text-sm font-medium" style={{ color: `rgb(var(--t-muted))` }}>
                {isSubscribed
                  ? `Subscribed — alerts go to ${user.email}`
                  : "Not subscribed"}
              </span>
            </div>
            <AlertToggleButton initialSubscribed={isSubscribed} />
          </section>

          {/* How it works */}
          <section className="mb-10">
            <div className="label mb-4">How it works</div>
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
                  body: "Results are filtered to the tracked politicians below, then checked against a seen-trades log so each trade is only reported once.",
                },
                {
                  step: "3",
                  title: "Email alert",
                  body: "If new trades are found, all subscribers receive a summary email with the politician name, ticker, transaction type, date, and disclosed amount range.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: `rgb(var(--t-border) / 0.6)`,
                    backgroundColor: `rgb(var(--t-card))`,
                  }}
                >
                  <div
                    className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold font-mono"
                    style={{
                      backgroundColor: `rgb(var(--t-accent) / 0.1)`,
                      color: `rgb(var(--t-accent))`,
                    }}
                  >
                    {item.step}
                  </div>
                  <p className="mb-1 text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: `rgb(var(--t-muted))` }}>
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Politicians list */}
          <section>
            <div className="label mb-4">
              Tracked politicians ({MAJOR_POLITICIANS.length})
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MAJOR_POLITICIANS.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-lg border px-4 py-2.5"
                  style={{
                    borderColor: `rgb(var(--t-border) / 0.5)`,
                    backgroundColor: `rgb(var(--t-card))`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: `rgb(var(--t-accent) / 0.5)` }}
                  />
                  <span className="text-sm" style={{ color: `rgb(var(--t-muted))` }}>
                    {name}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
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
