import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  INVESTOR_TYPES,
  INVESTMENT_FOCUS,
  EXPERIENCE_LEVELS,
  AVATARS,
  EMPTY_PROFILE,
} from "@/lib/profile";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, display_name, investor_type, investment_focus, experience_level, avatar")
    .eq("user_id", user.id)
    .maybeSingle();

  // Table may not exist until the migration runs — treat as empty profile
  if (error) return NextResponse.json({ profile: EMPTY_PROFILE, unmigrated: true });
  return NextResponse.json({ profile: data ?? EMPTY_PROFILE });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const str = (v: unknown, max = 60) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const investorType = str(body.investor_type);
  const experience = str(body.experience_level);
  const avatar = str(body.avatar, 8);
  const focus = Array.isArray(body.investment_focus)
    ? body.investment_focus.filter(
        (f): f is string =>
          typeof f === "string" && (INVESTMENT_FOCUS as readonly string[]).includes(f)
      )
    : [];

  const row = {
    user_id: user.id,
    first_name: str(body.first_name),
    last_name: str(body.last_name),
    display_name: str(body.display_name),
    investor_type:
      investorType && (INVESTOR_TYPES as readonly string[]).includes(investorType)
        ? investorType
        : null,
    investment_focus: focus,
    experience_level:
      experience && (EXPERIENCE_LEVELS as readonly string[]).includes(experience)
        ? experience
        : null,
    avatar: avatar && (AVATARS as readonly string[]).includes(avatar) ? avatar : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_profiles")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    const hint = error.message.includes("user_profiles")
      ? " (run the user_profiles migration in Supabase)"
      : "";
    return NextResponse.json({ error: error.message + hint }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
