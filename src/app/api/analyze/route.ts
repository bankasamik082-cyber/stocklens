import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getIncome,
  getBalance,
  getCashFlow,
  getNews,
  getPoliticianTrades,
  formatMoney,
  formatPct,
  publicUrl,
  finnhubPublicUrl,
  type FmpPoliticianTrade,
} from "@/lib/fmp";
import {
  getCik,
  getRecentFilings,
  edgarBrowsePage,
} from "@/lib/edgar";
import { generateNarrative, toNarrativeRequest } from "@/lib/openai";
import type {
  GeneratedReport,
  PoliticianTrade,
  SectionId,
  Source,
  SourcesBySection,
} from "@/lib/types";

const VALID_SECTIONS: SectionId[] = [
  "companyOverview",
  "financialHealth",
  "recentNews",
  "politicianTrading",
  "bullCase",
  "bearCase",
  "finalVerdict",
];

// Normalize FMP's two politician-trade shapes into our single shape.
function normalizeTrade(t: FmpPoliticianTrade): PoliticianTrade {
  const name =
    t.representative ||
    [t.firstName, t.lastName].filter(Boolean).join(" ") ||
    "Unknown";
  return {
    name,
    party: t.party || "Unknown",
    transactionType: t.type || "Unknown",
    date: t.transactionDate || t.dateRecieved || "Unknown",
    amountRange: t.amount || "Not disclosed",
  };
}

