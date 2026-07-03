import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNews,
  getProfile,
  getPoliticianTrades,
  getUpcomingEarnings,
  type FmpPoliticianTrade,
  type UpcomingEarnings,
} from "@/lib/fmp";

export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://stocklens-red.vercel.app";

interface TickerBrief {
  ticker: string;
  companyName: string;
  headline: { title: string; url: string } | null;
  earnings: UpcomingEarnings | null;
  senateTrades: Array<{ name: string; type: string; amount: string; date: string }>;
}

function within7Days(dateStr: string): boolean {
  const d = new Date(dateStr).getTime();
  return Date.now() - d < 7 * 24 * 60 * 60 * 1000 && !Number.isNaN(d);
}

function resolveName(t: FmpPoliticianTrade): string {
  return (
    t.representative || [t.firstName, t.lastName].filter(Boolean).join(" ") || "Unknown"
  );
}

// Fetch everything once per distinct ticker, shared across all subscribers.
async function buildTickerBrief(ticker: string): Promise<TickerBrief> {
  const [profile, earningsList, trades] = await Promise.all([
    getProfile(ticker).catch(() => null),
    getUpcomingEarnings([ticker], 7).catch(() => []),
    getPoliticianTrades(ticker).catch(() => ({ senate: [], house: [] })),
  ]);
  const news = await getNews(ticker, profile?.companyName || ticker, 1).catch(() => []);

  const senateTrades = trades.senate
    .filter((t) => t.transactionDate && within7Days(t.transactionDate))
    .slice(0, 3)
    .map((t) => ({
      name: resolveName(t),
      type: t.type || "Unknown",
      amount: t.amount || "Not disclosed",
      date: t.transactionDate!,
    }));

  return {
    ticker,
    companyName: profile?.companyName ?? ticker,
    headline: news[0] ? { title: news[0].title, url: news[0].url } : null,
    earnings: earningsList[0] ?? null,
    senateTrades,
  };
}

function tickerRowHtml(b: TickerBrief): string {
  const events: string[] = [];
  if (b.earnings) {
    const when = new Date(b.earnings.date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    events.push(
      `<p style="margin:4px 0;color:#fbbf24;font-size:13px;">◑ Earnings ${when}${b.earnings.hour ? ` (${b.earnings.hour})` : ""}</p>`
    );
  }
  for (const t of b.senateTrades) {
    events.push(
      `<p style="margin:4px 0;color:#94a3b8;font-size:13px;">🏛 ${t.name}: ${t.type} (${t.amount}) on ${t.date}</p>`
    );
  }
  if (b.headline) {
    events.push(
      `<p style="margin:4px 0;font-size:13px;"><a href="${b.headline.url}" style="color:#94a3b8;text-decoration:none;">⬡ ${b.headline.title}</a></p>`
    );
  }
  if (events.length === 0) {
    events.push(`<p style="margin:4px 0;color:#475569;font-size:13px;">No notable events.</p>`);
  }
  return `
    <div style="padding:14px 0;border-bottom:1px solid #1e293b;">
      <p style="margin:0 0 2px;color:#f8fafc;font-size:15px;font-weight:700;font-family:monospace;">
        ${b.ticker} <span style="color:#64748b;font-weight:400;font-size:12px;font-family:sans-serif;">${b.companyName}</span>
      </p>
      ${events.join("")}
    </div>`;
}

function buildBriefHtml(dateLabel: string, briefs: TickerBrief[]): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:40px auto;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 32px;background:linear-gradient(135deg,#1e1b4b,#0f172a);border-bottom:1px solid #1e293b;">
      <span style="color:#f8fafc;font-size:18px;font-weight:600;">Stock<span style="color:#818cf8;">Lens</span></span>
      <h1 style="margin:20px 0 4px;color:#f8fafc;font-size:22px;font-weight:700;">Good morning.</h1>
      <p style="margin:0;color:#64748b;font-size:14px;">Here's your StockLens brief for ${dateLabel}.</p>
    </div>
    <div style="padding:12px 32px 24px;">
      ${briefs.map(tickerRowHtml).join("")}
    </div>
    <div style="padding:20px 32px;border-top:1px solid #1e293b;">
      <p style="margin:0;color:#334155;font-size:12px;">
        Manage your alerts at
        <a href="${APP_URL}/alerts" style="color:#818cf8;text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}/alerts</a>
        · Research only, not financial advice.
      </p>
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

  const { data: subscribers, error: subError } = await adminClient
    .from("daily_brief_subscriptions")
    .select("user_id, email");

  if (subError) {
    return NextResponse.json(
      { error: `Failed to read subscribers: ${subError.message}` },
      { status: 500 }
    );
  }
  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ subscribers: 0, emailsSent: 0, message: "No subscribers." });
  }

  // Watchlists for all subscribers in one query
  const userIds = subscribers.map((s) => s.user_id);
  const { data: watchRows } = await adminClient
    .from("saved_stocks")
    .select("user_id, ticker")
    .in("user_id", userIds);

  const watchlistByUser = new Map<string, string[]>();
  for (const row of watchRows ?? []) {
    const list = watchlistByUser.get(row.user_id) ?? [];
    if (list.length < 8) list.push(row.ticker);
    watchlistByUser.set(row.user_id, list);
  }

  // Distinct tickers across everyone — fetch each once (cap to stay in budget)
  const distinct = [...new Set((watchRows ?? []).map((r) => r.ticker))].slice(0, 25);
  const briefResults = await Promise.all(distinct.map(buildTickerBrief));
  const briefByTicker = new Map(briefResults.map((b) => [b.ticker, b]));

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  let emailsSent = 0;

  const sendResults = await Promise.allSettled(
    subscribers.map((sub) => {
      const tickers = watchlistByUser.get(sub.user_id) ?? [];
      const briefs = tickers
        .map((t) => briefByTicker.get(t))
        .filter(Boolean) as TickerBrief[];
      if (briefs.length === 0) return Promise.resolve(null); // empty watchlist → skip
      return resend.emails.send({
        from: "StockLens Brief <onboarding@resend.dev>",
        to: sub.email,
        subject: `Your StockLens brief — ${dateLabel}`,
        html: buildBriefHtml(dateLabel, briefs),
      });
    })
  );
  for (const r of sendResults) {
    if (r.status === "fulfilled" && r.value !== null) emailsSent++;
  }

  return NextResponse.json({
    subscribers: subscribers.length,
    tickersFetched: distinct.length,
    emailsSent,
  });
}
