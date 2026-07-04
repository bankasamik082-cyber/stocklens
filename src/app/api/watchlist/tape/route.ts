import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/fmp";

// Lightweight quotes for the ticker tape — Finnhub only (no sparklines),
// cached 60s per instance so the tape can poll without hammering the API.
const cache = new Map<string, { at: number; data: TapeQuote[] }>();
const CACHE_TTL_MS = 60 * 1000;

// Name cache: profile2 names change rarely, cache for 1 hour
const nameCache = new Map<string, { name: string; at: number }>();
const NAME_CACHE_TTL = 60 * 60 * 1000;

async function fetchTickerName(ticker: string): Promise<string | null> {
  const hit = nameCache.get(ticker);
  if (hit && Date.now() - hit.at < NAME_CACHE_TTL) return hit.name;
  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.name) return null;
    nameCache.set(ticker, { name: data.name as string, at: Date.now() });
    return data.name as string;
  } catch {
    return null;
  }
}

export interface TapeQuote {
  ticker: string;
  name?: string;
  price: number | null;
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
      const [q, name] = await Promise.all([
        getQuote(ticker).catch(() => null),
        fetchTickerName(ticker).catch(() => null),
      ]);
      return {
        ticker,
        name: name ?? undefined,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? 0,
      };
    })
  );
  // Include all tickers even if price is null so the tape shows them all
  const quotes = results as TapeQuote[];

  cache.set(key, { at: Date.now(), data: quotes });
  return NextResponse.json({ quotes });
}
