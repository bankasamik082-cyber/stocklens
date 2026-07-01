import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getFinancials,
  getNews,
  getPoliticianTrades,
  formatMoney,
  type FmpPoliticianTrade,
} from "@/lib/fmp";

function normalizeTrade(t: FmpPoliticianTrade) {
  return {
    name:
      t.representative ||
      [t.firstName, t.lastName].filter(Boolean).join(" ") ||
      "Unknown",
    party: t.party || "Unknown",
    type: t.type || "Unknown",
    date: t.transactionDate || t.dateRecieved || "Unknown",
    amount: t.amount || "Not disclosed",
  };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  // All data sources in parallel — reuse the same lib functions as /api/analyze
  const [profile, financials, trades] = await Promise.all([
    getProfile(ticker),
    getFinancials(ticker),
    getPoliticianTrades(ticker),
  ]);

  const news = await getNews(ticker, profile?.companyName || ticker, 8);

  const { income, balance, cashflow } = financials;
  const profitMarginPct =
    income?.revenue && income.revenue !== 0
      ? `${((income.netIncome / income.revenue) * 100).toFixed(1)}%`
      : null;
  const grossMarginPct =
    income?.revenue && income.revenue !== 0 && income.grossProfit
      ? `${((income.grossProfit / income.revenue) * 100).toFixed(1)}%`
      : null;

  return NextResponse.json({
    ticker,
    companyName: profile?.companyName || ticker,
    profile: profile
      ? {
          sector: profile.sector || null,
          industry: profile.industry || null,
          marketCap: formatMoney(profile.marketCap),
          currency: profile.currency || "USD",
          website: profile.website || null,
        }
      : null,
    financials: {
      revenue: income ? formatMoney(income.revenue) : null,
      netIncome: income ? formatMoney(income.netIncome) : null,
      profitMargin: profitMarginPct,
      grossMargin: grossMarginPct,
      totalDebt: balance ? formatMoney(balance.totalDebt) : null,
      operatingCashFlow: cashflow ? formatMoney(cashflow.operatingCashFlow) : null,
    },
    news: news.map((n) => ({
      title: n.title,
      summary: (n.text || "").slice(0, 300),
      date: (n.publishedDate || "").slice(0, 10),
      url: n.url,
      source: n.site,
    })),
    senatorTrades: trades.senate.slice(0, 8).map(normalizeTrade),
    houseTrades: trades.house.slice(0, 8).map(normalizeTrade),
    loadedAt: new Date().toISOString(),
  });
}
