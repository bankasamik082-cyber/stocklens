import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getProfile, getMetrics, getRecentSenateTrades, type FmpProfile } from "@/lib/fmp";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const maxDuration = 60;

// Hardcoded universe of ~50 major tickers across sectors
const UNIVERSE: Record<string, string[]> = {
  Technology: ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "AMD", "INTC", "AVGO", "MRVL", "MU", "TSM", "QCOM", "TXN", "ADI", "AMAT", "KLAC", "LRCX"],
  Finance: ["JPM", "BAC", "GS", "MS", "V", "MA", "WFC", "C", "AXP"],
  Healthcare: ["JNJ", "UNH", "PFE", "ABBV", "LLY", "MRK", "TMO", "ABT"],
  Energy: ["XOM", "CVX", "COP", "SLB", "EOG"],
  Consumer: ["WMT", "COST", "TGT", "NKE", "MCD", "SBUX"],
  Industrial: ["CAT", "DE", "HON", "GE", "BA", "RTX"],
};

const ALL_TICKERS = Object.values(UNIVERSE).flat();

// Sector keyword aliases for normalizing Gemini output
const SECTOR_ALIASES: Record<string, string> = {
  tech: "Technology", technology: "Technology", semiconductor: "Technology", semiconductors: "Technology", software: "Technology",
  finance: "Finance", financial: "Finance", banking: "Finance", bank: "Finance",
  health: "Healthcare", healthcare: "Healthcare", pharma: "Healthcare", biotech: "Healthcare",
  energy: "Energy", oil: "Energy", gas: "Energy",
  consumer: "Consumer", retail: "Consumer",
  industrial: "Industrial", defense: "Industrial", aerospace: "Industrial",
};

interface FilterSpec {
  sector?: string;
  minMarketCapB?: number;
  maxMarketCapB?: number;
  profitable?: boolean;
  strongCashFlow?: boolean;
  recentPoliticianBuying?: boolean;
}

export interface ScreenerResult {
  ticker: string;
  name: string;
  sector: string;
  marketCapB: number;
  matchReasons: string[];
}

// Module-level caches (survive across requests in the same serverless instance)
const profileCache = new Map<string, { profile: FmpProfile | null; at: number }>();
const metricsCache = new Map<string, { netMargin: number | null; opCFPerShare: number | null; at: number }>();
const PROFILE_TTL = 30 * 60 * 1000;
const METRICS_TTL = 60 * 60 * 1000;

async function getCachedProfile(ticker: string): Promise<FmpProfile | null> {
  const hit = profileCache.get(ticker);
  if (hit && Date.now() - hit.at < PROFILE_TTL) return hit.profile;
  const profile = await getProfile(ticker).catch(() => null);
  profileCache.set(ticker, { profile, at: Date.now() });
  return profile;
}

async function getCachedMetrics(ticker: string) {
  const hit = metricsCache.get(ticker);
  if (hit && Date.now() - hit.at < METRICS_TTL) return hit;
  const m = await getMetrics(ticker).catch(() => null);
  const result = {
    netMargin: m?.netProfitMarginAnnual ?? null,
    opCFPerShare: m?.operatingCashFlowPerShareAnnual ?? null,
    at: Date.now(),
  };
  metricsCache.set(ticker, result);
  return result;
}

async function parseQueryWithGemini(query: string): Promise<FilterSpec> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Parse this stock screener query into a JSON filter specification. Be conservative — only set fields that are clearly implied.

Query: "${query}"

Available filter fields (all optional):
- sector: one of "Technology", "Finance", "Healthcare", "Energy", "Consumer", "Industrial"
- minMarketCapB: minimum market cap in billions (number). Use: large-cap=100, mid-cap=2, mega-cap=200
- maxMarketCapB: maximum market cap in billions (number)
- profitable: true if user wants companies with positive net income
- strongCashFlow: true if user wants companies with positive operating cash flow
- recentPoliticianBuying: true if user wants stocks with recent Senate purchase disclosures

