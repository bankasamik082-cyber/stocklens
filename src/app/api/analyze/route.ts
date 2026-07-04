import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getFinancials,
  getNews,
  getPoliticianTrades,
  getCompanyDescription,
  getAnalystRecommendations,
  getInsiderTransactions,
  getPeers,
  formatMoney,
  formatPct,
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
  "analystConsensus",
  "insiderActivity",
  "bullCase",
  "bearCase",
  "finalVerdict",
];

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

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

  const need = {
    profile:
      sections.includes("companyOverview") ||
      sections.includes("bullCase") ||
      sections.includes("bearCase") ||
      sections.includes("finalVerdict") ||
      sections.includes("recentNews"),
    financials:
      sections.includes("financialHealth") ||
      sections.includes("bullCase") ||
      sections.includes("bearCase") ||
      sections.includes("finalVerdict"),
    news: sections.includes("recentNews"),
    politician: sections.includes("politicianTrading"),
    analyst: sections.includes("analystConsensus") || sections.includes("bullCase") || sections.includes("bearCase") || sections.includes("finalVerdict"),
    insider: sections.includes("insiderActivity") || sections.includes("bullCase") || sections.includes("bearCase") || sections.includes("finalVerdict"),
  };

  try {
    // Fetch all data sources in parallel.
    const [profile, financials, politician, cik, analyst, insider, peers, fmpDescription] = await Promise.all([
      need.profile ? getProfile(ticker) : Promise.resolve(null),
      need.financials
        ? getFinancials(ticker)
        : Promise.resolve({ income: null, balance: null, cashflow: null }),
      need.politician
        ? getPoliticianTrades(ticker)
        : Promise.resolve({ senate: [], house: [] }),
      need.profile || need.financials ? getCik(ticker) : Promise.resolve(null),
      need.analyst ? getAnalystRecommendations(ticker) : Promise.resolve(null),
      need.insider ? getInsiderTransactions(ticker) : Promise.resolve(null),
      need.profile ? getPeers(ticker) : Promise.resolve([] as string[]),
      // Fetch FMP description for company overview (works on free tier for mega-caps)
      sections.includes("companyOverview") ? getCompanyDescription(ticker) : Promise.resolve(""),
    ]);

    const { income, balance, cashflow } = financials;

    const news = need.news
      ? await getNews(ticker, profile?.companyName || ticker)
      : [];

    const filings = cik ? await getRecentFilings(cik) : [];

    if (need.profile && !profile && !cik) {
      return NextResponse.json(
        { error: `Couldn't find data for "${ticker}". Check the ticker and try again.` },
        { status: 404 }
      );
    }

    const report: GeneratedReport = {};
    const sourcesBySection: SourcesBySection = {};

    const finnhubProfileSource: Source = {
      label: "Finnhub — Company profile",
      url: finnhubPublicUrl(`/stock/profile2?symbol=${ticker}`),
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

    const revenueStr = formatMoney(income?.revenue);
    const netIncomeStr = formatMoney(income?.netIncome);
    const marginStr =
      income && income.revenue
        ? formatPct(income.netIncome / income.revenue)
        : "Data not available";
    const grossMarginStr =
      income && income.revenue && income.grossProfit
        ? formatPct(income.grossProfit / income.revenue)
        : "Data not available";
    const debtStr = formatMoney(balance?.totalDebt);
    const cashFlowStr = formatMoney(cashflow?.operatingCashFlow);
    const marketCapStr = formatMoney(profile?.marketCap);

    if (sections.includes("companyOverview")) {
      report.companyOverview = {
        whatItDoes: fmpDescription || "",
        sector: profile?.sector || "Data not available",
        industry: profile?.industry || "",
        marketCap: marketCapStr,
      };
      sourcesBySection.companyOverview = [finnhubProfileSource, ...edgarSources];
    }

    if (sections.includes("financialHealth")) {
      report.financialHealth = {
        revenue: revenueStr,
        netIncome: netIncomeStr,
        profitMargin: marginStr,
        grossMargin: grossMarginStr,
        debt: debtStr,
        cashFlow: cashFlowStr,
        score: 0,
        scoreRationale: "",
      };
      sourcesBySection.financialHealth = [
        {
          label: "Finnhub — Financial statements (XBRL)",
          url: finnhubPublicUrl(`/stock/financials-reported?symbol=${ticker}&freq=annual`),
        },
        ...edgarSources,
      ];
    }

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
        ...news.slice(0, 6).map((n) => ({
          label: `${n.site || "Article"} — ${n.title}`.slice(0, 90),
          url: n.url,
        })),
      ];
    }

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
            : "No disclosed senator trades were found for this ticker in the past year. Trades are self-reported and may be delayed by up to 45 days.",
      };
      sourcesBySection.politicianTrading = [
        {
          label: "FMP — Senate Disclosures",
          url: `https://financialmodelingprep.com/financial-statements/senate-disclosure`,
        },
      ];
    }

    if (sections.includes("analystConsensus")) {
      report.analystConsensus = analyst ?? undefined;
      sourcesBySection.analystConsensus = [
        {
          label: "Finnhub — Analyst Recommendations",
          url: finnhubPublicUrl(`/stock/recommendation?symbol=${ticker}`),
        },
      ];
    }

    if (sections.includes("insiderActivity")) {
      report.insiderActivity = insider ?? undefined;
      sourcesBySection.insiderActivity = [
        {
          label: "Finnhub — Insider Transactions",
          url: finnhubPublicUrl(`/stock/insider-transactions?symbol=${ticker}`),
        },
      ];
    }

    // Always store peers when profile is fetched — used by ReportView regardless of sections
    if (peers && peers.length > 0) {
      report.peers = peers;
    }

    const narrativeReq = toNarrativeRequest(sections);
    // Skip AI-generated company description if we already have one from FMP
    if (fmpDescription) narrativeReq.whatItDoes = false;

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
          description: fmpDescription || profile?.description || "",
          sector: profile?.sector || "Unknown",
          industry: profile?.industry || "Unknown",
          marketCap: marketCapStr,
          revenue: revenueStr,
          netIncome: netIncomeStr,
          profitMargin: marginStr,
          grossMargin: grossMarginStr,
          debt: debtStr,
          cashFlow: cashFlowStr,
          newsHeadlines: news.slice(0, 5).map((n) => n.title),
          hasPoliticianData: report.politicianTrading?.hasData ?? false,
          analystBullPct: analyst?.bullPct,
          analystTotal: analyst?.total,
          insiderNetShares: insider?.netShares,
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
        sourcesBySection.bullCase = [finnhubProfileSource, ...edgarSources];
      }
      if (sections.includes("bearCase")) {
        report.bearCase = { risks: narrative.bearRisks ?? [] };
        sourcesBySection.bearCase = [finnhubProfileSource, ...edgarSources];
      }
      if (sections.includes("finalVerdict")) {
        report.finalVerdict = {
          summary: narrative.verdictSummary || "Data is limited.",
          confidence: narrative.verdictConfidence || "Low",
        };
        sourcesBySection.finalVerdict = [finnhubProfileSource, ...edgarSources];
      }
    }

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

    return NextResponse.json({ id: inserted.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
