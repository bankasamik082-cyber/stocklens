import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPoliticianTrades, type FmpPoliticianTrade } from "@/lib/fmp";
import {
  MAJOR_POLITICIANS_NORMALIZED,
  normalizePoliticianName,
} from "@/lib/politicians";

// Well-known tickers that frequently appear in politician disclosures.
const WATCH_TICKERS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA",
  "JPM", "BAC", "WFC", "CVX", "XOM", "LMT", "RTX", "BA",
  "INTC", "AMD", "CRM", "NFLX", "DIS", "V", "MA", "JNJ", "PFE", "UNH",
];

type TradeWithTicker = { ticker: string; trade: FmpPoliticianTrade };

function resolveName(trade: FmpPoliticianTrade): string {
  return (
    trade.representative ||
    [trade.firstName, trade.lastName].filter(Boolean).join(" ")
  );
}

function tradeKey(ticker: string, trade: FmpPoliticianTrade): string {
  const name = resolveName(trade).toLowerCase().replace(/\s+/g, "-");
  const date = (trade.transactionDate || trade.dateRecieved || "").replace(
    /[^0-9]/g,
    ""
  );
  const type = (trade.type || "").toLowerCase().replace(/\s+/g, "-");
  return `${name}_${ticker.toLowerCase()}_${date}_${type}`;
}

function buildEmailHtml(
  trades: Array<TradeWithTicker>
): string {
  const rows = trades
    .map(({ ticker, trade }) => {
      const name = resolveName(trade);
      const party = trade.party ? ` (${trade.party})` : "";
      const date = trade.transactionDate || trade.dateRecieved || "Unknown";
      const type = trade.type || "Unknown";
      const amount = trade.amount || "Not disclosed";
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;font-weight:600;color:#f8fafc;">${name}${party}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;font-family:monospace;color:#818cf8;">${ticker}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:${type.toLowerCase().includes("purchase") || type.toLowerCase().includes("buy") ? "#34d399" : "#f87171"};">${type}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;">${date}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;">${amount}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:40px auto;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 32px;background:linear-gradient(135deg,#1e1b4b,#0f172a);border-bottom:1px solid #1e293b;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#818cf8,#6366f1);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-weight:700;font-size:14px;">SL</span>
        </div>
        <span style="color:#f8fafc;font-size:18px;font-weight:600;">Stock<span style="color:#818cf8;">Lens</span></span>
      </div>
      <h1 style="margin:20px 0 4px;color:#f8fafc;font-size:22px;font-weight:700;">
        ${trades.length} New Politician Trade${trades.length > 1 ? "s" : ""} Detected
      </h1>
      <p style="margin:0;color:#64748b;font-size:14px;">
        The following trades were filed by tracked politicians and haven't been reported before.
      </p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #1e293b;">Politician</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #1e293b;">Ticker</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #1e293b;">Type</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #1e293b;">Date</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #1e293b;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">
      <p style="margin:0;color:#334155;font-size:12px;">
        You're receiving this because you subscribed to politician trade alerts on StockLens.
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://stocklens.app"}/alerts"
         style="color:#818cf8;font-size:12px;text-decoration:none;">
        Manage alerts →
      </a>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  // Verify caller is Vercel Cron (or manual with the same secret).
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Fetch trades for all watched tickers in parallel.
  const results = await Promise.all(
    WATCH_TICKERS.map(async (ticker) => {
      const trades = await getPoliticianTrades(ticker);
      return { ticker, ...trades };
    })
  );

  // Flatten into a single array annotated with ticker.
  const allTrades: TradeWithTicker[] = [];
  for (const { ticker, senate, house } of results) {
    for (const trade of senate) allTrades.push({ ticker, trade });
    for (const trade of house) allTrades.push({ ticker, trade });
  }

  // Only consider trades from the last 7 days to avoid cold-start spam.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const recentTrades = allTrades.filter(({ trade }) => {
    const dateStr = trade.transactionDate || trade.dateRecieved;
    if (!dateStr) return false;
    return new Date(dateStr) >= cutoff;
  });

  // Filter to major politicians only.
  const majorTrades = recentTrades.filter(({ trade }) => {
    const name = normalizePoliticianName(resolveName(trade));
    return MAJOR_POLITICIANS_NORMALIZED.includes(name);
  });

  if (majorTrades.length === 0) {
    return NextResponse.json({
      checked: WATCH_TICKERS.length,
      newTrades: 0,
      message: "No recent major-politician trades found.",
    });
  }

  // Build unique keys and find which ones are new.
  const withKeys = majorTrades.map(({ ticker, trade }) => ({
    ticker,
    trade,
    key: tradeKey(ticker, trade),
  }));

  const allKeys = withKeys.map((t) => t.key);

  const { data: alreadySeen } = await adminClient
    .from("seen_trades")
    .select("trade_key")
    .in("trade_key", allKeys);

  const seenSet = new Set((alreadySeen ?? []).map((r) => r.trade_key));
  const newTrades = withKeys.filter((t) => !seenSet.has(t.key));

  if (newTrades.length === 0) {
    return NextResponse.json({
      checked: WATCH_TICKERS.length,
      newTrades: 0,
      message: "All recent trades already reported.",
    });
  }

  // Persist the new keys so we don't re-alert next run.
  await adminClient
    .from("seen_trades")
    .upsert(
      newTrades.map((t) => ({ trade_key: t.key })),
      { onConflict: "trade_key", ignoreDuplicates: true }
    );

  // Fetch all subscribers.
  const { data: subscribers } = await adminClient
    .from("alert_subscriptions")
    .select("email");

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({
      checked: WATCH_TICKERS.length,
      newTrades: newTrades.length,
      emailsSent: 0,
      message: "New trades found but no subscribers to notify.",
    });
  }

  // Send one email per subscriber.
  const resend = new Resend(process.env.RESEND_API_KEY);
  const emailHtml = buildEmailHtml(newTrades);
  const subject = `${newTrades.length} New Politician Trade${newTrades.length > 1 ? "s" : ""} Detected`;

  await Promise.allSettled(
    subscribers.map((sub) =>
      resend.emails.send({
        from: "StockLens Alerts <alerts@stocklens.app>",
        to: sub.email,
        subject,
        html: emailHtml,
      })
    )
  );

  return NextResponse.json({
    checked: WATCH_TICKERS.length,
    newTrades: newTrades.length,
    emailsSent: subscribers.length,
  });
}