Respond with ONLY a valid JSON object. No markdown, no code fences.
Example: {"sector":"Technology","profitable":true,"minMarketCapB":50}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(text) as FilterSpec;
    // Normalize sector aliases
    if (parsed.sector) {
      parsed.sector = SECTOR_ALIASES[parsed.sector.toLowerCase()] ?? parsed.sector;
    }
    return parsed;
  } catch {
    return {};
  }
}

function sectorForTicker(ticker: string): string {
  for (const [sector, tickers] of Object.entries(UNIVERSE)) {
    if (tickers.includes(ticker)) return sector;
  }
  return "Other";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const query = (body.query || "").trim();
  if (!query) return NextResponse.json({ error: "Query is required." }, { status: 400 });
  if (query.length > 300) return NextResponse.json({ error: "Query too long." }, { status: 400 });

  // Parse query into filters
  const filters = await parseQueryWithGemini(query);

  // Step 1: sector filter narrows the ticker set before any API calls
  const candidateTickers = filters.sector
    ? (UNIVERSE[filters.sector] ?? ALL_TICKERS)
    : ALL_TICKERS;

  // Step 2: fetch profiles for candidates in parallel (batched to avoid rate limits)
  const BATCH = 8;
  const profiles: Array<{ ticker: string; profile: FmpProfile | null }> = [];
  for (let i = 0; i < candidateTickers.length; i += BATCH) {
    const batch = candidateTickers.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ticker) => ({ ticker, profile: await getCachedProfile(ticker) }))
    );
    profiles.push(...results);
  }

  // Step 3: apply market cap filter using profile data
  let filtered = profiles.filter(({ profile }) => {
    if (!profile) return false;
    const capB = profile.marketCap / 1e9;
    if (filters.minMarketCapB && capB < filters.minMarketCapB) return false;
    if (filters.maxMarketCapB && capB > filters.maxMarketCapB) return false;
    return true;
  });

  // Step 4: if profitability or cash flow filter required, fetch metrics
  const needMetrics = filters.profitable || filters.strongCashFlow;
  if (needMetrics && filtered.length > 0) {
    const metricsData = await Promise.all(
      filtered.map(async ({ ticker }) => ({ ticker, ...(await getCachedMetrics(ticker)) }))
    );
    const metricsByTicker = new Map(metricsData.map((m) => [m.ticker, m]));

    filtered = filtered.filter(({ ticker }) => {
      const m = metricsByTicker.get(ticker);
      if (filters.profitable && (m?.netMargin == null || m.netMargin <= 0)) return false;
      if (filters.strongCashFlow && (m?.opCFPerShare == null || m.opCFPerShare <= 0)) return false;
      return true;
    });
  }

  // Step 5: if politician buying filter required, check senate-latest cache
  let politicianBuyTickers: Set<string> = new Set();
  if (filters.recentPoliticianBuying) {
    const recent = await getRecentSenateTrades(50).catch(() => []);
    politicianBuyTickers = new Set(
      recent
        .filter((t) => /purchase|buy/i.test(t.type))
        .map((t) => t.ticker.toUpperCase())
    );
    filtered = filtered.filter(({ ticker }) => politicianBuyTickers.has(ticker));
  }

  // Step 6: build results with match reasons
  const results: ScreenerResult[] = filtered.slice(0, 20).map(({ ticker, profile }) => {
    const capB = (profile!.marketCap / 1e9);
    const reasons: string[] = [];
    if (filters.sector) reasons.push(`${filters.sector} sector`);
    if (filters.minMarketCapB) reasons.push(`Market cap $${capB.toFixed(0)}B`);
    if (filters.profitable) reasons.push("Profitable");
    if (filters.strongCashFlow) reasons.push("Positive operating cash flow");
    if (filters.recentPoliticianBuying && politicianBuyTickers.has(ticker)) reasons.push("Recent senator buying");
    if (reasons.length === 0) reasons.push(sectorForTicker(ticker));

    return {
      ticker,
      name: profile!.companyName,
      sector: profile!.sector || sectorForTicker(ticker),
      marketCapB: +capB.toFixed(1),
      matchReasons: reasons,
    };
  });

  // Sort by market cap descending
  results.sort((a, b) => b.marketCapB - a.marketCapB);

  return NextResponse.json({ results, filters, query });
}
