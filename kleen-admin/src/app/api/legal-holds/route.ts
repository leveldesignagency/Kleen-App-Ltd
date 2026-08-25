import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

const REASONS = new Set(["fraud", "safety", "legal_claim", "regulatory", "dispute", "other"]);
const SUBJECTS = new Set(["user", "operative", "job"]);

/** List active (and optional released) legal holds — admin/legal only. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const includeReleased = request.nextUrl.searchParams.get("includeReleased") === "1";
  const supabase = createServiceRoleClient();

  let q = supabase
    .from("legal_holds")
    .select("*")
    .order("placed_at", { ascending: false })
    .limit(200);

  if (!includeReleased) {
    q = q.is("released_at", null);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ holds: data || [] });
}

/** Place a legal hold. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const subjectType = String(body.subjectType || "");
  const subjectId = String(body.subjectId || "");
  const reason = String(body.reason || "");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!SUBJECTS.has(subjectType) || !subjectId) {
    return NextResponse.json({ error: "subjectType and subjectId required" }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  if (reason === "other" && notes.length < 8) {
    return NextResponse.json({ error: "Notes required for reason=other" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("legal_holds")
    .insert({
      subject_type: subjectType,
      subject_id: subjectId,
      reason,
      notes: notes || null,
      placed_by: auth.userId,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, hold: data });
}

/** Release a legal hold. */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const holdId = String(body.holdId || "");
  const releaseNotes = typeof body.releaseNotes === "string" ? body.releaseNotes.trim() : "";

  if (!holdId) {
    return NextResponse.json({ error: "holdId required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("legal_holds")
    .update({
      released_at: new Date().toISOString(),
      released_by: auth.userId,
      release_notes: releaseNotes || null,
    })
    .eq("id", holdId)
    .is("released_at", null)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, hold: data });
}
