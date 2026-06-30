import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { EarningsClient } from "./EarningsClient";

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="mb-10 border-b border-white/[0.05] pb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
              Earnings Intelligence
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              EPS History
            </h1>
            <p className="mt-3 text-base text-slate-500">
              Quarterly EPS estimates vs. actuals, surprise history, and an AI trend summary.
              Enter any ticker to see its earnings track record.
            </p>
          </div>
          <EarningsClient />
        </main>
      </PageTransition>
    </div>
  );
}
