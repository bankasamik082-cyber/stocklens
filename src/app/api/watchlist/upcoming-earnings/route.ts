import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUpcomingEarnings,
  getProfile,
  type UpcomingEarnings,
} from "@/lib/fmp";

// Major, widely-followed companies — shown even with an empty watchlist.
// (Finnhub's no-symbol calendar endpoint caps responses at 1500 rows and
// truncates the range, so we query per symbol over this fixed universe.)
const NOTABLE_TICKERS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD", "MU", "MRVL",
  "AVGO", "INTC", "CRM", "NFLX", "JPM", "BAC", "GS", "V", "MA", "WMT",
];

const SHOW = 5;

// ~25 parallel Finnhub calls per uncached request — cache per instance.
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

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

  const watchlist = (savedStocks ?? []).map((r) => r.ticker as string);
  // Merge + dedupe the notable universe with the user's watchlist
  const universe = [...new Set([...NOTABLE_TICKERS, ...watchlist])];

  const key = universe.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ earnings: hit.data, cached: true });
  }

  let upcoming: UpcomingEarnings[] = [];
  try {
    upcoming = await getUpcomingEarnings(universe);
    if (upcoming.length === 0) throw new Error("empty universe result");
  } catch {
    // Broad universe fetch failed — fall back to watchlist-only gracefully
    upcoming =
      watchlist.length > 0
        ? await getUpcomingEarnings(watchlist).catch(() => [])
        : [];
  }

  // getUpcomingEarnings returns one earliest entry per ticker, sorted by date
  const top = upcoming.slice(0, SHOW);

  // Resolve company names for the shown entries only
  const withNames = await Promise.all(
    top.map(async (e) => {
      const profile = await getProfile(e.ticker).catch(() => null);
      return { ...e, companyName: profile?.companyName ?? e.ticker };
    })
  );

  cache.set(key, { at: Date.now(), data: withNames });
  return NextResponse.json({ earnings: withNames });
}
