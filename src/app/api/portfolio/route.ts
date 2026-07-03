import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TICKER_RE = /^[A-Z.\-]{1,10}$/;

function migrationHint(msg: string) {
  return msg.includes("portfolio_holdings")
    ? msg + " (run the portfolio_holdings migration in Supabase)"
    : msg;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("id, ticker, shares, avg_cost, purchased_date, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });
  }
  return NextResponse.json({ holdings: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { ticker?: string; shares?: number; avg_cost?: number | null; purchased_date?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const ticker = (body.ticker ?? "").trim().toUpperCase();
  const shares = Number(body.shares);
  const avgCost = body.avg_cost != null && body.avg_cost !== ("" as unknown) ? Number(body.avg_cost) : null;
  const purchasedDate = body.purchased_date || null;

  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return NextResponse.json({ error: "Shares must be a positive number." }, { status: 400 });
  }
  if (avgCost != null && (!Number.isFinite(avgCost) || avgCost < 0)) {
    return NextResponse.json({ error: "Average cost must be a non-negative number." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("portfolio_holdings")
    .insert({
      user_id: user.id,
      ticker,
      shares,
      avg_cost: avgCost,
      purchased_date: purchasedDate,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Missing holding id." }, { status: 400 });

  const { error } = await supabase
    .from("portfolio_holdings")
    .delete()
    .eq("user_id", user.id)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
