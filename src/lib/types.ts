// Shared types used across the app, the API route, and the report page.

export type SectionId =
  | "companyOverview"
  | "financialHealth"
  | "recentNews"
  | "politicianTrading"
  | "analystConsensus"
  | "insiderActivity"
  | "bullCase"
  | "bearCase"
  | "finalVerdict";

export const SECTION_LABELS: Record<SectionId, string> = {
  companyOverview: "Company overview",
  financialHealth: "Financial health",
  recentNews: "Recent news",
  politicianTrading: "Politician trading activity",
  analystConsensus: "Analyst consensus",
  insiderActivity: "Insider activity",
  bullCase: "Bull case",
  bearCase: "Bear case",
  finalVerdict: "Final verdict",
};

export const SECTION_ORDER: SectionId[] = [
  "companyOverview",
  "financialHealth",
  "recentNews",
  "politicianTrading",
  "analystConsensus",
  "insiderActivity",
  "bullCase",
  "bearCase",
  "finalVerdict",
];

// A source is a real, clickable reference attached to a section.
export interface Source {
  label: string; // e.g. "Financial Modeling Prep — Company profile"
  url: string; // the exact endpoint or page the data came from
}

export interface CompanyOverview {
  whatItDoes: string;
  sector: string;
  industry: string;
  marketCap: string; // formatted, e.g. "$2.91T"
}

export interface FinancialHealth {
  revenue: string;
  netIncome: string;
  profitMargin: string;
  grossMargin?: string;
  debt: string;
  cashFlow: string;
  score: number; // 1..10
  scoreRationale: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  date: string;
  url: string;
}

export interface PoliticianTrade {
  name: string;
  party: string; // "" / "Unknown" if not available
  transactionType: string; // "Buy" / "Sell" / etc.
  date: string;
  amountRange: string;
}

export interface PoliticianTrading {
  hasData: boolean;
  trades: PoliticianTrade[];
  note: string; // shown when hasData is false, e.g. "No disclosed trades found."
}

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface FinalVerdict {
  summary: string;
  confidence: ConfidenceLevel;
}

export interface AnalystConsensus {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  bullPct: number;
  holdPct: number;
  bearPct: number;
}

export interface InsiderTransaction {
  name: string;
  transactionCode: string;
  transactionType: string;
  shares: number;
  pricePerShare: number | null;
  value: number | null;
  date: string;
}

export interface InsiderActivity {
  transactions: InsiderTransaction[];
  netShares: number;
}

// The full report. Every field is optional because the user picks sections.
export interface GeneratedReport {
  companyOverview?: CompanyOverview;
  financialHealth?: FinancialHealth;
  recentNews?: { items: NewsItem[] };
  politicianTrading?: PoliticianTrading;
  analystConsensus?: AnalystConsensus;
  insiderActivity?: InsiderActivity;
  bullCase?: { reasons: string[] };
  bearCase?: { risks: string[] };
  finalVerdict?: FinalVerdict;
  peers?: string[];
}

// Sources are stored per section so the report page can show a
// "Sources" area beneath each card.
export type SourcesBySection = Partial<Record<SectionId, Source[]>>;

// Shape of a row in the `analyses` table.
export interface AnalysisRow {
  id: string;
  user_id: string;
  ticker: string;
  selected_sections: SectionId[];
  generated_report: GeneratedReport;
  sources: SourcesBySection;
  created_at: string;
}
