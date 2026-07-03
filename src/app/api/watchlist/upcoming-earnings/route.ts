import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingEarnings, getProfile } from "@/lib/fmp";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: savedStocks } = await supabase
    .from("saved_stocks")
    .select("ticker")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const tickers = (savedStocks ?? []).map((r) => r.ticker as string);
  if (tickers.length === 0) return NextResponse.json({ earnings: [] });

  const upcoming = (await getUpcomingEarnings(tickers)).slice(0, 3);

  // Resolve company names for the top 3 only
  const withNames = await Promise.all(
    upcoming.map(async (e) => {
      const profile = await getProfile(e.ticker).catch(() => null);
      return { ...e, companyName: profile?.companyName ?? e.ticker };
    })
  );

  return NextResponse.json({ earnings: withNames });
}
