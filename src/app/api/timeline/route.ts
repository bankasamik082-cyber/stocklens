import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHistoricalPrices, type HistoricalPrice } from "@/lib/twelvedata";
import { getPoliticianTrades, type FmpPoliticianTrade } from "@/lib/fmp";

const FH_BASE = "https://finnhub.io/api/v1";

function fhKey() {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY not set");
  return k;
}

// ---- Types ------------------------------------------------------------------

export type EventType = "earnings" | "news" | "politician" | "insider" | "analystChange";

export interface TimelineEvent {
  id: string;          // unique key for React
  date: string;        // YYYY-MM-DD
  type: EventType;
  title: string;       // short, shown on dot hover
  detail: string;      // full description for popover + list
  link?: string;       // news articles
  // Earnings
  beat?: boolean;
  epsActual?: number | null;
  epsEstimate?: number | null;
  epsSurprisePct?: number | null;
  // Politician
  traderName?: string;
  party?: string;
  tradeType?: string;
  amount?: string;
  // Insider
  insiderName?: string;
  insiderCode?: string;
  // Analyst
  bullPct?: number;
  bullPctPrev?: number;
}

// ---- Finnhub earnings -------------------------------------------------------

interface FhEarnings {
  symbol: string;
  period: string;       // YYYY-MM-DD (reporting date approximation)
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

async function fetchEarnings(ticker: string): Promise<FhEarnings[]> {
  try {
    const url = `${FH_BASE}/stock/earnings?symbol=${ticker}&token=${fhKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data as FhEarnings[];
  } catch {
    return [];
  }
}

// ---- Finnhub company news (1 year) ------------------------------------------

interface FhNewsItem {
  headline: string;
  summary: string;
  datetime: number;   // Unix seconds
  source: string;
  url: string;
}

async function fetchYearNews(ticker: string): Promise<Array<{
  title: string;
  publishedDate: string;  // YYYY-MM-DD
  source: string;
  url: string;
}>> {
  try {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `${FH_BASE}/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${fhKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json() as FhNewsItem[];
    if (!Array.isArray(data)) return [];
    // Deduplicate by headline + normalise
    const seen = new Set<string>();
    const out: { title: string; publishedDate: string; source: string; url: string }[] = [];
    for (const n of data) {
      if (!n.headline || seen.has(n.headline)) continue;
      seen.add(n.headline);
      out.push({
        title: n.headline,
        publishedDate: new Date(n.datetime * 1000).toISOString().slice(0, 10),
        source: n.source,
        url: n.url,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Caps news to `maxPerMonth` most-recent articles per calendar month.
function capNewsByMonth<T extends { publishedDate: string }>(
  news: T[],
  maxPerMonth: number
): T[] {
  const byMonth = new Map<string, T[]>();
  for (const n of news) {
    const month = n.publishedDate.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(n);
  }
  const result: T[] = [];
  // months sorted newest-first so we naturally take recent within each month
  for (const month of [...byMonth.keys()].sort().reverse()) {
    result.push(...byMonth.get(month)!.slice(0, maxPerMonth));
  }
  return result;
}

// ---- Finnhub insider transactions -------------------------------------------

interface FhInsiderRaw {
  name: string;
  transactionCode: string;
  change: number;
  transactionPrice: number;
  transactionDate: string;
  isDerivative: boolean;
}

async function fetchInsiderTransactions(ticker: string): Promise<FhInsiderRaw[]> {
  try {
    const url = `${FH_BASE}/stock/insider-transactions?symbol=${ticker}&token=${fhKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json() as { data?: FhInsiderRaw[] };
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

// ---- Finnhub analyst recommendations ----------------------------------------

interface FhRecommendation {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

async function fetchAllRecommendations(ticker: string): Promise<FhRecommendation[]> {
  try {
    const url = `${FH_BASE}/stock/recommendation?symbol=${ticker}&token=${fhKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as FhRecommendation[]).sort((a, b) => (a.period < b.period ? -1 : 1));
  } catch {
    return [];
  }
}

// ---- Politician trade normalisation -----------------------------------------

function normaliseTrade(t: FmpPoliticianTrade, idx: number) {
  const name =
    t.representative ||
    [t.firstName, t.lastName].filter(Boolean).join(" ") ||
    "Unknown";
  const date = t.transactionDate || t.dateRecieved || "";
  return { name, date, party: t.party || "Unknown", type: t.type || "Trade", amount: t.amount || "Not disclosed", idx };
}

// ---- Route ------------------------------------------------------------------

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoStr = yearAgo.toISOString().slice(0, 10);

  const fetchResult = await Promise.all([
    getHistoricalPrices(ticker, 365).catch((): HistoricalPrice[] => []),
    fetchEarnings(ticker).catch((): FhEarnings[] => []),
    fetchYearNews(ticker).catch(() => [] as Array<{ title: string; publishedDate: string; source: string; url: string }>),
    getPoliticianTrades(ticker).catch(() => ({ senate: [] as FmpPoliticianTrade[], house: [] as FmpPoliticianTrade[] })),
    fetchInsiderTransactions(ticker).catch((): FhInsiderRaw[] => []),
    fetchAllRecommendations(ticker).catch((): FhRecommendation[] => []),
  ]);

  const [prices, earningsRaw, newsRaw, trades, insiderRaw, recommendationsRaw] = fetchResult;

  if (!prices.length) {
    return NextResponse.json(
      { error: `No price history found for "${ticker}". Markets may be closed or the ticker may be invalid.` },
      { status: 404 }
    );
  }

  // Build earnings events (past year only)
  const earningsEvents: TimelineEvent[] = earningsRaw
    .filter((e) => e.period >= yearAgoStr && e.actual !== null)
    .map((e, i) => {
      const beat = e.surprise !== null ? e.surprise >= 0 : undefined;
      const surprisePct = e.surprisePercent;
      const surpriseLabel =
        surprisePct !== null && surprisePct !== undefined
          ? ` (${surprisePct >= 0 ? "+" : ""}${surprisePct.toFixed(1)}%)`
          : "";
      return {
        id: `earn-${i}`,
        date: e.period,
        type: "earnings" as const,
        title: `Q${e.quarter} ${e.year} EPS${surpriseLabel}`,
        detail: [
          `Q${e.quarter} ${e.year} earnings.`,
          e.actual !== null ? `Reported EPS: $${e.actual.toFixed(2)}.` : "",
          e.estimate !== null ? `Estimate: $${e.estimate.toFixed(2)}.` : "",
          surprisePct !== null && surprisePct !== undefined
            ? `Surprise: ${surprisePct >= 0 ? "+" : ""}${surprisePct.toFixed(1)}% (${beat ? "beat" : "miss"}).`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        beat,
        epsActual: e.actual,
        epsEstimate: e.estimate,
        epsSurprisePct: surprisePct,
      };
    });

  // Build news events (cap to 2/month)
  const newsFiltered = capNewsByMonth(newsRaw, 2);
  const newsEvents: TimelineEvent[] = newsFiltered.map((n, i) => ({
    id: `news-${i}`,
    date: n.publishedDate,
    type: "news" as const,
    title: n.title.length > 70 ? n.title.slice(0, 67) + "…" : n.title,
    detail: n.title,
    link: n.url,
  }));

  // Build politician events (past year only)
  const allTrades = [
    ...trades.senate.map((t) => normaliseTrade(t, 0)),
    ...trades.house.map((t) => normaliseTrade(t, 0)),
  ].filter((t) => t.date >= yearAgoStr);

  const politicianEvents: TimelineEvent[] = allTrades.map((t, i) => ({
    id: `pol-${i}`,
    date: t.date,
    type: "politician" as const,
    title: `${t.name} — ${t.type}`,
    detail: `${t.name} (${t.party}): ${t.type} · ${t.amount}`,
    traderName: t.name,
    party: t.party,
    tradeType: t.type,
    amount: t.amount,
  }));

  // Build insider events (P=Purchase and S=Sale only, past year)
  const INSIDER_LABELS: Record<string, string> = { P: "Purchase", S: "Sale" };
  const insiderEvents: TimelineEvent[] = insiderRaw
    .filter((t) => !t.isDerivative && ["P", "S"].includes(t.transactionCode) && t.transactionDate >= yearAgoStr)
    .slice(0, 20)
    .map((t, i) => {
      const label = INSIDER_LABELS[t.transactionCode] ?? t.transactionCode;
      const shares = Math.abs(t.change).toLocaleString();
      const value = t.transactionPrice > 0
        ? ` ($${(Math.abs(t.change) * t.transactionPrice / 1_000_000).toFixed(2)}M)`
        : "";
      return {
        id: `ins-${i}`,
        date: t.transactionDate,
        type: "insider" as const,
        title: `Insider ${label} — ${t.name}`,
        detail: `${t.name}: ${label} of ${shares} shares${value}.`,
        insiderName: t.name,
        insiderCode: t.transactionCode,
      };
    });

  // Build analyst change events (month-over-month shifts >= 5pp)
  const analystEvents: TimelineEvent[] = [];
  for (let i = 1; i < recommendationsRaw.length; i++) {
    const prev = recommendationsRaw[i - 1];
    const curr = recommendationsRaw[i];
    if (curr.period < yearAgoStr) continue;
    const totalPrev = prev.strongBuy + prev.buy + prev.hold + prev.sell + prev.strongSell;
    const totalCurr = curr.strongBuy + curr.buy + curr.hold + curr.sell + curr.strongSell;
    if (totalPrev === 0 || totalCurr === 0) continue;
    const bullPrev = +((( prev.strongBuy + prev.buy) / totalPrev) * 100).toFixed(1);
    const bullCurr = +((( curr.strongBuy + curr.buy) / totalCurr) * 100).toFixed(1);
    const delta = bullCurr - bullPrev;
    if (Math.abs(delta) < 5) continue;
    const direction = delta > 0 ? "improved" : "declined";
    analystEvents.push({
      id: `analyst-${i}`,
      date: curr.period + "-01",
      type: "analystChange" as const,
      title: `Analyst sentiment ${direction} (${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp)`,
      detail: `Bullish % ${direction} from ${bullPrev}% to ${bullCurr}% (${totalCurr} analysts, ${curr.period}).`,
      bullPct: bullCurr,
      bullPctPrev: bullPrev,
    });
  }

  // Merge and sort by date (oldest → newest)
  const events: TimelineEvent[] = [
    ...earningsEvents,
    ...newsEvents,
    ...politicianEvents,
    ...insiderEvents,
    ...analystEvents,
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return NextResponse.json({ ticker, prices, events });
}
