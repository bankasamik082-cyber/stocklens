import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getQuote, getNews, getUpcomingEarnings } from "@/lib/fmp";

export interface WatchlistDetail {
  ticker: string;
  companyName: string;
  price: number | null;
  changePercent: number | null;
  earningsDate: string | null;
  earningsHour: string | null;
  headline: { title: string; url: string; date: string } | null;
}

// Enriched rows are expensive (4 upstream calls per ticker) — cache per instance.
const cache = new Map<string, { at: number; data: WatchlistDetail[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

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
    .limit(12);

  const tickers = (savedStocks ?? []).map((r) => r.ticker as string);
  if (tickers.length === 0) return NextResponse.json({ rows: [] });

  const key = tickers.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ rows: hit.data, cached: true });
  }

  const earningsList = await getUpcomingEarnings(tickers).catch(() => []);
  const earningsByTicker = new Map(earningsList.map((e) => [e.ticker, e]));

  const rows: WatchlistDetail[] = await Promise.all(
    tickers.map(async (ticker) => {
      const [profile, quote] = await Promise.all([
        getProfile(ticker).catch(() => null),
        getQuote(ticker).catch(() => null),
      ]);
      const news = await getNews(ticker, profile?.companyName || ticker, 1).catch(
        () => []
      );
      const e = earningsByTicker.get(ticker);
      return {
        ticker,
        companyName: profile?.companyName ?? ticker,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        earningsDate: e?.date ?? null,
        earningsHour: e?.hour || null,
        headline: news[0]
          ? {
              title: news[0].title,
              url: news[0].url,
              date: (news[0].publishedDate || "").slice(0, 10),
            }
          : null,
      };
    })
  );

  cache.set(key, { at: Date.now(), data: rows });
  return NextResponse.json({ rows });
}
