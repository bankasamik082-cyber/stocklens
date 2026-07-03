import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TICKER_RE = /^[A-Z.\-]{1,10}$/;
const MAX_ROWS = 100;

interface ImportRow {
  ticker: string;
  shares: number;
  avg_cost: number | null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { rows?: ImportRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const rows = (body.rows ?? [])
    .slice(0, MAX_ROWS)
    .map((r) => ({
      ticker: String(r.ticker ?? "").trim().toUpperCase(),
      shares: Number(r.shares),
      avg_cost: r.avg_cost != null ? Number(r.avg_cost) : null,
    }))
    .filter(
      (r) =>
        TICKER_RE.test(r.ticker) &&
        Number.isFinite(r.shares) &&
        r.shares > 0 &&
        (r.avg_cost == null || (Number.isFinite(r.avg_cost) && r.avg_cost >= 0))
    );

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows to import." }, { status: 400 });
  }

  const { error } = await supabase.from("portfolio_holdings").insert(
    rows.map((r) => ({
      user_id: user.id,
      ticker: r.ticker,
      shares: r.shares,
      avg_cost: r.avg_cost,
    }))
  );

  if (error) {
    const msg = error.message.includes("portfolio_holdings")
      ? error.message + " (run the portfolio_holdings migration in Supabase)"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ success: true, imported: rows.length });
}
