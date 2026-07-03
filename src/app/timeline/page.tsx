import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { TimelineClient } from "./TimelineClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investment Timeline | StockLens",
};

export default async function TimelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="mb-8">
            <div className="label mb-2">Research Tool</div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{
                color: `rgb(var(--t-text))`,
                fontFamily: `var(--font-display), var(--font-sans), sans-serif`,
              }}
            >
              Investment Timeline
            </h1>
            <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              A year of price history with earnings releases, major news, and
              disclosed politician trades overlaid as event markers.
            </p>
          </div>
          <TimelineClient />
        </main>
      </PageTransition>
    </div>
  );
}
