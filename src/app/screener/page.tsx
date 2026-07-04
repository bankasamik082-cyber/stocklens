import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { ScreenerClient } from "./ScreenerClient";

export const metadata: Metadata = {
  title: "AI Screener | StockLens",
};

export default async function ScreenerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
          <ScreenerClient />
        </main>
      </PageTransition>
    </div>
  );
}
