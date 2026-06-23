import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { NewsFeed } from "@/components/NewsFeed";

export default async function MarketNewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 border-b border-white/[0.05] pb-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Market Intelligence
          </p>
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Market News
          </h1>
          <p className="mt-3 text-base text-slate-500">
            Top general market headlines, refreshed each time you visit.
          </p>
        </div>

        <NewsFeed />
      </main>
    </div>
  );
}
