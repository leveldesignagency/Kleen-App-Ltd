import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requirePermissionApi } from "@/lib/require-admin-api";

const REASONS = new Set(["fraud", "safety", "legal_claim", "regulatory", "dispute", "other"]);
const SUBJECTS = new Set(["user", "operative", "job"]);

async function enrichHolds(
  admin: ReturnType<typeof createServiceRoleClient>,
  holds: Array<Record<string, unknown>>,
) {
  const userIds = holds.filter((h) => h.subject_type === "user").map((h) => String(h.subject_id));
  const opIds = holds.filter((h) => h.subject_type === "operative").map((h) => String(h.subject_id));
  const jobIds = holds.filter((h) => h.subject_type === "job").map((h) => String(h.subject_id));

  const [users, ops, jobs] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }),
    opIds.length
      ? admin
          .from("operatives")
          .select("id, full_name, email, company_name")
          .in("id", opIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string | null;
            company_name: string | null;
          }>,
        }),
    jobIds.length
      ? admin.from("jobs").select("id, reference, postcode").in("id", jobIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; reference: string | null; postcode: string | null }>,
        }),
  ]);

  const userMap = new Map((users.data || []).map((u) => [u.id, u]));
  const opMap = new Map((ops.data || []).map((o) => [o.id, o]));
  const jobMap = new Map((jobs.data || []).map((j) => [j.id, j]));

  return holds.map((h) => {
    const id = String(h.subject_id);
    if (h.subject_type === "user") {
      const u = userMap.get(id);
      return {
        ...h,
        subject_label: u?.full_name?.trim() || u?.email || null,
        subject_detail: u?.email || null,
      };
    }
    if (h.subject_type === "operative") {
      const o = opMap.get(id);
      return {
        ...h,
        subject_label: o?.company_name?.trim() || o?.full_name?.trim() || o?.email || null,
        subject_detail: [o?.full_name, o?.email].filter(Boolean).join(" · ") || null,
      };
    }
    const j = jobMap.get(id);
    return {
      ...h,
      subject_label: j?.reference || null,
      subject_detail: j?.postcode || null,
    };
  });
}

/** List active (and optional released) legal holds — admin/legal only. */
export async function GET(request: NextRequest) {
  const auth = await requirePermissionApi("legal_holds.view");
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

  const holds = await enrichHolds(supabase, (data || []) as Array<Record<string, unknown>>);
  return NextResponse.json({ holds });
}

/** Place a legal hold. */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("legal_holds.manage");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const subjectType = String(body.subjectType || "");
  const subjectId = String(body.subjectId || "");
  const reason = String(body.reason || "");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!SUBJECTS.has(subjectType) || !subjectId) {
    return NextResponse.json({ error: "Select an account or job first" }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  if (reason === "other" && notes.length < 8) {
    return NextResponse.json({ error: "Notes required for reason=other" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Validate subject exists
  if (subjectType === "user") {
    const { data } = await supabase.from("profiles").select("id").eq("id", subjectId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  } else if (subjectType === "operative") {
    const { data } = await supabase.from("operatives").select("id").eq("id", subjectId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  } else {
    const { data } = await supabase.from("jobs").select("id").eq("id", subjectId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

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
  const auth = await requirePermissionApi("legal_holds.manage");
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
