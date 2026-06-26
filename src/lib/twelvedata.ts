// Twelve Data API wrapper — free tier supports time_series and symbol_search.
// Docs: https://twelvedata.com/docs
//
// Financial statements (income, balance, cash flow) and profiles are Pro+ only,
// so those remain on FMP. Free tier: 800 calls/day, 8 req/min.

const TD_BASE = "https://api.twelvedata.com";

function tdKey(): string {
  const k = process.env.TWELVE_DATA_API_KEY;
  if (!k) throw new Error("TWELVE_DATA_API_KEY is not set");
  return k;
}

export function tdPublicUrl(path: string): string {
  return `${TD_BASE}${path}`;
}

async function tdGet<T>(path: string): Promise<T | null> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TD_BASE}${path}${sep}apikey=${tdKey()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    // TD returns { code: 4xx, status: "error", message: "..." } for paid-only endpoints
    if (data && typeof data === "object" && data.status === "error") return null;
    return data as T;
  } catch {
    return null;
  }
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface TdTimeSeriesResponse {
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
}

// Returns `days` trading days of daily OHLC, oldest-first.
// change and changePercent are calculated from consecutive closes.
export async function getHistoricalPrices(
  ticker: string,
  days = 365
): Promise<HistoricalPrice[]> {
  // Fetch one extra data point so we can compute change for the first visible day
  const raw = await tdGet<TdTimeSeriesResponse>(
    `/time_series?symbol=${ticker}&interval=1day&outputsize=${days + 1}`
  );
  if (!raw || !Array.isArray(raw.values) || raw.values.length < 2) return [];

  // Twelve Data returns newest-first; reverse to oldest-first for chart
  const vals = [...raw.values].reverse();

  // Slice off the extra leading point after computing deltas
  return vals.slice(1).map((v, i) => {
    const prevClose = parseFloat(vals[i].close);
    const close = parseFloat(v.close);
    const change = +(close - prevClose).toFixed(4);
    const changePercent = +(((close - prevClose) / prevClose) * 100).toFixed(4);
    return {
      date: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close,
      volume: parseInt(v.volume, 10),
      change,
      changePercent,
    };
  });
}
