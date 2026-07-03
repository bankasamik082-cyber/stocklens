import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecentSenateTrades, type RecentSenateTrade } from "@/lib/fmp";

// Senate eFD full-text search is slow-ish; cache per instance for 15 min.
let cached: { at: number; trades: RecentSenateTrade[] } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ trades: cached.trades, cached: true });
  }

  const trades = await getRecentSenateTrades(3);
  cached = { at: Date.now(), trades };
  return NextResponse.json({ trades });
}
