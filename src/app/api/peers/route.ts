import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPeers } from "@/lib/fmp";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const peers = await getPeers(ticker).catch(() => [] as string[]);
  return NextResponse.json({ peers });
}