export async function POST(req: Request) {
  // 1. Auth — only logged-in users can run an analysis.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // 2. Validate input.
  let body: { ticker?: string; sections?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ticker = (body.ticker || "").trim().toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json(
      { error: "Enter a valid ticker, like AAPL or NVDA." },
      { status: 400 }
    );
  }

  const sections = (body.sections || []).filter((s): s is SectionId =>
    VALID_SECTIONS.includes(s as SectionId)
  );
  if (sections.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one report section." },
      { status: 400 }
    );
  }

  // Figure out which data we actually need to fetch.
  const need = {
    profile:
      sections.includes("companyOverview") ||
      sections.includes("bullCase") ||
      sections.includes("bearCase") ||
      sections.includes("finalVerdict") ||
      sections.includes("recentNews"), // news filtering needs the company name
    financials:
      sections.includes("financialHealth") ||
      sections.includes("bullCase") ||
      sections.includes("bearCase") ||
      sections.includes("finalVerdict"),
    news: sections.includes("recentNews"),
    politician: sections.includes("politicianTrading"),
  };

  try {
    // 3. Fetch profile, financials, politician trades and CIK in parallel.
    const [profile, income, balance, cashflow, politician, cik] =
      await Promise.all([
        need.profile ? getProfile(ticker) : Promise.resolve(null),
        need.financials ? getIncome(ticker) : Promise.resolve(null),
        need.financials ? getBalance(ticker) : Promise.resolve(null),
        need.financials ? getCashFlow(ticker) : Promise.resolve(null),
        need.politician
          ? getPoliticianTrades(ticker)
          : Promise.resolve({ senate: [], house: [] }),
        need.profile || need.financials
          ? getCik(ticker)
          : Promise.resolve(null),
      ]);

    // News needs the company name (from profile) to filter for relevance,
    // so it runs after the profile fetch resolves.
    const news = need.news
      ? await getNews(ticker, profile?.companyName || ticker)
      : [];

    // EDGAR filings (used as sources for overview + financials).
    const filings = cik ? await getRecentFilings(cik) : [];

    // Bail early if we truly can't find the company at all.
    if (need.profile && !profile && !cik) {
      return NextResponse.json(
        {
          error: `Couldn't find data for "${ticker}". Check the ticker and try again.`,
        },
        { status: 404 }
      );
    }

    // 4. Build deterministic data + sources (no AI involved here).
    const report: GeneratedReport = {};
    const sourcesBySection: SourcesBySection = {};

    const fmpProfileSource: Source = {
      label: "Financial Modeling Prep — Company profile",
      url: publicUrl(`/profile?symbol=${ticker}`),
    };
    const edgarSources: Source[] = [];
    if (cik) {
      edgarSources.push({
        label: "SEC EDGAR — Company filings",
        url: edgarBrowsePage(cik),
      });
      for (const f of filings) {
        edgarSources.push({
          label: `SEC EDGAR — ${f.form} filed ${f.filingDate}`,
          url: f.url,
        });
      }
    }

    // Compute the numeric pieces up front so we can pass them to the model.
    const revenueStr = formatMoney(income?.revenue);
    const netIncomeStr = formatMoney(income?.netIncome);
    const marginStr =
      income && income.revenue
        ? formatPct(income.netIncome / income.revenue)
        : "Data not available";
    const debtStr = formatMoney(balance?.totalDebt);
    const cashFlowStr = formatMoney(cashflow?.operatingCashFlow);
    const marketCapStr = formatMoney(profile?.marketCap);

    // ---- Company overview (deterministic fields) ----
    if (sections.includes("companyOverview")) {
      report.companyOverview = {
        whatItDoes: "", // filled by the model below
        sector: profile?.sector || "Data not available",
        industry: profile?.industry || "Data not available",
        marketCap: marketCapStr,
      };
      sourcesBySection.companyOverview = [fmpProfileSource, ...edgarSources];
    }

    // ---- Financial health (deterministic numbers) ----
    if (sections.includes("financialHealth")) {
      report.financialHealth = {
        revenue: revenueStr,
        netIncome: netIncomeStr,
        profitMargin: marginStr,
        debt: debtStr,
        cashFlow: cashFlowStr,
        score: 0, // filled by the model below
        scoreRationale: "",
      };
      const finSources: Source[] = [
        {
          label: "Financial Modeling Prep — Income statement",
          url: publicUrl(`/income-statement?symbol=${ticker}`),
        },
        {
          label: "Financial Modeling Prep — Balance sheet",
          url: publicUrl(`/balance-sheet-statement?symbol=${ticker}`),
        },
        {
          label: "Financial Modeling Prep — Cash flow statement",
          url: publicUrl(`/cash-flow-statement?symbol=${ticker}`),
        },
        ...edgarSources,
      ];
      sourcesBySection.financialHealth = finSources;
    }

    // ---- Recent news (from Finnhub) ----
    if (sections.includes("recentNews")) {
      report.recentNews = {
        items: news.map((n) => ({
          title: n.title,
          summary: (n.text || "").slice(0, 220),
          date: (n.publishedDate || "").slice(0, 10),
          url: n.url,
        })),
      };
      sourcesBySection.recentNews = [
        {
          label: "Finnhub — Company news",
          url: finnhubPublicUrl(`/company-news?symbol=${ticker}`),
        },
        // Each article is also its own source.
        ...news.slice(0, 6).map((n) => ({
          label: `${n.site || "Article"} — ${n.title}`.slice(0, 90),
          url: n.url,
        })),
      ];
    }

    // ---- Politician trading (straight from FMP, clearly flagged if empty) ----
    if (sections.includes("politicianTrading")) {
      const all = [...politician.senate, ...politician.house]
        .map(normalizeTrade)
        .slice(0, 15);
      report.politicianTrading = {
        hasData: all.length > 0,
        trades: all,
        note:
          all.length > 0
            ? ""
            : "No disclosed politician trades were found for this ticker in the available data. This does not mean none exist — disclosure data can be incomplete or require a paid data plan.",
      };
      sourcesBySection.politicianTrading = [
        {
          label: "Financial Modeling Prep — Senate trading disclosures",
          url: publicUrl(`/senate-trades?symbol=${ticker}`),
        },
        {
          label: "Financial Modeling Prep — House trading disclosures",
          url: publicUrl(`/house-trades?symbol=${ticker}`),
        },
      ];
    }

    // 5. Ask the model for the qualitative pieces only.
    const narrativeReq = toNarrativeRequest(sections);
    const wantsNarrative =
      narrativeReq.whatItDoes ||
      narrativeReq.financialScore ||
      narrativeReq.bullCase ||
      narrativeReq.bearCase ||
      narrativeReq.finalVerdict;

    if (wantsNarrative) {
      const narrative = await generateNarrative(
        {
          ticker,
          companyName: profile?.companyName || ticker,
          description: profile?.description || "",
          sector: profile?.sector || "Unknown",
          industry: profile?.industry || "Unknown",
          marketCap: marketCapStr,
          revenue: revenueStr,
          netIncome: netIncomeStr,
          profitMargin: marginStr,
          debt: debtStr,
          cashFlow: cashFlowStr,
          newsHeadlines: news.slice(0, 5).map((n) => n.title),
          hasPoliticianData:
            report.politicianTrading?.hasData ?? false,
        },
        narrativeReq
      );

      if (report.companyOverview && narrative.whatItDoes) {
        report.companyOverview.whatItDoes = narrative.whatItDoes;
      }
      if (report.financialHealth) {
        report.financialHealth.score = narrative.financialScore ?? 0;
        report.financialHealth.scoreRationale =
          narrative.financialScoreRationale || "Data is limited.";
      }
      if (sections.includes("bullCase")) {
        report.bullCase = { reasons: narrative.bullReasons ?? [] };
        sourcesBySection.bullCase = [fmpProfileSource, ...edgarSources];
      }
      if (sections.includes("bearCase")) {
        report.bearCase = { risks: narrative.bearRisks ?? [] };
        sourcesBySection.bearCase = [fmpProfileSource, ...edgarSources];
      }
      if (sections.includes("finalVerdict")) {
        report.finalVerdict = {
          summary: narrative.verdictSummary || "Data is limited.",
          confidence: narrative.verdictConfidence || "Low",
        };
        sourcesBySection.finalVerdict = [fmpProfileSource, ...edgarSources];
      }
    }

    // 6. Persist the analysis.
    const { data: inserted, error: insertError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        ticker,
        selected_sections: sections,
        generated_report: report,
        sources: sourcesBySection,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Could not save the analysis. " + (insertError?.message || "") },
        { status: 500 }
      );
    }

    // 7. Return the new analysis id so the client can navigate to it.
    return NextResponse.json({ id: inserted.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}