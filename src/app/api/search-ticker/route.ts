import { NextRequest, NextResponse } from "next/server";

interface FmpSearchResult {
  symbol: string;
  name: string;
  currency: string;
  exchangeFullName: string;
  exchange: string;
}

const US_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "CBOE", "BATS", "ARCA", "NYSEARCA"]);
const PREF_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX"]);

async function fmpSearch(endpoint: string, q: string, apiKey: string): Promise<FmpSearchResult[]> {
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/${endpoint}?query=${encodeURIComponent(q)}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // FMP returns HTTP 200 with {"Error Message": "..."} when rate-limited
    if (!Array.isArray(data)) return [];
    return data as FmpSearchResult[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FMP_API_KEY not set" }, { status: 500 });
  }

  // Call both endpoints in parallel:
  // - search-symbol: ticker-prefix match (AAPL → AAPL)
  // - search-name:   company-name match (apple → AAPL, nvidia → NVDA)
  const [bySymbol, byName] = await Promise.all([
    fmpSearch("search-symbol", q, apiKey),
    fmpSearch("search-name", q.toLowerCase(), apiKey),
  ]);

  // Merge, deduplicate by symbol (symbol results take priority for ordering)
  const seen = new Set<string>();
  const merged: FmpSearchResult[] = [];
  for (const r of [...bySymbol, ...byName]) {
    if (!seen.has(r.symbol)) {
      seen.add(r.symbol);
      merged.push(r);
    }
  }

  // Filter to USD + US exchanges
  const filtered = merged.filter(
    (r) => r.currency === "USD" && US_EXCHANGES.has(r.exchange)
  );

  // Sort: preferred exchanges (NASDAQ/NYSE/AMEX) first, then exact symbol match boost
  const qUpper = q.toUpperCase();
  filtered.sort((a, b) => {
    const aExact = a.symbol === qUpper ? 0 : 1;
    const bExact = b.symbol === qUpper ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aPref = PREF_EXCHANGES.has(a.exchange) ? 0 : 1;
    const bPref = PREF_EXCHANGES.has(b.exchange) ? 0 : 1;
    return aPref - bPref;
  });

  const results = filtered
    .slice(0, 8)
    .map((r) => ({ symbol: r.symbol, name: r.name, exchange: r.exchange }));

  return NextResponse.json({ results });
}
