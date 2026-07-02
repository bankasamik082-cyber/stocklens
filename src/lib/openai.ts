// Gemini-based narrative generator (drop-in replacement for the OpenAI version).
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ConfidenceLevel, SectionId } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface NarrativeInput {
  ticker: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  revenue: string;
  netIncome: string;
  profitMargin: string;
  grossMargin?: string;
  debt: string;
  cashFlow: string;
  newsHeadlines: string[];
  hasPoliticianData: boolean;
  analystBullPct?: number;
  analystTotal?: number;
  insiderNetShares?: number;
}

export interface NarrativeRequest {
  whatItDoes: boolean;
  financialScore: boolean;
  bullCase: boolean;
  bearCase: boolean;
  finalVerdict: boolean;
}

export interface NarrativeOutput {
  whatItDoes?: string;
  financialScore?: number;
  financialScoreRationale?: string;
  bullReasons?: string[];
  bearRisks?: string[];
  verdictSummary?: string;
  verdictConfidence?: ConfidenceLevel;
}

const SYSTEM_PROMPT = `You are StockLens, a careful stock-research assistant.

HARD RULES — never break these:
- This is research, NOT financial advice.
- NEVER say "buy", "sell", "hold", or give a recommendation to trade.
- NEVER invent numbers, facts, or sources. Only reason from the data provided.
- If the data provided is thin or missing, say so plainly (e.g. "Data is limited").
- Use measured language: "worth researching further", "high risk", "strong company but expensive", "data is limited", "mixed signals".
- Keep everything plain-English and beginner-friendly. Short sentences.

You will receive a JSON object of facts. Respond with ONLY a valid JSON object. No markdown, no code fences, no commentary.`;

export async function generateNarrative(
  input: NarrativeInput,
  request: NarrativeRequest
): Promise<NarrativeOutput> {
  const wanted: string[] = [];
  if (request.whatItDoes)
    wanted.push(`"whatItDoes": a 2-3 sentence plain-English summary of what the company does`);
  if (request.financialScore)
    wanted.push(`"financialScore": integer 1-10 rating of overall financial health (10 = very strong), "financialScoreRationale": 1-2 sentences explaining the score`);
  if (request.bullCase)
    wanted.push(`"bullReasons": array of exactly 3 short reasons the company could do well`);
  if (request.bearCase)
    wanted.push(`"bearRisks": array of exactly 3 short risks`);
  if (request.finalVerdict)
    wanted.push(`"verdictSummary": 2-4 sentence plain-English wrap-up with NO buy/sell language, "verdictConfidence": one of "Low", "Medium", "High" reflecting how complete the data is`);

  if (wanted.length === 0) return {};

  const prompt = `${SYSTEM_PROMPT}

Facts:
${JSON.stringify(input, null, 2)}

Return a JSON object containing exactly these fields:
${wanted.map((w) => "- " + w).join("\n")}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code fences if Gemini adds them
  const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: NarrativeOutput;
  try {
    parsed = JSON.parse(clean) as NarrativeOutput;
  } catch {
    parsed = {};
  }

  if (typeof parsed.financialScore === "number") {
    parsed.financialScore = Math.max(1, Math.min(10, Math.round(parsed.financialScore)));
  }
  return parsed;
}

export function toNarrativeRequest(sections: SectionId[]): NarrativeRequest {
  return {
    whatItDoes: sections.includes("companyOverview"),
    financialScore: sections.includes("financialHealth"),
    bullCase: sections.includes("bullCase"),
    bearCase: sections.includes("bearCase"),
    finalVerdict: sections.includes("finalVerdict"),
  };
}

// ---- Price move explanation ----

const MOVE_EXPLAIN_PROMPT = `You are StockLens, a careful financial research assistant explaining a stock price move on a specific date.

HARD RULES — never break these:
- Only explain what the provided data shows: price change, news headlines near that date, and disclosed politician trades.
- NEVER speculate beyond the provided data.
- NEVER predict future price movement.
- NEVER say "buy", "sell", "hold", or recommend any action.
- NEVER invent facts, sources, or context not present in the data.
- If newsHeadlines is empty AND politicianTrades is empty, respond with exactly: "No specific news or disclosed trades were found near this date — the move may reflect broader market conditions."
- Keep it to 2–4 sentences. Plain English. Beginner-friendly.
- This is research, NOT financial advice.

Respond with ONLY the explanation text. No JSON, no markdown, no preamble.`;

export interface MoveExplainInput {
  ticker: string;
  date: string;
  close: number;
  priceChange: number;
  priceChangePercent: number;
  newsHeadlines: Array<{ title: string; date: string; url: string }>;
  politicianTrades: Array<{ name: string; date: string; type: string; amount: string }>;
}

export async function generateMoveExplanation(
  input: MoveExplainInput
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  try {
    const result = await model.generateContent(
      `${MOVE_EXPLAIN_PROMPT}\n\nData:\n${JSON.stringify(input, null, 2)}`
    );
    return result.response.text().trim();
  } catch {
    return "Unable to generate an explanation at this time.";
  }
}

// ---- Headline rewriting (Market News page) ----
// Takes real headlines + their summaries and rewrites just the headline to
// be punchier and more clickable, WITHOUT changing or exaggerating the facts.
// The original headline/url stay attached as the source of truth — this is
// a presentation layer only, not a new fact-generation surface.

const HEADLINE_SYSTEM_PROMPT = `You rewrite news headlines to be punchier and more attention-grabbing for a finance news feed, while staying 100% factually accurate to the original headline and summary.

HARD RULES:
- NEVER invent facts, numbers, or claims not present in the original headline/summary.
- NEVER use clickbait that misleads (no "you won't believe", no fake urgency).
- Keep it short: under 90 characters.
- Keep proper nouns (companies, tickers, people) accurate and unchanged.
- If the original is already strong, light editing is fine — don't force a rewrite that adds nothing.

Respond with ONLY a JSON object: {"rewritten": ["headline 1", "headline 2", ...]} — same order, same count as the input array. No markdown, no commentary.`;

export async function rewriteHeadlines(
  items: { title: string; text: string }[]
): Promise<string[]> {
  if (items.length === 0) return [];

  const prompt = `${HEADLINE_SYSTEM_PROMPT}

Original headlines and summaries:
${JSON.stringify(items, null, 2)}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(clean) as { rewritten?: string[] };

    if (Array.isArray(parsed.rewritten) && parsed.rewritten.length === items.length) {
      return parsed.rewritten;
    }
    // Fallback: if shape doesn't match, just use originals.
    return items.map((i) => i.title);
  } catch {
    return items.map((i) => i.title);
  }
}