import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { ReportView } from "@/components/ReportView";
import { PageTransition } from "@/components/PageTransition";
import { ChatButton } from "@/components/ChatButton";
import { QuickActions } from "@/components/QuickActions";
import { getProfile, getCeo, formatMoney } from "@/lib/fmp";
import type {
  AnalysisRow,
  GeneratedReport,
  SectionId,
  SourcesBySection,
} from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("analyses")
    .select("ticker")
    .eq("id", id)
    .single();
  return {
    title: data?.ticker
      ? `${data.ticker} Research Report | StockLens`
      : "Research Report | StockLens",
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const analysis = data as AnalysisRow;
  const report   = analysis.generated_report as GeneratedReport;
  const sources  = analysis.sources as SourcesBySection;
  const selected = analysis.selected_sections as SectionId[];

  // Live hero details + watchlist state + peer names, fetched in parallel
  const peerTickers = ((report.peers ?? []) as string[]).slice(0, 8);
  const [profile, ceo, { data: savedRow }, peerProfiles] = await Promise.all([
    getProfile(analysis.ticker).catch(() => null),
    getCeo(analysis.ticker).catch(() => null),
    supabase
      .from("saved_stocks")
      .select("id")
      .eq("user_id", user.id)
      .eq("ticker", analysis.ticker)
      .maybeSingle(),
    Promise.all(
      peerTickers.map((p) => getProfile(p).catch(() => null))
    ),
  ]);

  const peerNames: Record<string, string> = {};
  peerTickers.forEach((p, i) => {
    const name = peerProfiles[i]?.companyName;
    if (name) peerNames[p] = name;
  });

  const heroFacts = [
    profile?.sector ? { label: "Sector", value: profile.sector } : null,
    profile?.industry && profile.industry !== profile.sector
      ? { label: "Industry", value: profile.industry }
      : null,
    profile?.marketCap ? { label: "Market Cap", value: formatMoney(profile.marketCap) } : null,
    ceo ? { label: "CEO", value: ceo } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-4 py-10">

          {/* Breadcrumb */}
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="hover-accent-text flex items-center gap-1.5 text-sm"
              style={{ color: `rgb(var(--t-muted))` }}
            >
              <span>←</span>
              <span>Dashboard</span>
            </Link>
            <span className="text-xs" style={{ color: `rgb(var(--t-dim))` }}>
              {new Date(analysis.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Report header — Company Hero */}
          <div
            className="mb-8 rounded-3xl border px-6 py-6"
            style={{
              borderColor: `rgb(var(--t-text) / 0.08)`,
              backgroundColor: `var(--card-bg, rgb(var(--t-surface)))`,
              backdropFilter: `var(--card-blur, none)`,
              WebkitBackdropFilter: `var(--card-blur, none)`,
              boxShadow: `var(--card-shadow, none)`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="label mb-3">Research Report</div>
                {profile?.companyName && (
                  <p
                    className="font-display truncate font-bold tracking-tight"
                    style={{ fontSize: "1.75rem", lineHeight: 1.2, color: `rgb(var(--t-text))` }}
                  >
                    {profile.companyName}
                  </p>
                )}
                <h1
                  className={`font-display font-bold tracking-tight ${profile?.companyName ? "mt-0.5 text-xl" : "text-4xl"}`}
                  style={{
                    color: profile?.companyName ? `rgb(var(--t-accent))` : `rgb(var(--t-text))`,
                    fontFamily: `var(--font-mono), ui-monospace, monospace`,
                    textShadow: `0 0 48px rgb(var(--t-accent) / 0.15)`,
                  }}
                >
                  {analysis.ticker}
                </h1>
                <p className="mt-2 text-sm" style={{ color: `rgb(var(--t-dim))` }}>
                  AI research report · not financial advice
                </p>
              </div>
              <Badge tone="brand">{selected.length} sections</Badge>
            </div>

            {/* Company facts */}
            {heroFacts.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {heroFacts.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: `rgb(var(--t-text) / 0.07)`,
                      backgroundColor: `rgb(var(--t-text) / 0.03)`,
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `rgb(var(--t-dim))` }}>
                      {f.label}
                    </p>
                    <p
                      className="mt-0.5 truncate text-sm font-semibold"
                      style={{ color: `rgb(var(--t-text))`, fontFamily: `var(--font-mono), ui-monospace, monospace` }}
                      title={f.value}
                    >
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="mb-8">
            <QuickActions ticker={analysis.ticker} initiallySaved={!!savedRow} />
          </div>

          <ReportView report={report} sources={sources} selected={selected} peerNames={peerNames} />

          <p className="mt-4 text-center text-[11px]" style={{ color: `rgb(var(--t-dim))` }}>
            Data as of{" "}
            {new Date(analysis.created_at).toLocaleString(undefined, {
              month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}{" "}
            — regenerate for fresh data.
          </p>

          <ChatButton ticker={analysis.ticker} />

          <div
            className="mt-8 rounded-2xl border px-5 py-4 text-xs leading-relaxed"
            style={{
              borderColor: `rgb(var(--t-text) / 0.06)`,
              backgroundColor: `rgb(var(--t-text) / 0.02)`,
              color: `rgb(var(--t-dim))`,
            }}
          >
            StockLens summarizes publicly available data for research and education.
            It does not recommend buying or selling any security. Always do your own
            research and consider consulting a licensed financial professional.
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
