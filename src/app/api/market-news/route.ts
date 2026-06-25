import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeneralNews } from "@/lib/fmp";

// Returns top general market headlines. No ticker required.
// Auth-gated. Reads directly from Finnhub — no AI call so it stays
// within Vercel Hobby's 10-second function timeout.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const news = await getGeneralNews(20);
    return NextResponse.json({ news });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}