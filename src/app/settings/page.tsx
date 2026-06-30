import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="mb-10">
            <div className="label mb-2">Configuration</div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Settings
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              Customize your StockLens experience.
            </p>
          </div>
          <SettingsClient />
        </main>
      </PageTransition>
    </div>
  );
}
