import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requirePermissionApi } from "@/lib/require-admin-api";
import {
  canGrantRole,
  isMasterAdmin,
  normalizeAdminRole,
  parsePermissionList,
  resolvePermissions,
  ROLE_TEMPLATES,
  sanitizeGrantedPermissions,
  type AdminStaffRole,
} from "@/lib/admin-permissions";

type RouteParams = { params: { id: string } };

/** Update staff member role, permissions, HR record. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermissionApi("team.manage");
  if (!auth.ok) return auth.response;

  const profileId = params.id;
  if (!profileId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: {
    admin_role?: AdminStaffRole;
    admin_permissions?: string[];
    job_title?: string;
    department?: string;
    employment_status?: string;
    reports_to?: string | null;
    start_date?: string | null;
    internal_notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, email, role, admin_role, admin_permissions")
    .eq("id", profileId)
    .maybeSingle();

  if (!target || target.role !== "admin") {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  if (isMasterAdmin(target.admin_role) && !isMasterAdmin(auth.adminRole)) {
    return NextResponse.json({ error: "Cannot modify master admin" }, { status: 403 });
  }

  const profilePatch: Record<string, unknown> = {};

  if (body.admin_role) {
    const targetRole = normalizeAdminRole(body.admin_role);
    if (!canGrantRole(auth.adminRole, targetRole)) {
      return NextResponse.json({ error: "You cannot assign that role" }, { status: 403 });
    }
    profilePatch.admin_role = targetRole;
  }

  if (body.admin_permissions) {
    const role = normalizeAdminRole(body.admin_role || target.admin_role);
    const granted = sanitizeGrantedPermissions(
      auth.adminRole,
      auth.adminPermissions,
      role,
      body.admin_permissions,
    );
    profilePatch.admin_permissions = granted;
  } else if (body.admin_role) {
    const role = normalizeAdminRole(body.admin_role);
    profilePatch.admin_permissions = ROLE_TEMPLATES[role] ?? [];
  }

  if (Object.keys(profilePatch).length) {
    const { error } = await admin.from("profiles").update(profilePatch).eq("id", profileId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const hrPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.job_title !== undefined) hrPatch.job_title = body.job_title?.trim() || null;
  if (body.department !== undefined) hrPatch.department = body.department?.trim() || null;
  if (body.employment_status !== undefined) hrPatch.employment_status = body.employment_status;
  if (body.reports_to !== undefined) hrPatch.reports_to = body.reports_to;
  if (body.start_date !== undefined) hrPatch.start_date = body.start_date;
  if (body.internal_notes !== undefined) hrPatch.internal_notes = body.internal_notes?.trim() || null;

  if (Object.keys(hrPatch).length > 1) {
    await admin.from("admin_staff_records").upsert(
      { profile_id: profileId, ...hrPatch },
      { onConflict: "profile_id" },
    );
  }

  const { data: updated } = await admin
    .from("profiles")
    .select("id, email, full_name, admin_role, admin_permissions")
    .eq("id", profileId)
    .single();

  const { data: record } = await admin
    .from("admin_staff_records")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  return NextResponse.json({
    member: {
      ...updated,
      admin_permissions: parsePermissionList(updated?.admin_permissions),
      permissions: resolvePermissions(updated?.admin_role, updated?.admin_permissions),
      record,
    },
  });
}

/** Suspend / terminate staff access (does not delete auth user). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermissionApi("team.manage");
  if (!auth.ok) return auth.response;

  const profileId = params.id;
  if (profileId === auth.userId) {
    return NextResponse.json({ error: "Cannot suspend yourself" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("email, admin_role")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isMasterAdmin(target.admin_role)) {
    return NextResponse.json({ error: "Cannot suspend master admin" }, { status: 403 });
  }

  await admin
    .from("profiles")
    .update({ role: "customer", admin_role: null, admin_permissions: [] })
    .eq("id", profileId);

  if (target.email) {
    await admin.from("admin_email_allowlist").delete().eq("email", target.email.toLowerCase());
  }

  await admin
    .from("admin_staff_records")
    .upsert(
      {
        profile_id: profileId,
        employment_status: "terminated",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    );

  return NextResponse.json({ ok: true });
}
