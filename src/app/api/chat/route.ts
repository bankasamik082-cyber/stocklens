import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// The exhaustive list of sources the AI is allowed to cite.
// Any string not in this list is stripped from the response.
const VALID_SOURCES = [
  "Finnhub — Company profile",
  "Finnhub — Financial statements",
  "Finnhub — Recent news",
  "FMP — Politician trades",
  "Finnhub — Analyst recommendations",
  "Finnhub — Insider transactions",
] as const;
type ValidSource = (typeof VALID_SOURCES)[number];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildContextBlock(ticker: string, companyName: string, ctx: any): string {
  const lines: string[] = [];

  lines.push(`=== DATA SNAPSHOT: ${ticker} (${companyName}) ===`);
  lines.push(`Fetched at: ${ctx.loadedAt ?? "unknown"}`);
  lines.push("");

  if (ctx.profile) {
    lines.push("--- COMPANY PROFILE (source: Finnhub — Company profile) ---");
    lines.push(`Sector: ${ctx.profile.sector ?? "N/A"}`);
    lines.push(`Industry: ${ctx.profile.industry ?? "N/A"}`);
    lines.push(`Market Cap: ${ctx.profile.marketCap ?? "N/A"}`);
    lines.push(`Currency: ${ctx.profile.currency ?? "USD"}`);
    lines.push("");
  }

  const f = ctx.financials ?? {};
  lines.push("--- FINANCIALS — most recent annual period (source: Finnhub — Financial statements) ---");
  lines.push(`Revenue: ${f.revenue ?? "Data not available"}`);
  lines.push(`Net Income: ${f.netIncome ?? "Data not available"}`);
  lines.push(`Profit Margin: ${f.profitMargin ?? "Data not available"}`);
  lines.push(`Total Debt: ${f.totalDebt ?? "Data not available"}`);
  lines.push(`Operating Cash Flow: ${f.operatingCashFlow ?? "Data not available"}`);
  lines.push("");

  const news: Array<{ title: string; summary?: string; date?: string; source?: string }> =
    ctx.news ?? [];
  lines.push("--- RECENT NEWS — last 14 days (source: Finnhub — Recent news) ---");
  if (news.length === 0) {
    lines.push("No recent news found for this ticker.");
  } else {
    news.forEach((n, i) => {
      lines.push(`[${i + 1}] ${n.title} (${n.date ?? "date unknown"}, via ${n.source ?? "unknown"})`);
      if (n.summary) lines.push(`    ${n.summary}`);
    });
  }
  lines.push("");

  const allTrades = [
    ...(ctx.senatorTrades ?? []),
    ...(ctx.houseTrades ?? []),
  ] as Array<{ name: string; party: string; type: string; date: string; amount: string }>;
  lines.push("--- DISCLOSED POLITICIAN TRADES (source: FMP — Politician trades) ---");
  if (allTrades.length === 0) {
    lines.push("No disclosed politician trades found for this ticker.");
  } else {
    allTrades.forEach((t) => {
      lines.push(
        `${t.name} (${t.party}): ${t.type} on ${t.date}, amount: ${t.amount}`
      );
    });
  }
  lines.push("");

  const analyst = ctx.analystConsensus as {
    period: string; total: number; bullPct: number; holdPct: number; bearPct: number;
    strongBuy: number; buy: number; hold: number; sell: number; strongSell: number;
  } | null | undefined;
  lines.push("--- ANALYST CONSENSUS (source: Finnhub — Analyst recommendations) ---");
  if (!analyst) {
    lines.push("No analyst consensus data found for this ticker.");
  } else {
    lines.push(`Period: ${analyst.period}`);
    lines.push(`Total analysts: ${analyst.total}`);
    lines.push(`Strong Buy: ${analyst.strongBuy}, Buy: ${analyst.buy}, Hold: ${analyst.hold}, Sell: ${analyst.sell}, Strong Sell: ${analyst.strongSell}`);
    lines.push(`Bullish: ${analyst.bullPct}%, Hold: ${analyst.holdPct}%, Bearish: ${analyst.bearPct}%`);
  }
  lines.push("");

  const insider = ctx.insiderActivity as {
    netShares: number;
    transactions: Array<{ name: string; type: string; shares: number; value: number | null; date: string }>;
  } | null | undefined;
  lines.push("--- INSIDER ACTIVITY (source: Finnhub — Insider transactions) ---");
  if (!insider || insider.transactions.length === 0) {
    lines.push("No recent insider transactions found for this ticker.");
  } else {
    lines.push(`Net shares across recent transactions: ${insider.netShares >= 0 ? "+" : ""}${insider.netShares.toLocaleString()} (positive = net buying)`);
    insider.transactions.forEach((t) => {
      const val = t.value != null ? ` ($${(t.value / 1_000_000).toFixed(2)}M)` : "";
      lines.push(`  ${t.name}: ${t.type} of ${t.shares.toLocaleString()} shares${val} on ${t.date}`);
    });
  }
  lines.push("");
  lines.push("=== END OF DATA SNAPSHOT ===");

  return lines.join("\n");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { ticker?: string; messages?: ChatMessage[]; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { ticker, messages, context } = body;
  if (!ticker || !Array.isArray(messages) || messages.length === 0 || !context) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = context as any;
  const companyName: string = ctx.companyName || ticker;
  const contextBlock = buildContextBlock(ticker as string, companyName, ctx);

  // The priming exchange: inject the full data snapshot as the opening pair
  // so Gemini treats it as established context throughout the conversation.
  const SYSTEM_RULES = `You are a financial research assistant for StockLens, answering questions about ${ticker} (${companyName}).

HARD RULES — never break these:
- Answer ONLY using the provided data snapshot. Never draw on your training knowledge about this company.
- NEVER say "buy", "sell", "hold", or give any investment recommendation.
- NEVER predict future stock prices or returns.
- NEVER use phrases like "you should invest" or "consider investing".
- If the data doesn't contain the answer, respond with: "The available data doesn't cover this."
- Keep answers concise: 2–4 sentences unless a list is genuinely clearer.
- Always attribute which data source(s) you used in the "sources" field.

Available sources you may cite (use exact strings):
- "Finnhub — Company profile"
- "Finnhub — Financial statements"
- "Finnhub — Recent news"
- "FMP — Politician trades"
- "Finnhub — Analyst recommendations"
- "Finnhub — Insider transactions"

${contextBlock}

Respond with ONLY valid JSON — no markdown, no code fences:
{"answer": "...", "sources": ["Finnhub — ...", ...]}`;

  const primedHistory: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [
    {
      role: "user",
      parts: [{ text: SYSTEM_RULES }],
    },
    {
      role: "model",
      parts: [
        {
          text: JSON.stringify({
            answer: `I have the data snapshot for ${ticker} loaded. Ask me about the financials, recent news, disclosed politician trades, analyst consensus, or insider transactions.`,
            sources: [],
          }),
        },
      ],
    },
  ];

  // Append prior conversation turns (all but the last, which is the current question)
  const history = messages.slice(0, -1);
  for (const msg of history) {
    if (msg.role === "user") {
      primedHistory.push({ role: "user", parts: [{ text: msg.content }] });
    } else {
      primedHistory.push({
        role: "model",
        parts: [
          {
            text: JSON.stringify({
              answer: msg.content,
              sources: msg.sources ?? [],
            }),
          },
        ],
      });
    }
  }

  const currentQuestion = messages[messages.length - 1]?.content ?? "";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = model.startChat({ history: primedHistory });
    const result = await chat.sendMessage(currentQuestion);
    const raw = result.response.text().trim();

    // Strip any accidental code fences Gemini might add
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: { answer?: string; sources?: string[] };
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { answer: raw, sources: [] };
    }

    const reply = (parsed.answer || "").trim() || "I couldn't generate a response.";
    const sources = (parsed.sources ?? []).filter((s): s is ValidSource =>
      (VALID_SOURCES as readonly string[]).includes(s)
    );

    return NextResponse.json({ reply, sources });
  } catch (err) {
    console.error("[chat] Gemini error:", err);
    return NextResponse.json(
      { error: "Failed to generate a response. Please try again." },
      { status: 500 }
    );
  }
}
