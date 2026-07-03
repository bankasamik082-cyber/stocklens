import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { WatchlistClient } from "./WatchlistClient";

export const metadata: Metadata = {
  title: "Watchlist | StockLens",
};

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: savedStocks } = await supabase
    .from("saved_stocks")
    .select("ticker")
    .eq("user_id", user.id)
    .limit(1);

  const hasItems = (savedStocks ?? []).length > 0;

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="mb-8">
            <div className="label mb-2">Tracking</div>
            <h1
              className="font-display text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Watchlist
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              Live prices, upcoming earnings, and the latest headline for every
              stock you follow.
            </p>
          </div>
          <WatchlistClient hasItems={hasItems} />
        </main>
      </PageTransition>
    </div>
  );
}
