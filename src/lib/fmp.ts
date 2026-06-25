// Thin wrapper around the Financial Modeling Prep (FMP) REST API + Finnhub for news.
// Docs: https://site.financialmodelingprep.com/developer/docs
//
// Notes:
// - Some endpoints (senate / house trading) require a paid FMP plan.
//   Every fetch here fails soft: on error it returns null/empty so the
//   report can still render with whatever data is available.
// - We return the exact request URL (minus the API key) as a "source"
//   so the report can cite where each number came from.

const BASE = "https://financialmodelingprep.com/stable";

function key() {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set");
  return k;
}

// Build a URL that is safe to show as a source (api key stripped).
export function publicUrl(path: string): string {
  return `${BASE}${path}`;
}

async function get<T>(path: string): Promise<T | null> {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}apikey=${key()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    // FMP returns HTTP 200 with {"Error Message": "..."} when rate-limited or
    // when a plan limit is hit — treat this as a soft failure, same as !res.ok.
    if (data && typeof data === "object" && !Array.isArray(data) && "Error Message" in data) {
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

// ---- Types for the bits of the FMP responses we use ----
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

// ---- Finnhub (used for per-ticker company news + general market news) ----
interface FinnhubNewsItem {
  headline: string;
  summary: string;
  datetime: number; // unix seconds
  source: string;
  url: string;
}

function finnhubKey() {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY is not set");
  return k;
}

export function finnhubPublicUrl(path: string): string {
  return `https://finnhub.io/api/v1${path}`;
}

export async function getNews(
  ticker: string,
  companyName: string,
  limit = 6
): Promise<FmpNews[]> {
  try {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 14); // last 2 weeks of news

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(
      from
    )}&to=${fmt(to)}&token=${finnhubKey()}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubNewsItem[];

    // Finnhub's free company-news feed sometimes includes loosely-related
    // market stories. Keep only articles that actually mention the ticker
    // or company name so the section stays relevant.
    const tickerLower = ticker.toLowerCase();
    const nameWords = companyName
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter((w) => w.length > 3); // skip short filler words like "inc", "the"

    const isRelevant = (n: FinnhubNewsItem) => {
      const text = `${n.headline} ${n.summary}`.toLowerCase();
      if (text.includes(tickerLower)) return true;
      return nameWords.some((w) => text.includes(w));
    };

    const filtered = data.filter(isRelevant);

    return filtered.slice(0, limit).map((n) => ({
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

// General top market headlines, not tied to any specific ticker.
// Used by the standalone Market News page.
export async function getGeneralNews(limit = 20): Promise<FmpNews[]> {
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey()}`;
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

export async function getProfile(ticker: string) {
  const data = await get<FmpProfile[]>(`/profile?symbol=${ticker}`);
  return data && data.length ? data[0] : null;
}

export async function getIncome(ticker: string) {
  const data = await get<FmpIncome[]>(
    `/income-statement?symbol=${ticker}&period=annual&limit=1`
  );
  return data && data.length ? data[0] : null;
}

export async function getBalance(ticker: string) {
  const data = await get<FmpBalance[]>(
    `/balance-sheet-statement?symbol=${ticker}&period=annual&limit=1`
  );
  return data && data.length ? data[0] : null;
}

export async function getCashFlow(ticker: string) {
  const data = await get<FmpCashFlow[]>(
    `/cash-flow-statement?symbol=${ticker}&period=annual&limit=1`
  );
  return data && data.length ? data[0] : null;
}

export interface FmpHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

// Returns up to `days` of daily EOD prices, sorted oldest-first.
// The stable endpoint returns an array (or occasionally wraps in { historical }).
export async function getHistoricalPrices(
  ticker: string,
  days = 365
): Promise<FmpHistoricalPrice[]> {
  type Resp = FmpHistoricalPrice[] | { historical?: FmpHistoricalPrice[] };
  const raw = await get<Resp>(`/historical-price-eod/full?symbol=${ticker}`);
  if (!raw) return [];
  const arr: FmpHistoricalPrice[] = Array.isArray(raw)
    ? (raw as FmpHistoricalPrice[])
    : ((raw as { historical?: FmpHistoricalPrice[] }).historical ?? []);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return arr
    .filter((p) => p.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Finnhub company-news for a ±windowDays window around a specific date.
export async function getNewsAroundDate(
  ticker: string,
  date: string,
  windowDays = 5
): Promise<FmpNews[]> {
  const center = new Date(`${date}T12:00:00Z`);
  const from = new Date(center);
  from.setDate(from.getDate() - windowDays);
  const to = new Date(center);
  to.setDate(to.getDate() + windowDays);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${finnhubKey()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubNewsItem[];
    return data.slice(0, 10).map((n) => ({
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

// Politician trading. We try Senate then House and merge whatever returns.
export async function getPoliticianTrades(ticker: string) {
  const [senate, house] = await Promise.all([
    get<FmpPoliticianTrade[]>(`/senate-trades?symbol=${ticker}`),
    get<FmpPoliticianTrade[]>(`/house-trades?symbol=${ticker}`),
  ]);
  return {
    senate: senate ?? [],
    house: house ?? [],
  };
}

// ---- formatting helpers ----
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