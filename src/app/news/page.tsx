import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { NewsFeed } from "@/components/NewsFeed";
import { PageTransition } from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market News | StockLens",
};

export default async function MarketNewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div
            className="mb-10 border-b pb-8"
            style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
          >
            <div className="label mb-3">Market Intelligence</div>
            <h1
              className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Market News
            </h1>
            <p className="mt-3 text-base" style={{ color: `rgb(var(--t-muted))` }}>
              Top general market headlines, refreshed each time you visit.
            </p>
          </div>
          <NewsFeed />
        </main>
      </PageTransition>
    </div>
  );
}
