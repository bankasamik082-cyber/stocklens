import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeneralNews } from "@/lib/fmp";
import { rewriteHeadlines } from "@/lib/openai";

// Returns top general market headlines. No ticker required.
// Auth-gated like the rest of the app, but does not hit the AI or
// persist anything beyond a lightweight headline rewrite pass —
// this is a read-only feed, not a generated report.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const news = await getGeneralNews(24);

    // Rewrite headlines to be punchier, still factually tied to the
    // original. The original title is kept too so it's never lost.
    const rewritten = await rewriteHeadlines(
      news.map((n) => ({ title: n.title, text: n.text }))
    );

    const withDisplayTitle = news.map((n, i) => ({
      ...n,
      displayTitle: rewritten[i] || n.title,
    }));

    return NextResponse.json({ news: withDisplayTitle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}