// Data layer: Finnhub (profile + financials + news) + FMP (politician trades via senate-latest).
//
// FMP free tier restricts income/balance/cashflow to a handful of mega-cap demo tickers
// (returns HTTP 402 for everything else). Profile and financial statements come from
// Finnhub's free tier. FMP is kept only for senate-trades via /stable/senate-latest
// (market-wide feed — the per-symbol efts.senate.gov domain is dead/NXDOMAIN).
//
// Finnhub financials-reported returns XBRL-labeled arrays — labels vary by company, so
// we do prefix/substring matching rather than fixed field names.

import { etDateFromUnix } from "./dates";

const BASE = "https://financialmodelingprep.com/stable";
const FH_BASE = "https://finnhub.io/api/v1";

function fmpKey() {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set");
  return k;
}

function finnhubKey() {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY is not set");
  return k;
}

export function publicUrl(path: string): string {
  return `${BASE}${path}`;
}

export function finnhubPublicUrl(path: string): string {
  return `${FH_BASE}${path}`;
}

async function fmpGet<T>(path: string): Promise<T | null> {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}apikey=${fmpKey()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === "object" && !Array.isArray(data) && "Error Message" in data) {
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

async function fhGet<T>(path: string): Promise<T | null> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${FH_BASE}${path}${sep}token=${finnhubKey()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---- Finnhub XBRL helpers ----

interface FhXbrlItem {
  label: string;
  value: number | null;
}

interface FhFinancialsReported {
  data: Array<{
    period: string | null;
    year: number;
    report: {
      ic: FhXbrlItem[];
      bs: FhXbrlItem[];
      cf: FhXbrlItem[];
    };
  }>;
}

interface FhProfile2 {
  ticker: string;
  name: string;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number; // in millions
  shareOutstanding: number;
  finnhubIndustry: string;
  weburl: string;
  logo: string;
  description?: string;
  gicsSector?: string;
  sector?: string;
}

interface FhMetrics {
  metric: {
    netProfitMarginAnnual?: number;
    revenuePerShareAnnual?: number;
    operatingCashFlowPerShareAnnual?: number;
    freeCashFlowPerShareAnnual?: number;
    marketCapitalization?: number;
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    beta?: number;
  };
  series?: {
    annual?: {
      netIncomePerShare?: Array<{ period: string; v: number }>;
    };
  };
}

function findRevenue(ic: FhXbrlItem[]): number | null {
  const prefixes = [
    "net revenue",
    "total revenues",
    "total net revenues",
    "revenues",
    "revenue",
    "net sales",
    "total net sales",
    "sales",
  ];
  for (const p of prefixes) {
    const item = ic.find((x) => {
      if (x.value === null) return false;
      const l = x.label.toLowerCase().trim();
      return (
        l === p ||
        (l.startsWith(p) && !/(other|cost|segment|deferred|service|products|contract)/.test(l))
      );
    });
    if (item) return item.value as number;
  }
  return null;
}

function findNetIncome(ic: FhXbrlItem[]): number | null {
  // Try exact "net income" first, then "net income (loss)" variants
  const patterns = [
    /^net income$/i,
    /^net income \(loss\)$/i,
    /^net income \/ \(loss\)$/i,
    /^net income attributable/i,
    /^net (earnings|profit)/i,
  ];
  for (const pat of patterns) {
    const item = ic.find((x) => x.value !== null && pat.test(x.label.trim()));
    if (item) return item.value as number;
  }
  // Broader fallback: starts with "net income"
  const item = ic.find(
    (x) => x.value !== null && x.label.toLowerCase().trimStart().startsWith("net income")
  );
  return item ? (item.value as number) : null;
}

function findTotalDebt(bs: FhXbrlItem[]): number {
  const shortMatch = bs.find(
    (x) => x.value !== null && /^(short.?term debt|current debt)$/i.test(x.label.trim())
  );
  const longMatch = bs.find(
    (x) => x.value !== null && /^long.?term debt$/i.test(x.label.trim())
  );
  return ((shortMatch?.value ?? 0) as number) + ((longMatch?.value ?? 0) as number);
}

function findOpCashFlow(cf: FhXbrlItem[]): number | null {
  const keywords = [
    "net cash provided by operating",
    "net cash from operating",
    "cash provided by operating",
    "net cash generated from operating",
    "operating activities",
  ];
  for (const kw of keywords) {
    const item = cf.find(
      (x) => x.value !== null && x.label.toLowerCase().includes(kw)
    );
    if (item) return item.value as number;
  }
  return null;
}

function findGrossProfit(ic: FhXbrlItem[]): number | null {
  const exact = ic.find(
    (x) => x.value !== null && /^gross profit$/i.test(x.label.trim())
  );
  if (exact) return exact.value as number;
  const fallback = ic.find(
    (x) =>
      x.value !== null &&
      x.label.toLowerCase().includes("gross profit") &&
      !x.label.toLowerCase().includes("ratio")
  );
  return fallback ? (fallback.value as number) : null;
}

// ---- Sector mapping (Finnhub only provides finnhubIndustry, not a broad sector) ----

function mapIndustryToSector(industry: string): string {
  const i = industry.toLowerCase();
  if (/semiconductor|software|hardware|technology|internet|computer|telecom|cloud|data|chip|electronic/i.test(industry)) return "Technology";
  if (/bank|capital market|insurance|financial|invest|asset management|brokerage|payment/i.test(industry)) return "Finance";
  if (/pharma|biotech|medical|health|hospital|clinical|therapeutic/i.test(industry)) return "Healthcare";
  if (/oil|gas|energy|petroleum|coal|renewable/i.test(industry)) return "Energy";
  if (/food|beverage|retail|consumer|restaurant|hotel|leisure|media|entertainment|apparel|fashion/i.test(industry)) return "Consumer";
  if (/aerospace|defense|machinery|transportation|logistics|construction|industrial|manufactur/i.test(industry)) return "Industrial";
  if (/real estate|reit|property/i.test(industry)) return "Real Estate";
  if (/utility|utilities|electric|water|natural gas distribution/i.test(industry)) return "Utilities";
  if (/material|mining|chemical|metal|steel|aluminum/i.test(industry)) return "Materials";
  return industry;
}

// ---- Exported types (shape kept stable so callers don't need changes) ----

export interface FmpProfile {
  symbol: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  currency: string;
  website: string;
}

export interface FmpIncome {
  date: string;
  revenue: number;
  netIncome: number;
  grossProfit: number;
}

export interface FmpBalance {
  date: string;
  totalDebt: number;
  cashAndCashEquivalents: number;
}

export interface FmpCashFlow {
  date: string;
  operatingCashFlow: number;
  freeCashFlow: number;
}

export interface FmpNews {
  title: string;
  text: string;
  publishedDate: string;
  site: string;
  url: string;
}

export interface FmpPoliticianTrade {
  firstName?: string;
  lastName?: string;
  office?: string;
  representative?: string;
  type?: string;
  transactionDate?: string;
  dateRecieved?: string;
  amount?: string;
  party?: string;
  symbol?: string;
}

export interface FinnhubFinancials {
  income: FmpIncome | null;
  balance: FmpBalance | null;
  cashflow: FmpCashFlow | null;
}

// ---- Finnhub: company profile ----

export async function getProfile(ticker: string): Promise<FmpProfile | null> {
  const data = await fhGet<FhProfile2>(`/stock/profile2?symbol=${ticker}`);
  if (!data || !data.name) return null;

  const industry = data.finnhubIndustry || "";
  const mappedSector = data.gicsSector || data.sector || mapIndustryToSector(industry);

  return {
    symbol: ticker,
    companyName: data.name,
    description: data.description || "",
    sector: mappedSector,
    industry: mappedSector !== industry ? industry : "",
    marketCap: (data.marketCapitalization || 0) * 1_000_000, // Finnhub gives in millions
    price: 0,
    currency: data.currency || "USD",
    website: data.weburl || "",
  };
}

// CEO name comes from FMP's profile endpoint (Finnhub profile2 has no CEO).
// FMP free tier restricts this to popular tickers — returns null elsewhere.
export async function getCeo(ticker: string): Promise<string | null> {
  const data = await fmpGet<Array<{ ceo?: string }>>(`/profile?symbol=${ticker}`);
  return data?.[0]?.ceo || null;
}

// Company description from FMP (works for mega-cap tickers on the free plan).
// Returns empty string if not available — callers fall back to AI generation.
export async function getCompanyDescription(ticker: string): Promise<string> {
  const data = await fmpGet<Array<{ description?: string }>>(`/profile?symbol=${ticker}`);
  return data?.[0]?.description?.trim() || "";
}

// ---- Finnhub: financial statements (one API call, three datasets) ----
// Use getFinancials() in the analyze route to avoid 3 separate calls.

export async function getFinancials(ticker: string): Promise<FinnhubFinancials> {
  const raw = await fhGet<FhFinancialsReported>(
    `/stock/financials-reported?symbol=${ticker}&freq=annual`
  );

  if (!raw?.data?.length) {
    return { income: null, balance: null, cashflow: null };
  }

  // Try up to the first 3 report entries so companies with sparse first-entry data still yield values.
  let income: FmpIncome | null = null;
  let balance: FmpBalance | null = null;
  let cashflow: FmpCashFlow | null = null;

  for (const entry of raw.data.slice(0, 3)) {
    if (!entry.report) continue;
    const { ic, bs, cf } = entry.report;

    if (!income) {
      const revenue = findRevenue(ic);
      const netIncome = findNetIncome(ic);
      const grossProfit = findGrossProfit(ic);
      if (revenue !== null || netIncome !== null) {
        income = { date: "", revenue: revenue ?? 0, netIncome: netIncome ?? 0, grossProfit: grossProfit ?? 0 };
      }
    }

    if (!balance) {
      const totalDebt = findTotalDebt(bs);
      balance = { date: "", totalDebt, cashAndCashEquivalents: 0 };
    }

    if (!cashflow) {
      const opCF = findOpCashFlow(cf);
      if (opCF !== null) {
        cashflow = { date: "", operatingCashFlow: opCF, freeCashFlow: 0 };
      }
    }

    if (income && balance && cashflow) break;
  }

  return { income, balance, cashflow };
}

// ---- Finnhub: basic metrics (for screener and financial fallbacks) ----

export interface FinnhubMetricsSummary {
  netProfitMarginAnnual: number | null;
  revenuePerShareAnnual: number | null;
  operatingCashFlowPerShareAnnual: number | null;
  marketCapM: number | null; // in millions
}

export async function getMetrics(ticker: string): Promise<FinnhubMetricsSummary> {
  const raw = await fhGet<FhMetrics>(`/stock/metric?symbol=${ticker}&metric=all`);
  if (!raw?.metric) {
    return { netProfitMarginAnnual: null, revenuePerShareAnnual: null, operatingCashFlowPerShareAnnual: null, marketCapM: null };
  }
  const m = raw.metric;
  return {
    netProfitMarginAnnual: m.netProfitMarginAnnual ?? null,
    revenuePerShareAnnual: m.revenuePerShareAnnual ?? null,
    operatingCashFlowPerShareAnnual: m.operatingCashFlowPerShareAnnual ?? null,
    marketCapM: m.marketCapitalization ?? null,
  };
}

// ---- Finnhub: news ----

interface FinnhubNewsItem {
  headline: string;
  summary: string;
  datetime: number;
  source: string;
  url: string;
}

export async function getNews(
  ticker: string,
  companyName: string,
  limit = 6
): Promise<FmpNews[]> {
  try {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `${FH_BASE}/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${finnhubKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubNewsItem[];

    const tickerLower = ticker.toLowerCase();
    const nameWords = companyName
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter((w) => w.length > 3);

    return data
      .filter((n) => {
        const text = `${n.headline} ${n.summary}`.toLowerCase();
        if (text.includes(tickerLower)) return true;
        return nameWords.some((w) => text.includes(w));
      })
      .slice(0, limit)
      .map((n) => ({
        title: n.headline,
        text: n.summary,
        publishedDate: new Date(n.datetime * 1000).toISOString(),
        site: n.source,
        url: n.url,
      }));
  } catch {
    return [];
  }
}

export async function getGeneralNews(limit = 20): Promise<FmpNews[]> {
  try {
    const url = `${FH_BASE}/news?category=general&token=${finnhubKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubNewsItem[];
    return data.slice(0, limit).map((n) => ({
      title: n.headline,
      text: n.summary,
      publishedDate: new Date(n.datetime * 1000).toISOString(),
      site: n.source,
      url: n.url,
    }));
  } catch {
    return [];
  }
}

// News item carrying the market-day (America/New_York) it was published on, so
// callers can align it to Twelve Data's ET-dated price bars instead of the raw
// UTC date. `etDate` is what should be compared against a trading-day string.
export interface DatedNews {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedDate: string; // ISO UTC instant
  etDate: string; // YYYY-MM-DD in America/New_York
}

// Fetch company news in a ±windowDays window around `date` and return it
// ET-aligned and sorted by proximity to that date (closest first). Unlike the
// old version this does NOT blindly slice the raw feed — a wider `from..to`
// window meant the newest 10 items could all fall on the far edge, dropping the
// same-day catalyst. We sort by day-distance first, then recency, then cap.
export async function getNewsAroundDate(
  ticker: string,
  date: string,
  windowDays = 4
): Promise<DatedNews[]> {
  const center = new Date(`${date}T12:00:00Z`);
  // Pad the fetch window by a day on each side: an article published late ET on
  // day D can carry a UTC date of D+1, so a tight UTC from..to could miss it.
  const from = new Date(center);
  from.setDate(from.getDate() - windowDays - 1);
  const to = new Date(center);
  to.setDate(to.getDate() + windowDays + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const url = `${FH_BASE}/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${finnhubKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubNewsItem[];
    if (!Array.isArray(data)) return [];

    const dayMs = 24 * 60 * 60 * 1000;
    const dist = (etDate: string) =>
      Math.abs(new Date(`${etDate}T12:00:00Z`).getTime() - center.getTime()) / dayMs;

    return data
      .filter((n) => n.headline)
      .map((n) => ({
        title: n.headline,
        summary: n.summary,
        source: n.source,
        url: n.url,
        publishedDate: new Date(n.datetime * 1000).toISOString(),
        etDate: etDateFromUnix(n.datetime),
      }))
      .filter((n) => dist(n.etDate) <= windowDays)
      .sort((a, b) => {
        const da = dist(a.etDate);
        const db = dist(b.etDate);
        if (da !== db) return da - db; // closest to the move first
        return a.publishedDate < b.publishedDate ? 1 : -1; // then newest
      })
      .slice(0, 25);
  } catch {
    return [];
  }
}

// ---- Finnhub: analyst recommendations ----

interface FhRecommendation {
  symbol: string;
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export async function getAnalystRecommendations(ticker: string) {
  const data = await fhGet<FhRecommendation[]>(`/stock/recommendation?symbol=${ticker}`);
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  // Most recent period first
  const sorted = [...data].sort((a, b) => (a.period > b.period ? -1 : 1));
  const latest = sorted[0];
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return null;
  return {
    period: latest.period,
    strongBuy: latest.strongBuy,
    buy: latest.buy,
    hold: latest.hold,
    sell: latest.sell,
    strongSell: latest.strongSell,
    total,
    bullPct: +((( latest.strongBuy + latest.buy) / total) * 100).toFixed(1),
    holdPct: +((latest.hold / total) * 100).toFixed(1),
    bearPct: +((( latest.sell + latest.strongSell) / total) * 100).toFixed(1),
    // Second most recent for trend detection in timeline
    prev: sorted[1] ?? null,
  };
}

// ---- Finnhub: reported earnings history (actual vs estimate) ----
// Historical quarterly EPS actuals with surprise. `period` is the report date
// (YYYY-MM-DD). Shared by the timeline and the price-move explainer so both
// read earnings from one place.

interface FhEarningsRow {
  symbol: string;
  period: string;
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

export interface EarningsEvent {
  period: string; // YYYY-MM-DD reporting date
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
  beat: boolean | null;
}

export async function getEarningsHistory(ticker: string): Promise<EarningsEvent[]> {
  const data = await fhGet<FhEarningsRow[]>(`/stock/earnings?symbol=${ticker}`);
  if (!Array.isArray(data)) return [];
  return data
    .filter((e) => e.period)
    .map((e) => ({
      period: e.period,
      year: e.year,
      quarter: e.quarter,
      actual: e.actual,
      estimate: e.estimate,
      surprisePercent: e.surprisePercent,
      beat: e.surprise !== null ? e.surprise >= 0 : null,
    }));
}

// ---- Finnhub: insider transactions ----

interface FhInsiderTx {
  name: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
  id: string;
  symbol: string;
  isDerivative: boolean;
}

const INSIDER_CODE_LABELS: Record<string, string> = {
  P: "Purchase",
  S: "Sale",
  F: "Tax withholding",
  G: "Gift",
  M: "Option exercise",
  A: "Award",
  D: "Disposition",
};

export async function getInsiderTransactions(ticker: string, limit = 10) {
  const raw = await fhGet<{ data: FhInsiderTx[] }>(`/stock/insider-transactions?symbol=${ticker}`);
  if (!raw?.data?.length) return null;

  // Only non-derivative open-market transactions
  const filtered = raw.data
    .filter((t) => !t.isDerivative && t.transactionDate)
    .slice(0, limit);

  const transactions = filtered.map((t) => ({
    name: toTitleCase(t.name),
    transactionCode: t.transactionCode,
    transactionType: INSIDER_CODE_LABELS[t.transactionCode] ?? t.transactionCode,
    shares: Math.abs(t.change),
    pricePerShare: t.transactionPrice > 0 ? t.transactionPrice : null,
    value: t.transactionPrice > 0 ? Math.abs(t.change) * t.transactionPrice : null,
    date: t.transactionDate,
  }));

  const netShares = filtered.reduce((sum, t) => sum + t.change, 0);

  return { transactions, netShares };
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- Finnhub: peer companies ----

export async function getPeers(ticker: string): Promise<string[]> {
  const data = await fhGet<string[]>(`/stock/peers?symbol=${ticker}`);
  if (!Array.isArray(data)) return [];
  // Exclude the ticker itself from its own peer list
  return data.filter((p) => p !== ticker).slice(0, 10);
}

// ---- FMP: Senate trades via /stable/senate-latest (market-wide feed, free plan) ----
// The eFTS Senate search domain (efts.senate.gov) is dead/NXDOMAIN.
// FMP's senate-latest endpoint returns all recent Senate PTR filings — we cache
// the full response for 15 minutes and filter client-side by ticker.

interface FmpSenateLatest {
  symbol?: string;
  firstName?: string;
  lastName?: string;
  office?: string;
  transactionDate?: string;
  disclosureDate?: string;
  type?: string;
  amount?: string;
  assetType?: string;
  party?: string;
}

let _senateLatestCache: { data: FmpSenateLatest[]; at: number } | null = null;
const SENATE_CACHE_MS = 15 * 60 * 1000; // 15 minutes

async function fetchSenateLatest(): Promise<FmpSenateLatest[]> {
  if (_senateLatestCache && Date.now() - _senateLatestCache.at < SENATE_CACHE_MS) {
    return _senateLatestCache.data;
  }
  // Fetch two pages to get broader coverage; free tier caps each page at 25
  const [page0, page1] = await Promise.all([
    fmpGet<FmpSenateLatest[]>(`/senate-latest?page=0&limit=25`),
    fmpGet<FmpSenateLatest[]>(`/senate-latest?page=1&limit=25`),
  ]);
  const combined = [
    ...(Array.isArray(page0) ? page0 : []),
    ...(Array.isArray(page1) ? page1 : []),
  ];
  _senateLatestCache = { data: combined, at: Date.now() };
  return combined;
}

function senateLatestToTrade(t: FmpSenateLatest): FmpPoliticianTrade {
  return {
    firstName: t.firstName,
    lastName: t.lastName,
    office: t.office,
    representative: [t.firstName, t.lastName].filter(Boolean).join(" ") || t.office,
    transactionDate: t.transactionDate,
    dateRecieved: t.disclosureDate,
    type: t.type,
    amount: t.amount,
    party: t.party,
    symbol: t.symbol,
  };
}

async function getSenateTrades(ticker: string): Promise<FmpPoliticianTrade[]> {
  const all = await fetchSenateLatest();
  const tickerUpper = ticker.toUpperCase();
  return all
    .filter(
      (t) =>
        t.symbol?.toUpperCase() === tickerUpper &&
        (!t.assetType || /stock|equit|securit|option/i.test(t.assetType))
    )
    .map(senateLatestToTrade);
}

// ---- Politician trades (Senate via FMP, house always empty) ----

export async function getPoliticianTrades(ticker: string) {
  const senate = await getSenateTrades(ticker);
  return {
    senate,
    house: [],
  };
}

// ---- Recent Senate trades across all tickers (from the cached market-wide feed) ----

export interface RecentSenateTrade {
  name: string;
  ticker: string;
  type: string;
  amount: string;
  date: string;
}

export async function getRecentSenateTrades(
  limit = 3,
  tickers?: string[]
): Promise<RecentSenateTrade[]> {
  const all = await fetchSenateLatest();

  const filtered = all
    .filter((t) => {
      if (!t.symbol || !/^[A-Z.\-]{1,10}$/.test(t.symbol)) return false;
      if (!t.transactionDate && !t.disclosureDate) return false;
      if (tickers && !tickers.includes(t.symbol.toUpperCase())) return false;
      if (t.assetType && !/stock|equit|securit|option/i.test(t.assetType)) return false;
      return true;
    })
    .map((t) => ({
      name:
        [t.firstName, t.lastName].filter(Boolean).join(" ") ||
        t.office ||
        "Unknown senator",
      ticker: t.symbol!,
      type: t.type || "Unknown",
      amount: t.amount || "Not disclosed",
      date: (t.transactionDate || t.disclosureDate)!,
    }));

  filtered.sort((a, b) => (a.date < b.date ? 1 : -1));

  // De-dupe identical name+ticker+date+type rows
  const seen = new Set<string>();
  const out: RecentSenateTrade[] = [];
  for (const t of filtered) {
    const key = `${t.name}|${t.ticker}|${t.date}|${t.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

// ---- Latest Senate trades (market-wide, used by intelligence hub) ----
// Uses the same cached senate-latest feed.

export async function getLatestSenateTrades(limit = 5): Promise<RecentSenateTrade[]> {
  return getRecentSenateTrades(limit);
}

// ---- Finnhub: real-time quote ----

interface FhQuote {
  c: number;  // current price
  d: number;  // change
  dp: number; // percent change
  h: number;
  l: number;
  o: number;
  pc: number; // previous close
}

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  const q = await fhGet<FhQuote>(`/quote?symbol=${ticker}`);
  if (!q || typeof q.c !== "number" || q.c === 0) return null;
  return { price: q.c, change: q.d ?? 0, changePercent: q.dp ?? 0 };
}

// ---- Finnhub: earnings calendar ----

interface FhEarningsCalendar {
  earningsCalendar?: Array<{
    date: string;
    epsEstimate: number | null;
    hour: string; // "bmo" | "amc" | "dmh" | ""
    quarter: number;
    symbol: string;
    year: number;
  }>;
}

export interface UpcomingEarnings {
  ticker: string;
  date: string;
  hour: string; // "BMO" | "AMC" | ""
  epsEstimate: number | null;
}

export async function getUpcomingEarnings(
  tickers: string[],
  daysAhead = 45
): Promise<UpcomingEarnings[]> {
  if (tickers.length === 0) return [];
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const results = await Promise.all(
    tickers.map((t) =>
      fhGet<FhEarningsCalendar>(
        `/calendar/earnings?from=${from}&to=${to}&symbol=${t}`
      ).catch(() => null)
    )
  );
  const out: UpcomingEarnings[] = [];
  results.forEach((r, i) => {
    const entries = (r?.earningsCalendar ?? []).filter((e) => e.date);
    if (entries.length === 0) return;
    // earliest upcoming report, regardless of response ordering
    const first = entries.reduce((a, b) => (a.date <= b.date ? a : b));
    out.push({
      ticker: tickers[i],
      date: first.date,
      hour: first.hour === "bmo" ? "BMO" : first.hour === "amc" ? "AMC" : "",
      epsEstimate: first.epsEstimate ?? null,
    });
  });
  out.sort((a, b) => (a.date > b.date ? 1 : -1));
  return out;
}

// ---- Formatting helpers ----

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "Data not available";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "Data not available";
  return `${(n * 100).toFixed(1)}%`;
}
