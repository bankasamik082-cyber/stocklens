import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { ExplainClient } from "./ExplainClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Price Move Explainer | StockLens",
};

export default async function ExplainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 border-b border-t-border/50 pb-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-t-accent">
            Research Tool
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-t-text sm:text-5xl">
            Price Move Explainer
          </h1>
          <p className="mt-3 text-base text-t-muted">
            Load a year of price history for any ticker, then click any date on
            the chart to see what news and disclosed trades coincided with that
            move.
          </p>
        </div>

        <Suspense fallback={null}>
          <ExplainClient />
        </Suspense>
      </main>
    </div>
  );
}
