import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Connected Apps | StockLens",
};

interface Integration {
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  note?: string;
  viewHref?: string;
}

const CONNECTED: Integration[] = [
  {
    name: "U.S. Senate eFD",
    icon: "🏛",
    description: "Congressional trade disclosures",
    connected: true,
    viewHref: "/alerts",
  },
  {
    name: "Finnhub",
    icon: "📈",
    description: "Financial data & news",
    connected: true,
    viewHref: "/dashboard",
  },
  {
    name: "Twelve Data",
    icon: "📉",
    description: "Price history & charts",
    connected: true,
    viewHref: "/timeline",
  },
  {
    name: "SEC EDGAR",
    icon: "🗂",
    description: "Company filings",
    connected: true,
    viewHref: "/dashboard",
  },
];

const COMING_SOON: Integration[] = [
  {
    name: "Robinhood",
    icon: "🪶",
    description: "Import your portfolio",
    connected: false,
    note: "Robinhood doesn't offer a public API. Use CSV import on the Portfolio page instead.",
  },
  {
    name: "Schwab",
    icon: "🏦",
    description: "Connect your brokerage",
    connected: false,
  },
  {
    name: "Plaid",
    icon: "🔗",
    description: "Connect 10,000+ banks & brokers",
    connected: false,
  },
  {
    name: "Bloomberg",
    icon: "🖥",
    description: "Professional data feed",
    connected: false,
  },
  {
    name: "Seeking Alpha",
    icon: "🔍",
    description: "Premium research",
    connected: false,
  },
];

function IntegrationCard({ item }: { item: Integration }) {
  return (
    <div
      className={`card p-5 ${item.connected ? "hover-card" : ""}`}
      style={item.connected ? undefined : { opacity: 0.55 }}
      aria-disabled={!item.connected}
      data-testid={`integration-${item.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl"
          style={{
            borderColor: `rgb(var(--t-text) / 0.08)`,
            backgroundColor: `rgb(var(--t-text) / 0.03)`,
          }}
          aria-hidden
        >
          {item.icon}
        </span>
        {item.connected ? (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: `rgb(var(--t-success) / 0.12)`,
              color: `rgb(var(--t-success))`,
            }}
          >
            Connected ✓
          </span>
        ) : (
          <span
            className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{
              borderColor: `rgb(var(--t-text) / 0.12)`,
              color: `rgb(var(--t-dim))`,
            }}
          >
            Coming Soon
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-semibold" style={{ color: `rgb(var(--t-text))` }}>
        {item.name}
      </p>
      <p className="mt-0.5 text-xs" style={{ color: `rgb(var(--t-muted))` }}>
        {item.description}
      </p>
      {item.note && (
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: `rgb(var(--t-dim))` }}>
          {item.note}
        </p>
      )}
      {item.connected && item.viewHref && (
        <Link
          href={item.viewHref}
          className="hover-accent-text mt-3 inline-block text-[11px] font-semibold"
          style={{ color: `rgb(var(--t-accent))` }}
        >
          View data →
        </Link>
      )}
    </div>
  );
}

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="mb-8">
            <div className="label mb-2">Ecosystem</div>
            <h1
              className="font-display text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Connected Apps
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              The data sources powering StockLens today, and the broker
              connections on the roadmap.
            </p>
          </div>

          <div className="label mb-4">Available Now</div>
          <div className="mb-10 grid gap-4 sm:grid-cols-2">
            {CONNECTED.map((i) => (
              <IntegrationCard key={i.name} item={i} />
            ))}
          </div>

          <div className="label mb-4">Coming Soon</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMING_SOON.map((i) => (
              <IntegrationCard key={i.name} item={i} />
            ))}
          </div>

          <p className="mt-8 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
            Want a portfolio import today? Every major broker exports a holdings
            CSV — use{" "}
            <Link href="/portfolio" className="underline" style={{ color: `rgb(var(--t-accent))` }}>
              CSV import on the Portfolio page
            </Link>
            .
          </p>
        </main>
      </PageTransition>
    </div>
  );
}
