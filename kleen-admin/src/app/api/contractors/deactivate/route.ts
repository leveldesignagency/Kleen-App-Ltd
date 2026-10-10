import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requirePermissionApi } from "@/lib/require-admin-api";

/**
 * Soft-deactivate a contractor (admin delete).
 * Uses service role so RLS cannot silently no-op the update.
 * Clears portal link (user_id) and sets a 24-month document retention date.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("contractors.manage");
  if (!auth.ok) return auth.response;

  let body: { contractorId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contractorId = typeof body.contractorId === "string" ? body.contractorId.trim() : "";
  if (!contractorId) {
    return NextResponse.json({ error: "Missing contractorId" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: existing, error: findErr } = await admin
    .from("operatives")
    .select("id, full_name, email, is_active")
    .eq("id", contractorId)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  const retain = new Date();
  retain.setMonth(retain.getMonth() + 24);

  const { data: updated, error: updErr } = await admin
    .from("operatives")
    .update({
      is_active: false,
      user_id: null,
      documents_retain_until: retain.toISOString().slice(0, 10),
    })
    .eq("id", contractorId)
    .select("id, is_active, user_id, documents_retain_until")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }
  if (!updated || updated.is_active !== false) {
    return NextResponse.json(
      { error: "Deactivate did not persist. Check operatives RLS / columns." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    contractor: {
      id: existing.id,
      full_name: existing.full_name,
      email: existing.email,
      is_active: false,
      documents_retain_until: updated.documents_retain_until,
    },
  });
}
