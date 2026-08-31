import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requirePermissionApi } from "@/lib/require-admin-api";
import {
  assignableRoles,
  canGrantRole,
  grantablePermissions,
  normalizeAdminRole,
  parsePermissionList,
  resolvePermissions,
  ROLE_TEMPLATES,
  sanitizeGrantedPermissions,
  type AdminPermission,
  type AdminStaffRole,
} from "@/lib/admin-permissions";

/** Directory + allowlist + org metadata. */
export async function GET() {
  const auth = await requirePermissionApi("team.view");
  if (!auth.ok) return auth.response;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const [{ data: staff }, { data: allowlist }, { data: records }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, admin_role, admin_permissions, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true }),
    admin
      .from("admin_email_allowlist")
      .select("email, admin_role, admin_permissions, created_at")
      .order("created_at"),
    admin.from("admin_staff_records").select("*"),
  ]);

  const recordByProfile = new Map((records || []).map((r) => [r.profile_id, r]));

  const enrichedStaff = (staff || []).map((s) => ({
    ...s,
    admin_role: normalizeAdminRole(s.admin_role),
    admin_permissions: parsePermissionList(s.admin_permissions),
    permissions: resolvePermissions(s.admin_role, s.admin_permissions),
    record: recordByProfile.get(s.id) ?? null,
  }));

  return NextResponse.json({
    staff: enrichedStaff,
    allowlist: (allowlist || []).map((a) => ({
      ...a,
      admin_role: normalizeAdminRole(a.admin_role),
      admin_permissions: parsePermissionList(a.admin_permissions),
    })),
    assignableRoles: assignableRoles(auth.adminRole),
    grantablePermissions: grantablePermissions(auth.adminRole, auth.adminPermissions),
    canInvite: auth.permissions.includes("team.invite"),
    canManage: auth.permissions.includes("team.manage"),
    canContracts: auth.permissions.includes("team.contracts"),
  });
}

/** Invite / provision staff on allowlist. */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("team.invite");
  if (!auth.ok) return auth.response;

  let body: {
    email?: string;
    admin_role?: AdminStaffRole;
    admin_permissions?: string[];
    job_title?: string;
    department?: string;
    reports_to?: string;
    start_date?: string;
    internal_notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const targetRole = normalizeAdminRole(body.admin_role || "support");
  if (!canGrantRole(auth.adminRole, targetRole)) {
    return NextResponse.json({ error: "You cannot assign that role level" }, { status: 403 });
  }

  const roleTemplate = ROLE_TEMPLATES[targetRole] ?? [];
  const requestedPerms = body.admin_permissions?.length
    ? body.admin_permissions
    : [...roleTemplate];
  const granted = sanitizeGrantedPermissions(
    auth.adminRole,
    auth.adminPermissions,
    targetRole,
    requestedPerms,
  );

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { error: allowErr } = await admin.from("admin_email_allowlist").upsert(
    {
      email,
      admin_role: targetRole,
      admin_permissions: granted,
    },
    { onConflict: "email" },
  );

  if (allowErr) {
    return NextResponse.json({ error: allowErr.message }, { status: 400 });
  }

  const { data: existing } = await admin.from("profiles").select("id, role").eq("email", email).maybeSingle();
  let profileId = existing?.id;

  if (existing && existing.role !== "admin") {
    await admin
      .from("profiles")
      .update({ role: "admin", admin_role: targetRole, admin_permissions: granted })
      .eq("id", existing.id);
  } else if (existing?.role === "admin") {
    await admin
      .from("profiles")
      .update({ admin_role: targetRole, admin_permissions: granted })
      .eq("id", existing.id);
  }

  if (profileId) {
    await admin.from("admin_staff_records").upsert(
      {
        profile_id: profileId,
        job_title: body.job_title?.trim() || null,
        department: body.department?.trim() || null,
        reports_to: body.reports_to || null,
        start_date: body.start_date || null,
        internal_notes: body.internal_notes?.trim() || null,
        employment_status: "onboarding",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    );
  }

  return NextResponse.json({
    ok: true,
    email,
    admin_role: targetRole,
    admin_permissions: granted,
    pending_signup: !profileId,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePermissionApi("team.manage");
  if (!auth.ok) return auth.response;

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  if (email === "info@kleenapp.co.uk") {
    return NextResponse.json({ error: "Cannot remove primary master admin" }, { status: 400 });
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
