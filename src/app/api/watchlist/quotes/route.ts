import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/fmp";
import { getHistoricalPrices } from "@/lib/twelvedata";

// In-memory cache per serverless instance — Twelve Data's free tier is
// 8 credits/min, so sparklines must not be refetched on every visit.
const cache = new Map<string, { at: number; data: WatchlistQuote[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface WatchlistQuote {
  ticker: string;
  price: number | null;
  changePercent: number | null;
  spark: number[]; // last ~5 trading days of closes, oldest first
}

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
  if (tickers.length === 0) return NextResponse.json({ quotes: [] });

  const key = tickers.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ quotes: hit.data, cached: true });
  }

  const quotes: WatchlistQuote[] = await Promise.all(
    tickers.map(async (ticker) => {
      const [quote, prices] = await Promise.all([
        getQuote(ticker).catch(() => null),
        getHistoricalPrices(ticker, 6).catch(() => []),
      ]);
      return {
        ticker,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        spark: prices.slice(-5).map((p) => p.close),
      };
    })
  );

  cache.set(key, { at: Date.now(), data: quotes });
  return NextResponse.json({ quotes });
}
