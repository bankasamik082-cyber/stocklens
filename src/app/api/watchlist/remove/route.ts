import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let ticker: string;
  try {
    const body = await req.json();
    ticker = (body.ticker as string)?.trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_stocks")
    .delete()
    .eq("user_id", user.id)
    .eq("ticker", ticker);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
