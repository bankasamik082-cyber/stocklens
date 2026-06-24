import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { ExplainClient } from "./ExplainClient";

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
        <div className="mb-10 border-b border-white/[0.05] pb-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Research Tool
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Price Move Explainer
          </h1>
          <p className="mt-3 text-base text-slate-500">
            Load a year of price history for any ticker, then click any date on
            the chart to see what news and disclosed trades coincided with that
            move.
          </p>
        </div>

        <ExplainClient />
      </main>
    </div>
  );
}
