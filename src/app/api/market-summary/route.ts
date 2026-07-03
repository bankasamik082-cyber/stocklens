import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeneralNews } from "@/lib/fmp";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// One AI market brief per instance per 30 min — shared across users since
// it's general market news, not personalised.
let cached: { at: number; summary: string; generatedAt: string } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ summary: cached.summary, generatedAt: cached.generatedAt, cached: true });
  }

  try {
    const news = await getGeneralNews(15);
    if (news.length === 0) {
      return NextResponse.json({ error: "No market news available right now." }, { status: 502 });
    }

    const headlines = news
      .map((n, i) => `${i + 1}. ${n.title} (${n.site ?? "unknown"})`)
      .join("\n");

    const prompt = `You are a market research assistant. Summarize today's market mood in 3-4 concise sentences based ONLY on these headlines. Mention the 2-3 most significant themes. Do NOT give investment advice, predictions, or recommendations. Plain text only, no markdown.

Headlines:
${headlines}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();
    const generatedAt = new Date().toISOString();

    cached = { at: Date.now(), summary, generatedAt };
    return NextResponse.json({ summary, generatedAt });
  } catch (err) {
    console.error("[market-summary] error:", err);
    return NextResponse.json(
      { error: "Failed to generate the market brief. Please try again." },
      { status: 500 }
    );
  }
}
