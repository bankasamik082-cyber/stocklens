import { NextRequest, NextResponse } from "next/server";

const TD_BASE = "https://api.twelvedata.com";

// US-listed instruments worth surfacing in autocomplete
const US_INSTRUMENT_TYPES = new Set([
  "Common Stock",
  "ETF",
  "REIT",
]);
const PREF_TYPES = new Set(["Common Stock", "REIT"]);
const PREF_EXCHANGES = new Set(["NASDAQ", "NYSE", "NYSE MKT", "AMEX"]);

interface TdSymbolResult {
  symbol: string;
  instrument_name: string;
  exchange: string;
  country: string;
  currency: string;
  instrument_type: string;
}

interface TdSymbolSearchResponse {
  data: TdSymbolResult[];
  status?: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json({ results: [] });

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${TD_BASE}/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = (await res.json()) as TdSymbolSearchResponse;
    if (data?.status === "error" || !Array.isArray(data?.data)) {
      return NextResponse.json({ results: [] });
    }

    const qUpper = q.toUpperCase();
    const results = data.data
      .filter(
        (r) =>
          r.country === "United States" &&
          r.currency === "USD" &&
          US_INSTRUMENT_TYPES.has(r.instrument_type)
      )
      .sort((a, b) => {
        // Exact symbol match first
        const aExact = a.symbol === qUpper ? 0 : 1;
        const bExact = b.symbol === qUpper ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        // Common Stock / REIT before ETFs
        const aPref = PREF_TYPES.has(a.instrument_type) ? 0 : 1;
        const bPref = PREF_TYPES.has(b.instrument_type) ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;
        // NASDAQ / NYSE before smaller exchanges
        const aExch = PREF_EXCHANGES.has(a.exchange) ? 0 : 1;
        const bExch = PREF_EXCHANGES.has(b.exchange) ? 0 : 1;
        return aExch - bExch;
      })
      .slice(0, 8)
      .map((r) => ({ symbol: r.symbol, name: r.instrument_name, exchange: r.exchange }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
