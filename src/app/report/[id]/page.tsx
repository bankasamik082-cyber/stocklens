import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { ReportView } from "@/components/ReportView";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const analysis = data as AnalysisRow;
  const report = analysis.generated_report as GeneratedReport;
  const sources = analysis.sources as SourcesBySection;
  const selected = analysis.selected_sections as SectionId[];

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-600 transition hover:text-white"
          >
            <span>←</span>
            <span>Dashboard</span>
          </Link>
          <span className="text-xs text-slate-700">
            {new Date(analysis.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Report header */}
        <div className="mb-8 rounded-2xl border border-white/[0.07] bg-ink-800/40 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                Research Report
              </div>
              <h1 className="font-mono text-4xl font-bold tracking-wider text-white">
                {analysis.ticker}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Research report · not financial advice
              </p>
            </div>
            <Badge tone="brand">{selected.length} sections</Badge>
          </div>
        </div>

        <ReportView report={report} sources={sources} selected={selected} />

        <div className="mt-8 rounded-xl border border-white/[0.04] bg-ink-800/30 px-5 py-4 text-xs leading-relaxed text-slate-700">
          StockLens summarizes publicly available data for research and education.
          It does not recommend buying or selling any security. Always do your own
          research and consider consulting a licensed financial professional.
        </div>
      </main>
    </div>
  );
}
