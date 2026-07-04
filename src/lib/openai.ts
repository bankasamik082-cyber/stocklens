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

// ---- Price move explanation (multi-factor, ranked, cited) ----

const MOVE_EXPLAIN_PROMPT = `You are StockLens, a careful financial research assistant explaining ONE stock's price move on ONE specific trading day.

You receive a JSON "facts" object that has already been assembled for you: the day's % move, volume vs its average, how far the move is from typical (in standard deviations), how the stock's PEERS moved that day (to tell stock-specific vs sector-wide), and any catalysts found in the aligned window — same-day and prior-day news, an earnings report, an analyst-sentiment shift, insider trades, and disclosed politician trades.

Your job: weigh these factors and produce a RANKED explanation — the single most likely primary driver, then contributing factors — using ONLY the facts given.

HARD RULES — never break these:
- Use ONLY the provided facts. NEVER invent news, numbers, causes, or sources.
- NEVER predict future prices. NEVER say "buy", "sell", "hold", or recommend any action.
- Attribute honestly. If a news headline plausibly explains the move, name it. If the move is sector-wide (peers moved similarly), say the move looks driven by sector/market forces rather than company-specific news, and make that the primary driver.
- If earnings were reported that day or the day before, that is almost always the primary driver — say so and cite the surprise.
- Do NOT force a company-specific cause when the facts don't support one. It is correct and expected to say a catalyst is unclear.
- Match the move direction: don't cite bullish news to explain a large drop (or vice versa) unless you flag the mismatch.
- Keep each "text" to 1–2 plain-English, beginner-friendly sentences. This is research, NOT financial advice.

Set "confidence":
- "High": one clearly dominant catalyst (e.g. earnings, or strong same-day news that matches the move direction on a stock-specific move).
- "Medium": a plausible driver but other explanations exist, OR the move is sector-wide.
- "Low": only weak or tangential signals; the real catalyst is unclear.

Respond with ONLY a JSON object, no markdown, no code fences:
{
  "headline": "one short sentence summarizing why it moved",
  "primaryDriver": { "factor": "Earnings" | "News" | "Sector / market" | "Analyst change" | "Insider activity" | "Politician trade" | "Unclear", "text": "..." },
  "contributingFactors": [ { "factor": "...", "text": "..." } ],
  "confidence": "High" | "Medium" | "Low"
}
Use at most 3 contributingFactors. Omit primaryDriver (null) only if truly nothing explains the move.`;

export interface MoveExplainInput {
  ticker: string;
  companyName: string;
  sector: string;
  date: string;
  close: number;
  priceChangePercent: number;
  // Volume / volatility context
  relativeVolume: number | null; // day volume ÷ trailing average
  volumeNote: string;
  moveSigma: number | null; // move size in std devs of trailing daily returns
  // Peer / sector context
  peers: Array<{ ticker: string; changePercent: number }>;
  avgPeerChangePercent: number | null;
  sectorWide: boolean | null;
  // Catalysts (already ET-aligned and windowed by the route)
  sameDayNews: Array<{ title: string; source: string }>;
  priorDayNews: Array<{ title: string; source: string }>;
  earnings: {
    period: string;
    quarter: number;
    year: number;
    actual: number | null;
    estimate: number | null;
    surprisePercent: number | null;
    beat: boolean | null;
  } | null;
  analystChange: {
    direction: string;
    fromPct: number;
    toPct: number;
    total: number;
  } | null;
  insiderTrades: Array<{ name: string; type: string; shares: number; date: string }>;
  politicianTrades: Array<{ name: string; date: string; type: string; amount: string }>;
}

export interface MoveExplanation {
  headline: string;
  primaryDriver: { factor: string; text: string } | null;
  contributingFactors: Array<{ factor: string; text: string }>;
  confidence: ConfidenceLevel;
  noCatalyst: boolean;
}

function hasAnyCatalyst(input: MoveExplainInput): boolean {
  return (
    input.sameDayNews.length > 0 ||
    input.priorDayNews.length > 0 ||
    input.earnings !== null ||
    input.analystChange !== null ||
    input.insiderTrades.length > 0 ||
    input.politicianTrades.length > 0
  );
}

// Deterministic fallback when there is no company-specific catalyst — never
// let the model invent a cause. Still reports what the data DOES show (whether
// the move tracked its peers / the broader market).
function fallbackExplanation(input: MoveExplainInput): MoveExplanation {
  const contributing: Array<{ factor: string; text: string }> = [];
  if (input.sectorWide === true && input.avgPeerChangePercent !== null) {
    contributing.push({
      factor: "Sector / market",
      text: `Peers moved an average of ${input.avgPeerChangePercent.toFixed(
        1
      )}% the same day, so this looks like a sector- or market-wide move rather than company-specific news.`,
    });
  }
  if (input.relativeVolume && input.relativeVolume >= 1.5) {
    contributing.push({
      factor: "Volume",
      text: `Trading volume was ${input.relativeVolume.toFixed(
        1
      )}× its recent average, so there was heavier-than-usual activity even without a clear headline.`,
    });
  }
  return {
    headline:
      "No clear company-specific catalyst was found near this date.",
    primaryDriver:
      input.sectorWide === true
        ? {
            factor: "Sector / market",
            text: "The move lines up with how peers traded, pointing to broad sector or market forces rather than news specific to this company.",
          }
        : null,
    contributingFactors: contributing,
    confidence: "Low",
    noCatalyst: true,
  };
}

const VALID_CONFIDENCE: ConfidenceLevel[] = ["Low", "Medium", "High"];

export async function generateMoveExplanation(
  input: MoveExplainInput
): Promise<MoveExplanation> {
  // No catalysts at all → deterministic fallback, skip the model entirely so it
  // cannot hallucinate a cause.
  if (!hasAnyCatalyst(input)) {
    return fallbackExplanation(input);
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  try {
    const result = await model.generateContent(
      `${MOVE_EXPLAIN_PROMPT}\n\nFacts:\n${JSON.stringify(input, null, 2)}`
    );
    const text = result.response.text().trim();
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(clean) as Partial<MoveExplanation>;

    const confidence: ConfidenceLevel = VALID_CONFIDENCE.includes(
      parsed.confidence as ConfidenceLevel
    )
      ? (parsed.confidence as ConfidenceLevel)
      : "Medium";

    const contributingFactors = Array.isArray(parsed.contributingFactors)
      ? parsed.contributingFactors
          .filter((f) => f && typeof f.text === "string" && f.text.trim())
          .slice(0, 3)
          .map((f) => ({ factor: String(f.factor || "Other"), text: String(f.text) }))
      : [];

    const primaryDriver =
      parsed.primaryDriver && typeof parsed.primaryDriver.text === "string"
        ? {
            factor: String(parsed.primaryDriver.factor || "Other"),
            text: String(parsed.primaryDriver.text),
          }
        : null;

    return {
      headline:
        typeof parsed.headline === "string" && parsed.headline.trim()
          ? parsed.headline.trim()
          : "Here's what the data shows around this move.",
      primaryDriver,
      contributingFactors,
      confidence,
      noCatalyst: false,
    };
  } catch {
    // Model/parse failure — degrade to the deterministic summary rather than
    // showing an error, so the user still gets the factual context.
    return { ...fallbackExplanation(input), noCatalyst: false };
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