import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const FH_BASE = "https://finnhub.io/api/v1";

function fhKey() {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY not set");
  return k;
}

export interface EarningsRecord {
  symbol: string;
  period: string;
  year: number;
  quarter: number;
  estimate: number | null;
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

async function getEarnings(ticker: string): Promise<EarningsRecord[]> {
  const res = await fetch(
    `${FH_BASE}/stock/earnings?symbol=${ticker}&token=${fhKey()}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return (data as EarningsRecord[])
    .filter((r) => r.actual !== null)
    .sort((a, b) => (a.period < b.period ? -1 : 1));
}

async function generateEarningsSummary(
  ticker: string,
  records: EarningsRecord[]
): Promise<string> {
  if (!records.length) return "";
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";

  const beats = records.filter((r) => (r.surprise ?? 0) > 0).length;
  const total = records.length;
  const avgSurprise =
    records.reduce((s, r) => s + (r.surprisePercent ?? 0), 0) / total;

  const prompt = `${ticker} beat EPS estimates ${beats} out of ${total} quarters. Average EPS surprise: ${avgSurprise.toFixed(1)}%.

Recent quarters (oldest to newest):
${records
  .slice(-6)
  .map(
    (r) =>
      `${r.year}Q${r.quarter}: estimate $${r.estimate?.toFixed(2) ?? "?"}, actual $${r.actual?.toFixed(2) ?? "?"}, surprise ${r.surprisePercent?.toFixed(1) ?? "?"}%`
  )
  .join("\n")}

Write 1-2 sentences summarizing the earnings trend. Be factual. Do not say buy, sell, or hold. Do not give investment advice.`;

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ticker = (req.nextUrl.searchParams.get("ticker") || "").trim().toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const earnings = await getEarnings(ticker);
  if (!earnings.length) {
    return NextResponse.json(
      { error: `No earnings data found for ${ticker}.` },
      { status: 404 }
    );
  }

  const summary = await generateEarningsSummary(ticker, earnings);

  return NextResponse.json({ ticker, earnings, summary });
}
