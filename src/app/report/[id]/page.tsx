import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { ReportView } from "@/components/ReportView";
import { PageTransition } from "@/components/PageTransition";
import type {
  AnalysisRow,
  GeneratedReport,
  SectionId,
  SourcesBySection,
} from "@/lib/types";

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
            className="mb-8 rounded-2xl border px-6 py-5 backdrop-blur-sm"
            style={{
              borderColor: `rgb(var(--t-border) / 0.7)`,
              backgroundColor: `rgb(var(--t-surface))`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label mb-2">Research Report</div>
                <h1
                  className="font-mono text-4xl font-bold tracking-wider"
                  style={{ color: `rgb(var(--t-text))` }}
                >
                  {analysis.ticker}
                </h1>
                <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-dim))` }}>
                  AI research report · not financial advice
                </p>
              </div>
              <Badge tone="brand">{selected.length} sections</Badge>
            </div>
          </div>

          <ReportView report={report} sources={sources} selected={selected} />

          <div
            className="mt-8 rounded-xl border px-5 py-4 text-xs leading-relaxed"
            style={{
              borderColor: `rgb(var(--t-border) / 0.5)`,
              backgroundColor: `rgb(var(--t-card))`,
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
