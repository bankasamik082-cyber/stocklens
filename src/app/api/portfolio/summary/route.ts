import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface SummaryInput {
  positions: Array<{ ticker: string; sector: string | null; value: number | null }>;
  earningsSoon: string[]; // tickers reporting within 30 days
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: SummaryInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const positions = (body.positions ?? []).slice(0, 50);
  if (positions.length === 0) {
    return NextResponse.json({ error: "No positions provided." }, { status: 400 });
  }

  // Compute factual composition server-side so Gemini only phrases facts
  const total = positions.reduce((s, p) => s + (p.value ?? 0), 0);
  const bySector = new Map<string, number>();
  for (const p of positions) {
    const key = p.sector || "Other";
    bySector.set(key, (bySector.get(key) ?? 0) + (p.value ?? 0));
  }
  const sectorLines = [...bySector.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sector, v]) => `${sector}: ${total > 0 ? ((v / total) * 100).toFixed(1) : "0"}%`);
  const largest = [...positions]
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 3)
    .map(
      (p) =>
        `${p.ticker} (${total > 0 && p.value != null ? ((p.value / total) * 100).toFixed(1) : "?"}% of portfolio)`
    );

  const prompt = `You are a portfolio research assistant. Write a 3-4 sentence FACTUAL summary of this portfolio's composition. State only facts from the data below: sector concentration, largest positions, number of holdings, and upcoming earnings exposure.

HARD RULES:
- NEVER give investment advice, recommendations, or predictions.
- NEVER say "buy", "sell", "hold", "should", "consider", or comment on whether the composition is good or bad.
- Plain text only, no markdown.

DATA:
Number of holdings: ${positions.length}
Sector allocation by value: ${sectorLines.join(", ")}
Largest positions: ${largest.join(", ")}
Holdings reporting earnings within 30 days: ${body.earningsSoon?.length ? body.earningsSoon.join(", ") : "none"}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[portfolio-summary] error:", err);
    return NextResponse.json(
      { error: "Failed to generate the summary. Please try again." },
      { status: 500 }
    );
  }
}
