import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/fmp";

// Lightweight quotes for the ticker tape — Finnhub only (no sparklines),
// cached 60s per instance so the tape can poll without hammering the API.
const cache = new Map<string, { at: number; data: TapeQuote[] }>();
const CACHE_TTL_MS = 60 * 1000;

export interface TapeQuote {
  ticker: string;
  price: number;
  changePercent: number;
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
    .limit(20);

  const tickers = (savedStocks ?? []).map((r) => r.ticker as string);
  if (tickers.length === 0) return NextResponse.json({ quotes: [] });

  const key = tickers.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ quotes: hit.data, cached: true });
  }

  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const q = await getQuote(ticker).catch(() => null);
      return q ? { ticker, price: q.price, changePercent: q.changePercent } : null;
    })
  );
  const quotes = results.filter(Boolean) as TapeQuote[];

  cache.set(key, { at: Date.now(), data: quotes });
  return NextResponse.json({ quotes });
}
