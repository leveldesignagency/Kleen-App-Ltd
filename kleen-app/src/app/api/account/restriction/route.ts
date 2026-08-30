import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getActiveBanForUser } from "@/lib/account-restriction";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveBanForUser(user.id);
  if (!active) {
    return NextResponse.json({ restricted: false });
  }

  const admin = createServiceRoleClient();
  let pendingAppeal = false;
  if (active.ban.id !== "legacy") {
    const { data: appeal } = await admin
      .from("ban_appeals")
      .select("id, status")
      .eq("ban_id", active.ban.id)
      .eq("appellant_user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    pendingAppeal = Boolean(appeal);
  }

  return NextResponse.json({
    restricted: true,
    ban: active.ban,
    subjectType: active.subjectType,
    pendingAppeal,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 20) {
    return NextResponse.json({ error: "Please explain your appeal in at least 20 characters." }, { status: 400 });
  }

  const active = await getActiveBanForUser(user.id);
  if (!active || active.ban.id === "legacy") {
    return NextResponse.json(
      { error: "No appealable ban on file. Contact support@kleenapp.co.uk." },
      { status: 400 },
    );
  }
  if (!active.ban.appeal_allowed) {
    return NextResponse.json({ error: "Appeals are not permitted for this restriction." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("ban_appeals")
    .select("id")
    .eq("ban_id", active.ban.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "You already have a pending appeal." }, { status: 409 });
  }

  const { error } = await admin.from("ban_appeals").insert({
    ban_id: active.ban.id,
    appellant_user_id: user.id,
    message,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
