import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getNewsAroundDate,
  getPoliticianTrades,
  getPeers,
  getEarningsHistory,
  getAnalystRecommendations,
  getInsiderTransactions,
  getProfile,
  finnhubPublicUrl,
  type FmpPoliticianTrade,
  type DatedNews,
  type EarningsEvent,
} from "@/lib/fmp";
import {
  getHistoricalPrices,
  getChangePercentOn,
  tdPublicUrl,
} from "@/lib/twelvedata";
import { generateMoveExplanation } from "@/lib/openai";
import { daysBetween } from "@/lib/dates";
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

// ---- Small numeric helpers --------------------------------------------------

function mean(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function stddev(xs: number[]): number | null {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  const variance =
    xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function volumeNoteFor(rel: number | null): string {
  if (rel === null) return "unknown";
  if (rel >= 2) return "unusually high";
  if (rel >= 1.3) return "elevated";
  if (rel >= 0.7) return "normal";
  return "below average";
}

function resolveName(t: FmpPoliticianTrade): string {
  return (
    t.representative ||
    [t.firstName, t.lastName].filter(Boolean).join(" ") ||
    "Unknown"
  );
}

// POST /api/explain-move
// Body: { ticker, date }
// Assembles a multi-factor context (price/volume/volatility, peer moves,
// same/prior-day news, earnings, analyst shifts, insider + politician trades)
// and asks Gemini for a ranked, cited explanation with a confidence level.
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

  // ---- Fetch every factor in parallel (all degrade gracefully) --------------
  const [prices, news, politician, earnings, analyst, insider, profile, peerList] =
    await Promise.all([
      getHistoricalPrices(ticker, 400).catch(() => []),
      getNewsAroundDate(ticker, date, 4).catch(() => [] as DatedNews[]),
      getPoliticianTrades(ticker).catch(() => ({
        senate: [] as FmpPoliticianTrade[],
        house: [] as FmpPoliticianTrade[],
      })),
      getEarningsHistory(ticker).catch(() => [] as EarningsEvent[]),
      getAnalystRecommendations(ticker).catch(() => null),
      getInsiderTransactions(ticker, 40).catch(() => null),
      getProfile(ticker).catch(() => null),
      getPeers(ticker).catch(() => [] as string[]),
    ]);

  const idx = prices.findIndex((p) => p.date === date);
  if (idx < 0) {
    return NextResponse.json(
      {
        error:
          "No price data found for that date. Markets may have been closed or data unavailable.",
      },
      { status: 404 }
    );
  }
  const priceEntry = prices[idx];
  const prevBarDate = idx > 0 ? prices[idx - 1].date : null;

  // ---- Volume + volatility context (from the main ticker's own bars) --------
  const trailing = prices.slice(Math.max(0, idx - 30), idx);
  const avgVolume = mean(
    trailing.map((p) => p.volume).filter((v) => v > 0)
  );
  const relativeVolume =
    avgVolume && avgVolume > 0 && priceEntry.volume > 0
      ? +(priceEntry.volume / avgVolume).toFixed(2)
      : null;
  const retStd = stddev(trailing.map((p) => p.changePercent));
  const moveSigma =
    retStd && retStd > 0
      ? +(Math.abs(priceEntry.changePercent) / retStd).toFixed(2)
      : null;

  // ---- Peer / sector context (sample up to 4 peers on the same day) ---------
  const peerTickers = peerList.slice(0, 4);
  const peerMoves = await Promise.all(
    peerTickers.map(async (p) => ({
      ticker: p,
      changePercent: await getChangePercentOn(p, date).catch(() => null),
    }))
  );
  const peers = peerMoves.filter(
    (p): p is { ticker: string; changePercent: number } =>
      p.changePercent !== null
  );
  const avgPeerChangePercent =
    peers.length > 0
      ? +(mean(peers.map((p) => p.changePercent)) ?? 0).toFixed(2)
      : null;

  // Sector-wide if enough peers moved the same direction with comparable size.
  let sectorWide: boolean | null = null;
  if (peers.length >= 2 && avgPeerChangePercent !== null) {
    const stockMove = priceEntry.changePercent;
    const sameSign = Math.sign(avgPeerChangePercent) === Math.sign(stockMove);
    const ratio =
      Math.abs(stockMove) > 0
        ? Math.abs(avgPeerChangePercent) / Math.abs(stockMove)
        : 0;
    sectorWide = sameSign && ratio >= 0.5;
  }

  // ---- News: bucket ET-aligned to same-day vs prior-day (causal only) -------
  const sameDayNews = news.filter((n) => n.etDate === date).slice(0, 6);
  const priorDayNews = news
    .filter((n) => n.etDate < date)
    .slice(0, 6);

  // ---- Earnings within ±1 day of the move (AMC reports move the next day) ---
  const earningsNear =
    earnings
      .filter((e) => Math.abs(daysBetween(e.period, date)) <= 1)
      .sort(
        (a, b) =>
          Math.abs(daysBetween(a.period, date)) -
          Math.abs(daysBetween(b.period, date))
      )[0] ?? null;

  // ---- Analyst sentiment shift — only attribute when in the move's month ----
  let analystChange:
    | { direction: string; fromPct: number; toPct: number; total: number }
    | null = null;
  if (analyst && analyst.prev && analyst.period.slice(0, 7) === date.slice(0, 7)) {
    const prev = analyst.prev;
    const prevTotal =
      prev.strongBuy + prev.buy + prev.hold + prev.sell + prev.strongSell;
    if (prevTotal > 0) {
      const prevBull = +(((prev.strongBuy + prev.buy) / prevTotal) * 100).toFixed(1);
      const delta = +(analyst.bullPct - prevBull).toFixed(1);
      if (Math.abs(delta) >= 5) {
        analystChange = {
          direction: delta > 0 ? "improved" : "declined",
          fromPct: prevBull,
          toPct: analyst.bullPct,
          total: analyst.total,
        };
      }
    }
  }

  // ---- Insider open-market trades within ±5 days ----------------------------
  const insiderTrades = (insider?.transactions ?? [])
    .filter((t) => t.date && Math.abs(daysBetween(t.date, date)) <= 5)
    .slice(0, 5)
    .map((t) => ({
      name: t.name,
      type: t.transactionType,
      shares: t.shares,
      date: t.date,
    }));

  // ---- Politician trades within ±30 days ------------------------------------
  const nearbyTrades = [...politician.senate, ...politician.house].filter((t) => {
    const raw = t.transactionDate || t.dateRecieved;
    if (!raw) return false;
    return Math.abs(daysBetween(raw, date)) <= 30;
  });
  const politicianTrades = nearbyTrades.slice(0, 8).map((t) => ({
    name: resolveName(t),
    date: t.transactionDate || t.dateRecieved || "",
    type: t.type || "",
    amount: t.amount || "Not disclosed",
  }));

  // ---- Ask Gemini to synthesize a ranked, cited explanation -----------------
  const explanation = await generateMoveExplanation({
    ticker,
    companyName: profile?.companyName || ticker,
    sector: profile?.sector || "",
    date,
    close: priceEntry.close,
    priceChangePercent: priceEntry.changePercent,
    relativeVolume,
    volumeNote: volumeNoteFor(relativeVolume),
    moveSigma,
    peers,
    avgPeerChangePercent,
    sectorWide,
    sameDayNews: sameDayNews.map((n) => ({ title: n.title, source: n.source })),
    priorDayNews: priorDayNews.map((n) => ({ title: n.title, source: n.source })),
    earnings: earningsNear
      ? {
          period: earningsNear.period,
          quarter: earningsNear.quarter,
          year: earningsNear.year,
          actual: earningsNear.actual,
          estimate: earningsNear.estimate,
          surprisePercent: earningsNear.surprisePercent,
          beat: earningsNear.beat,
        }
      : null,
    analystChange,
    insiderTrades,
    politicianTrades,
  });

  // ---- Build the cited sources list -----------------------------------------
  const citedNews = [...sameDayNews, ...priorDayNews];
  const sources: Source[] = [
    {
      label: `Twelve Data — ${ticker} price history`,
      url: tdPublicUrl(`/time_series?symbol=${ticker}&interval=1day`),
    },
    {
      label: `Finnhub — ${ticker} company news around ${date}`,
      url: finnhubPublicUrl(`/company-news?symbol=${ticker}`),
    },
    ...citedNews.slice(0, 6).map((n) => ({
      label: `${n.source || "Article"} — ${n.title}`.slice(0, 80),
      url: n.url,
    })),
    ...(earningsNear
      ? [
          {
            label: `Finnhub — ${ticker} earnings (Q${earningsNear.quarter} ${earningsNear.year})`,
            url: finnhubPublicUrl(`/stock/earnings?symbol=${ticker}`),
          },
        ]
      : []),
    ...(politicianTrades.length > 0
      ? [
          {
            label: "FMP — Senate Disclosures",
            url: "https://financialmodelingprep.com/financial-statements/senate-disclosure",
          },
        ]
      : []),
  ];

  return NextResponse.json({
    date,
    ticker,
    close: priceEntry.close,
    priceChange: priceEntry.change,
    priceChangePercent: priceEntry.changePercent,
    // Structured, deterministic factor context the UI can chip out even if the
    // model is terse.
    factors: {
      relativeVolume,
      volumeNote: volumeNoteFor(relativeVolume),
      moveSigma,
      avgPeerChangePercent,
      sectorWide,
      peers,
      prevBarDate,
      hasEarnings: !!earningsNear,
      newsCount: sameDayNews.length + priorDayNews.length,
    },
    explanation,
    sources,
  });
}
