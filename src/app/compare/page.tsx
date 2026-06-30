import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { CompareClient } from "./CompareClient";

export default async function ComparePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="mb-8">
            <div className="label mb-2">Research Tool</div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Compare Companies
            </h1>
            <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              Select 2–4 tickers for a side-by-side comparison of fundamentals, earnings, and disclosed politician trades.
            </p>
          </div>
          <CompareClient />
        </main>
      </PageTransition>
    </div>
  );
}
