import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  hasPermission,
  normalizeAdminRole,
  parsePermissionList,
  resolvePermissions,
  type AdminPermission,
  type AdminStaffRole,
} from "@/lib/admin-permissions";

export type AdminAuthResult =
  | {
      ok: true;
      userId: string;
      adminRole: AdminStaffRole;
      adminPermissions: AdminPermission[];
      permissions: AdminPermission[];
    }
  | { ok: false; response: NextResponse };

async function loadAdminAuth(): Promise<AdminAuthResult | { ok: false; response: NextResponse }> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role, admin_permissions")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const adminRole = normalizeAdminRole(profile.admin_role);
  const adminPermissions = parsePermissionList(profile.admin_permissions);
  const permissions = resolvePermissions(adminRole, adminPermissions);
  return { ok: true, userId: user.id, adminRole, adminPermissions, permissions };
}

export async function requireAdminApi(): Promise<AdminAuthResult> {
  const auth = await loadAdminAuth();
  return auth;
}

export async function requirePermissionApi(
  permission: AdminPermission,
): Promise<AdminAuthResult> {
  const auth = await loadAdminAuth();
  if (!auth.ok) return auth;
  if (!hasPermission(auth.adminRole, auth.adminPermissions, permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
    };
  }
  return auth;
}

/** @deprecated Use requirePermissionApi('team.manage') or isMasterAdmin checks */
export async function requireSuperadminApi(): Promise<AdminAuthResult> {
  const auth = await loadAdminAuth();
  if (!auth.ok) return auth;
  if (!hasPermission(auth.adminRole, auth.adminPermissions, "team.manage")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Team management permission required" }, { status: 403 }),
    };
  }
  return auth;
}
