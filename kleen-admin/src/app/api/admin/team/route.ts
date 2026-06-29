import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireSuperadminApi } from "@/lib/require-admin-api";
import type { AdminStaffRole } from "@/lib/admin-staff";

/** List admin staff + allowlist (superadmin only). */
export async function GET() {
  const auth = await requireSuperadminApi();
  if (!auth.ok) return auth.response;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const [{ data: staff }, { data: allowlist }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, admin_role, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true }),
    admin.from("admin_email_allowlist").select("email, admin_role, created_at").order("created_at"),
  ]);

  return NextResponse.json({ staff: staff || [], allowlist: allowlist || [] });
}

/** Add staff email to allowlist (superadmin). User must sign up / be invited in Supabase Auth. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperadminApi();
  if (!auth.ok) return auth.response;

  let body: { email?: string; admin_role?: AdminStaffRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const adminRole: AdminStaffRole = body.admin_role === "superadmin" ? "superadmin" : "staff";

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { error: allowErr } = await admin.from("admin_email_allowlist").upsert(
    { email, admin_role: adminRole },
    { onConflict: "email" },
  );

  if (allowErr) {
    return NextResponse.json({ error: allowErr.message }, { status: 400 });
  }

  // If auth user already exists, promote profile to admin
  const { data: existing } = await admin.from("profiles").select("id, role").eq("email", email).maybeSingle();
  if (existing && existing.role !== "admin") {
    await admin.from("profiles").update({ role: "admin", admin_role: adminRole }).eq("id", existing.id);
  } else if (existing?.role === "admin") {
    await admin.from("profiles").update({ admin_role: adminRole }).eq("id", existing.id);
  }

  return NextResponse.json({ ok: true, email, admin_role: adminRole });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuperadminApi();
  if (!auth.ok) return auth.response;

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  if (email === "info@kleenapp.co.uk") {
    return NextResponse.json({ error: "Cannot remove primary superadmin allowlist entry" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  await admin.from("admin_email_allowlist").delete().eq("email", email);

  return NextResponse.json({ ok: true });
}
