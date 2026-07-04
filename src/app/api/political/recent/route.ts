import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLatestSenateTrades,
  getRecentSenateTrades,
  type RecentSenateTrade,
} from "@/lib/fmp";

const SHOW = 5;

// Cache per instance for 15 min — filings only change a few times a day.
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

  // Market-wide latest Senate filings (FMP), regardless of ticker
  let trades = await getLatestSenateTrades(SHOW).catch(() => [] as RecentSenateTrade[]);

  // Graceful fallback: per-ticker Senate eFD sweep over popular tickers
  if (trades.length === 0) {
    trades = await getRecentSenateTrades(3).catch(() => [] as RecentSenateTrade[]);
  }

  if (trades.length > 0) cached = { at: Date.now(), trades };
  return NextResponse.json({ trades });
}
