import { NextRequest, NextResponse } from "next/server";

interface FmpSearchResult {
  symbol: string;
  name: string;
  currency: string;
  exchangeFullName: string;
  exchange: string;
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

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = (await res.json()) as FmpSearchResult[];

    // Keep USD-denominated securities on major US exchanges only
    const US_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "CBOE", "BATS", "ARCA", "NYSEARCA"]);
    const results = data
      .filter((r) => r.currency === "USD" && US_EXCHANGES.has(r.exchange))
      .slice(0, 8)
      .map((r) => ({ symbol: r.symbol, name: r.name, exchange: r.exchange }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
