// SEC EDGAR wrapper. Used to resolve a ticker to its CIK and to surface
// links to the company's official filings (10-K / 10-Q) as sources.
//
// SEC requires a descriptive User-Agent header with contact info on every
// request, or it will return 403. Set SEC_USER_AGENT in your env.

const HEADERS: HeadersInit = {
  "User-Agent": process.env.SEC_USER_AGENT || "StockLens example@example.com",
  Accept: "application/json",
};

interface TickerMapEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

// Pad CIK to the 10-digit form EDGAR uses in its data URLs.
function padCik(cik: number): string {
  return String(cik).padStart(10, "0");
}

// Resolve a ticker to its CIK using SEC's published mapping file.
export async function getCik(ticker: string): Promise<number | null> {
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: HEADERS,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const map = (await res.json()) as Record<string, TickerMapEntry>;
    const upper = ticker.toUpperCase();
    for (const entry of Object.values(map)) {
      if (entry.ticker?.toUpperCase() === upper) return entry.cik_str;
    }
    return null;
  } catch {
    return null;
  }
}

export interface EdgarFiling {
  form: string; // "10-K", "10-Q", ...
  filingDate: string;
  url: string;
}

// Return the few most recent annual/quarterly filings with direct links.
export async function getRecentFilings(
  cik: number,
  limit = 3
): Promise<EdgarFiling[]> {
  try {
    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      filings?: {
        recent?: {
          form: string[];
          filingDate: string[];
          accessionNumber: string[];
          primaryDocument: string[];
        };
      };
    };
    const recent = data.filings?.recent;
    if (!recent) return [];

    const out: EdgarFiling[] = [];
    for (let i = 0; i < recent.form.length && out.length < limit; i++) {
      const form = recent.form[i];
      if (form === "10-K" || form === "10-Q") {
        const accession = recent.accessionNumber[i].replace(/-/g, "");
        const doc = recent.primaryDocument[i];
        out.push({
          form,
          filingDate: recent.filingDate[i],
          url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${doc}`,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Human-friendly EDGAR landing page for the company.
export function edgarBrowsePage(cik: number): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padCik(
    cik
  )}&type=10-K&dateb=&owner=include&count=10`;
}
