// Data layer: Finnhub (profile + financials + news) + FMP (politician trades only).
//
// FMP free tier restricts income/balance/cashflow to a handful of mega-cap demo tickers
// (returns HTTP 402 for everything else). Profile and financial statements now come from
// Finnhub's free tier instead. FMP is kept only for senate-trades and house-trades.
//
// Finnhub financials-reported returns XBRL-labeled arrays — labels vary by company, so
// we do prefix/substring matching rather than fixed field names.

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
}

function findRevenue(ic: FhXbrlItem[]): number | null {
  const prefixes = [
    "net revenue",
    "total revenues",
    "total net revenues",
    "revenues",
    "revenue",
    "net sales",
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
  ];
  for (const kw of keywords) {
    const item = cf.find(
      (x) => x.value !== null && x.label.toLowerCase().includes(kw)
    );
    if (item) return item.value as number;
  }
  return null;
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
  return {
    symbol: ticker,
    companyName: data.name,
    description: "",
    sector: data.finnhubIndustry || "",
    industry: data.finnhubIndustry || "",
    marketCap: (data.marketCapitalization || 0) * 1_000_000, // Finnhub gives in millions
    price: 0,
    currency: data.currency || "USD",
    website: data.weburl || "",
  };
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

  const report = raw.data[0].report;
  const { ic, bs, cf } = report;

  const revenue = findRevenue(ic);
  const netIncome = findNetIncome(ic);

  const income: FmpIncome | null =
    revenue !== null || netIncome !== null
      ? { date: "", revenue: revenue ?? 0, netIncome: netIncome ?? 0, grossProfit: 0 }
      : null;

  const totalDebt = findTotalDebt(bs);
  const balance: FmpBalance = { date: "", totalDebt, cashAndCashEquivalents: 0 };

  const opCF = findOpCashFlow(cf);
  const cashflow: FmpCashFlow | null =
    opCF !== null ? { date: "", operatingCashFlow: opCF, freeCashFlow: 0 } : null;

  return { income, balance, cashflow };
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
    const url = `${FH_BASE}/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${finnhubKey()}`;
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

// ---- FMP: politician trades (only FMP usage remaining) ----

export async function getPoliticianTrades(ticker: string) {
  const [senate, house] = await Promise.all([
    fmpGet<FmpPoliticianTrade[]>(`/senate-trades?symbol=${ticker}`),
    fmpGet<FmpPoliticianTrade[]>(`/house-trades?symbol=${ticker}`),
  ]);
  return {
    senate: senate ?? [],
    house: house ?? [],
  };
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
