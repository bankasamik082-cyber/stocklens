import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getHistoricalPrices,
  getNewsAroundDate,
  getPoliticianTrades,
  publicUrl,
  finnhubPublicUrl,
  type FmpPoliticianTrade,
} from "@/lib/fmp";
import { generateMoveExplanation } from "@/lib/openai";
import type { Source } from "@/lib/types";

// GET /api/explain-move?ticker=AAPL
// Returns ~1 year of daily closing prices for the chart.
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();

  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const prices = await getHistoricalPrices(ticker, 365);

  if (!prices.length) {
    return NextResponse.json(
      { error: `No price history found for "${ticker}". Check the ticker and try again.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ ticker, prices });
}

// POST /api/explain-move
// Body: { ticker, date }
// Fetches news + politician trades for context, then calls Gemini for an explanation.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { ticker?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ticker = (body.ticker || "").trim().toUpperCase();
  const date = (body.date || "").trim();

  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 }
    );
  }

  // Fetch price history, news window, and politician trades in parallel.
  const [prices, news, politician] = await Promise.all([
    getHistoricalPrices(ticker, 400),
    getNewsAroundDate(ticker, date, 5),
    getPoliticianTrades(ticker),
  ]);

  // Find the specific day's price entry.
  const priceEntry = prices.find((p) => p.date === date);
  if (!priceEntry) {
    return NextResponse.json(
      {
        error:
          "No price data found for that date. Markets may have been closed or data unavailable.",
      },
      { status: 404 }
    );
  }

  // Filter politician trades to those within ±30 days of the clicked date.
  const center = new Date(`${date}T12:00:00Z`);
  const windowStart = new Date(center);
  windowStart.setDate(windowStart.getDate() - 30);
  const windowEnd = new Date(center);
  windowEnd.setDate(windowEnd.getDate() + 30);

  function resolveName(t: FmpPoliticianTrade): string {
    return (
      t.representative ||
      [t.firstName, t.lastName].filter(Boolean).join(" ") ||
      "Unknown"
    );
  }

  const nearbyTrades = [...politician.senate, ...politician.house].filter((t) => {
    const raw = t.transactionDate || t.dateRecieved;
    if (!raw) return false;
    const d = new Date(`${raw}T12:00:00Z`);
    return d >= windowStart && d <= windowEnd;
  });

  // Build sources list.
  const newsFrom = new Date(center);
  newsFrom.setDate(newsFrom.getDate() - 5);
  const newsTo = new Date(center);
  newsTo.setDate(newsTo.getDate() + 5);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const sources: Source[] = [
    {
      label: `FMP — ${ticker} price history`,
      url: publicUrl(`/historical-price-eod/full?symbol=${ticker}`),
    },
    {
      label: `Finnhub — ${ticker} news ${fmt(newsFrom)} to ${fmt(newsTo)}`,
      url: finnhubPublicUrl(
        `/company-news?symbol=${ticker}&from=${fmt(newsFrom)}&to=${fmt(newsTo)}`
      ),
    },
    ...news.slice(0, 6).map((n) => ({
      label: `${n.site || "Article"} — ${n.title}`.slice(0, 80),
      url: n.url,
    })),
    ...(nearbyTrades.length > 0
      ? [
          {
            label: "FMP — Senate trading disclosures",
            url: publicUrl(`/senate-trades?symbol=${ticker}`),
          },
          {
            label: "FMP — House trading disclosures",
            url: publicUrl(`/house-trades?symbol=${ticker}`),
          },
        ]
      : []),
  ];

  const explanation = await generateMoveExplanation({
    ticker,
    date,
    close: priceEntry.close,
    priceChange: priceEntry.change,
    priceChangePercent: priceEntry.changePercent,
    newsHeadlines: news.map((n) => ({
      title: n.title,
      date: (n.publishedDate || "").slice(0, 10),
      url: n.url,
    })),
    politicianTrades: nearbyTrades.slice(0, 10).map((t) => ({
      name: resolveName(t),
      date: t.transactionDate || t.dateRecieved || "",
      type: t.type || "",
      amount: t.amount || "Not disclosed",
    })),
  });

  return NextResponse.json({
    date,
    ticker,
    close: priceEntry.close,
    priceChange: priceEntry.change,
    priceChangePercent: priceEntry.changePercent,
    explanation,
    sources,
  });
}
