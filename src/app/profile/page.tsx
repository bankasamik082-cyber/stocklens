import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { ProfileClient } from "./ProfileClient";

export const metadata: Metadata = {
  title: "Profile | StockLens",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="mb-8">
            <div className="label mb-2">Personalization</div>
            <h1
              className="font-display text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--t-text))` }}
            >
              Your Profile
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              Tell StockLens who you are — the app adapts its greeting, tooltips,
              and data density to fit.
            </p>
          </div>
          <ProfileClient />
        </main>
      </PageTransition>
    </div>
  );
}
