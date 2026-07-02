import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getFinancials,
  getPoliticianTrades,
  getAnalystRecommendations,
  formatMoney,
} from "@/lib/fmp";
import { GoogleGenerativeAI } from "@google/generative-ai";

const FH_BASE = "https://finnhub.io/api/v1";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ---- Last-quarter earnings (mirrors the /api/earnings route pattern) ----

interface EarningsRecord {
  period: string;
  year: number;
  quarter: number;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

async function getLastEarnings(ticker: string): Promise<EarningsRecord | null> {
  try {
    const url = `${FH_BASE}/stock/earnings?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = await res.json();
    if (!Array.isArray(raw) || !raw.length) return null;
    const withActual = (raw as EarningsRecord[]).filter((r) => r.actual !== null);
    if (!withActual.length) return null;
    withActual.sort((a, b) => (a.period > b.period ? -1 : 1));
    const last = withActual[0];
    return {
      period: last.period,
      year: last.year,
      quarter: last.quarter,
      actual: last.actual,
      estimate: last.estimate,
      surprise: last.surprise,
      surprisePercent: last.surprisePercent,
    };
  } catch {
    return null;
  }
}

// ---- Per-ticker data fetch ----

export interface CompanyCompareData {
  ticker: string;
  companyName: string;
  // Overview
  sector: string | null;
  industry: string | null;
  marketCap: string | null;
  marketCapRaw: number | null;
  // Financial Health
  revenue: string | null;
  revenueRaw: number | null;
  netIncome: string | null;
  netIncomeRaw: number | null;
  debt: string | null;
  debtRaw: number | null;
  operatingCashFlow: string | null;
  operatingCashFlowRaw: number | null;
  // Earnings (most recent reported quarter)
  lastEps: {
    period: string;
    actual: number | null;
    estimate: number | null;
    surprise: number | null;
    surprisePct: number | null;
  } | null;
  // Politician trading
  politicianTradeCount: number;
  // Analyst consensus
  analystBullPct: number | null;
  analystTotal: number | null;
}

async function fetchCompanyData(ticker: string): Promise<CompanyCompareData> {
  const [profile, financials, trades, earnings, analyst] = await Promise.all([
    getProfile(ticker),
    getFinancials(ticker),
    getPoliticianTrades(ticker),
    getLastEarnings(ticker),
    getAnalystRecommendations(ticker).catch(() => null),
  ]);

  const { income, balance, cashflow } = financials;

  return {
    ticker,
    companyName: profile?.companyName || ticker,
    sector: profile?.sector || null,
    industry: profile?.industry || null,
    marketCap: profile ? formatMoney(profile.marketCap) : null,
    marketCapRaw: profile?.marketCap ?? null,
    revenue: income ? formatMoney(income.revenue) : null,
    revenueRaw: income?.revenue ?? null,
    netIncome: income ? formatMoney(income.netIncome) : null,
    netIncomeRaw: income?.netIncome ?? null,
    debt: balance ? formatMoney(balance.totalDebt) : null,
    debtRaw: balance?.totalDebt ?? null,
    operatingCashFlow: cashflow ? formatMoney(cashflow.operatingCashFlow) : null,
    operatingCashFlowRaw: cashflow?.operatingCashFlow ?? null,
    lastEps: earnings
      ? {
          period: earnings.period,
          actual: earnings.actual,
          estimate: earnings.estimate,
          surprise: earnings.surprise,
          surprisePct: earnings.surprisePercent,
        }
      : null,
    politicianTradeCount: trades.senate.length + trades.house.length,
    analystBullPct: analyst?.bullPct ?? null,
    analystTotal: analyst?.total ?? null,
  };
}

// ---- Gemini comparison summary ----

function buildSummaryPrompt(companies: CompanyCompareData[]): string {
  const blocks = companies.map((c) => {
    const lines = [
      `${c.ticker} (${c.companyName}):`,
      `  Sector: ${c.sector ?? "N/A"}`,
      `  Industry: ${c.industry ?? "N/A"}`,
      `  Market Cap: ${c.marketCap ?? "N/A"}`,
      `  Revenue: ${c.revenue ?? "N/A"}`,
      `  Net Income: ${c.netIncome ?? "N/A"}`,
      `  Total Debt: ${c.debt ?? "N/A"}`,
      `  Operating Cash Flow: ${c.operatingCashFlow ?? "N/A"}`,
    ];
    if (c.lastEps) {
      lines.push(
        `  Last EPS: actual $${c.lastEps.actual?.toFixed(2) ?? "?"}, estimate $${
          c.lastEps.estimate?.toFixed(2) ?? "?"
        }, surprise ${c.lastEps.surprisePct?.toFixed(1) ?? "?"}%`
      );
    }
    lines.push(
      `  Disclosed politician trades: ${c.politicianTradeCount}`
    );
    if (c.analystBullPct !== null && c.analystTotal !== null) {
      lines.push(
        `  Analyst consensus: ${c.analystBullPct}% bullish (${c.analystTotal} analysts)`
      );
    }
    return lines.join("\n");
  });

  return `You are a financial research assistant. Compare the following companies using ONLY the data provided below.

HARD RULES:
- 3-5 sentences only.
- State factual comparisons ("Company A has higher revenue than Company B").
- NEVER recommend which company to buy, sell, or hold.
- NEVER say "better investment" or "invest in".
- NEVER invent numbers or facts not in the data.
- If data is missing for a metric, skip that comparison.
- Plain English, no jargon.
- This is research, NOT financial advice.

Data:
${blocks.join("\n\n")}

Write a factual comparison summary:`;
}

async function generateSummary(companies: CompanyCompareData[]): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(buildSummaryPrompt(companies));
    return result.response.text().trim();
  } catch {
    return "";
  }
}

// ---- Route handler ----

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { tickers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = body.tickers;
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) {
    return NextResponse.json(
      { error: "Provide 2–4 tickers." },
      { status: 400 }
    );
  }

  const tickers: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
    const clean = t.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(clean)) {
      return NextResponse.json({ error: `Invalid ticker: ${t}` }, { status: 400 });
    }
    tickers.push(clean);
  }

  // Unique only
  const uniqueTickers = [...new Set(tickers)];
  if (uniqueTickers.length < 2) {
    return NextResponse.json({ error: "Provide at least 2 distinct tickers." }, { status: 400 });
  }

  // Fetch all companies in parallel
  const companies = await Promise.all(uniqueTickers.map((t) => fetchCompanyData(t)));

  // Generate summary after we have all data
  const summary = await generateSummary(companies);

  return NextResponse.json({ companies, summary });
}
