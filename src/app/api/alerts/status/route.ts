import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data } = await supabase
    .from("alert_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ subscribed: !!data });
}
