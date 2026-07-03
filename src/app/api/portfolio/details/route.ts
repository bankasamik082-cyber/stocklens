import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getQuote, getNews, getUpcomingEarnings } from "@/lib/fmp";

export interface EnrichedHolding {
  id: string;
  ticker: string;
  shares: number;
  avgCost: number | null;
  purchasedDate: string | null;
  companyName: string;
  sector: string | null;
  price: number | null;
  value: number | null;
  gainDollar: number | null;
  gainPercent: number | null;
  earningsDate: string | null;
  earningsHour: string | null;
  news: Array<{ title: string; url: string; date: string }>;
}

// Market data (not positions) cached per instance — positions are always
// read fresh so adds/removes show up immediately.
const marketCache = new Map<
  string,
  { at: number; data: { companyName: string; sector: string | null; price: number | null; news: EnrichedHolding["news"] } }
>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getMarketData(ticker: string) {
  const hit = marketCache.get(ticker);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const [profile, quote] = await Promise.all([
    getProfile(ticker).catch(() => null),
    getQuote(ticker).catch(() => null),
  ]);
  const news = await getNews(ticker, profile?.companyName || ticker, 2).catch(() => []);

  const data = {
    companyName: profile?.companyName ?? ticker,
    sector: profile?.sector || null,
    price: quote?.price ?? null,
    news: news.map((n) => ({
      title: n.title,
      url: n.url,
      date: (n.publishedDate || "").slice(0, 10),
    })),
  };
  marketCache.set(ticker, { at: Date.now(), data });
  return data;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("portfolio_holdings")
    .select("id, ticker, shares, avg_cost, purchased_date")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    const msg = error.message.includes("portfolio_holdings")
      ? error.message + " (run the portfolio_holdings migration in Supabase)"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (!rows || rows.length === 0) return NextResponse.json({ holdings: [] });

  const tickers = [...new Set(rows.map((r) => r.ticker as string))];
  const [marketList, earningsList] = await Promise.all([
    Promise.all(tickers.map(getMarketData)),
    getUpcomingEarnings(tickers, 30).catch(() => []),
  ]);
  const marketByTicker = new Map(tickers.map((t, i) => [t, marketList[i]]));
  const earningsByTicker = new Map(earningsList.map((e) => [e.ticker, e]));

  const holdings: EnrichedHolding[] = rows.map((r) => {
    const m = marketByTicker.get(r.ticker)!;
    const e = earningsByTicker.get(r.ticker);
    const shares = Number(r.shares);
    const avgCost = r.avg_cost != null ? Number(r.avg_cost) : null;
    const value = m.price != null ? m.price * shares : null;
    const costBasis = avgCost != null ? avgCost * shares : null;
    const gainDollar = value != null && costBasis != null ? value - costBasis : null;
    const gainPercent =
      gainDollar != null && costBasis ? (gainDollar / costBasis) * 100 : null;
    return {
      id: r.id,
      ticker: r.ticker,
      shares,
      avgCost,
      purchasedDate: r.purchased_date,
      companyName: m.companyName,
      sector: m.sector,
      price: m.price,
      value,
      gainDollar,
      gainPercent,
      earningsDate: e?.date ?? null,
      earningsHour: e?.hour || null,
      news: m.news,
    };
  });

  return NextResponse.json({ holdings, asOf: new Date().toISOString() });
}
