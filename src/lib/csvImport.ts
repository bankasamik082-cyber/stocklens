// Flexible broker CSV parsing for portfolio import.
// Handles Robinhood, Schwab, Fidelity, E*Trade export formats:
//  - preamble lines before the real header (Schwab/Fidelity)
//  - quoted fields containing commas ("1,234.56")
//  - varying column names for ticker / shares / cost
//  - non-position rows (cash sweep, totals, disclaimers)

export interface ParsedHolding {
  ticker: string;
  shares: number;
  avg_cost: number | null;
}

export interface ParseResult {
  rows: ParsedHolding[];
  skipped: number;
  detected: { ticker: string; shares: string; cost: string | null } | null;
  error?: string;
}

const TICKER_HEADERS = /^(symbol|ticker|instrument|stock ?symbol|security ?id)$/i;
const SHARES_HEADERS = /^(qty|quantity|shares|share ?qty|qty ?\(quantity\)|number ?of ?shares|qty #?)$/i;
const COST_HEADERS =
  /^(average ?cost( basis)?( per share)?|avg ?cost( per share)?|avg\.? ?price|average ?price( paid)?|average_buy_price|price ?paid ?\$?|cost ?basis ?per ?share|cost\/share|purchase ?price|unit ?cost)$/i;
// Headers that hold the TOTAL cost of the lot (divide by shares to get avg)
const COST_TOTAL_HEADERS = /^(cost ?basis( total)?|total ?cost( basis)?)$/i;
// Fallbacks that need per-share disambiguation are matched more loosely
const COST_HEADERS_LOOSE = /cost|price ?paid|avg|average/i;

const TICKER_VALUE_RE = /^[A-Z]{1,6}([.\-][A-Z]{1,3})?$/;
const NON_POSITION_WORDS =
  /cash|sweep|total|account|pending|money ?market|core|balance|fdic|spaxx|margin/i;

// Split one CSV line respecting double quotes
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,()\s]/g, "").replace(/^-+$/, "");
  if (!cleaned || cleaned === "--" || /n\/?a/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? (raw.includes("(") ? -n : n) : null;
}

export function parseBrokerCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], skipped: 0, detected: null, error: "File looks empty." };
  }

  // Find the header row: first line whose cells match a ticker header AND a
  // shares header. Brokers often prepend account info lines.
  let headerIdx = -1;
  let tickerCol = -1;
  let sharesCol = -1;
  let costCol = -1;
  let costIsTotal = false;
  let headerCells: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitCsvLine(lines[i]).map((c) => c.replace(/^"|"$/g, ""));
    const ti = cells.findIndex((c) => TICKER_HEADERS.test(c));
    const si = cells.findIndex((c) => SHARES_HEADERS.test(c));
    if (ti !== -1 && si !== -1) {
      headerIdx = i;
      tickerCol = ti;
      sharesCol = si;
      headerCells = cells;
      // Preference order: explicit per-share header, then total-cost header
      // (divided by shares later), then a loose per-share match.
      costCol = cells.findIndex((c) => COST_HEADERS.test(c));
      if (costCol === -1) {
        costCol = cells.findIndex((c) => COST_TOTAL_HEADERS.test(c));
        costIsTotal = costCol !== -1;
      }
      if (costCol === -1) {
        costCol = cells.findIndex(
          (c, idx) =>
            idx !== ti &&
            idx !== si &&
            COST_HEADERS_LOOSE.test(c) &&
            !/total|market|value|gain|loss|%/i.test(c)
        );
      }
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      rows: [],
      skipped: 0,
      detected: null,
      error:
        "Couldn't find a header row with symbol and quantity columns. Make sure this is a positions/holdings export.",
    };
  }

  const rows: ParsedHolding[] = [];
  let skipped = 0;

  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line).map((c) => c.replace(/^"|"$/g, ""));
    const rawTicker = (cells[tickerCol] ?? "").toUpperCase().trim();
    if (!rawTicker) continue;
    if (NON_POSITION_WORDS.test(rawTicker) || !TICKER_VALUE_RE.test(rawTicker)) {
      skipped++;
      continue;
    }
    const shares = parseNumber(cells[sharesCol] ?? "");
    if (shares == null || shares <= 0) {
      skipped++;
      continue;
    }
    let cost = costCol !== -1 ? parseNumber(cells[costCol] ?? "") : null;
    if (cost != null && costIsTotal && shares > 0) cost = cost / shares;

    // Merge duplicate tickers (some exports split lots into rows)
    const existing = rows.find((r) => r.ticker === rawTicker);
    if (existing) {
      const totalShares = existing.shares + shares;
      if (existing.avg_cost != null && cost != null) {
        existing.avg_cost =
          (existing.avg_cost * existing.shares + cost * shares) / totalShares;
      } else if (cost != null) {
        existing.avg_cost = cost;
      }
      existing.shares = totalShares;
    } else {
      rows.push({ ticker: rawTicker, shares, avg_cost: cost });
    }
  }

  return {
    rows,
    skipped,
    detected: {
      ticker: headerCells[tickerCol],
      shares: headerCells[sharesCol],
      cost: costCol !== -1 ? headerCells[costCol] : null,
    },
    error: rows.length === 0 ? "No valid holdings found in this file." : undefined,
  };
}
