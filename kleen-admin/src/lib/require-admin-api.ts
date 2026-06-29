import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { AdminStaffRole } from "@/lib/admin-staff";

export type AdminAuthResult =
  | { ok: true; userId: string; adminRole: AdminStaffRole | null }
  | { ok: false; response: NextResponse };

export async function requireAdminApi(): Promise<AdminAuthResult> {
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
    .select("role, admin_role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    ok: true,
    userId: user.id,
    adminRole: (profile.admin_role as AdminStaffRole | null) ?? "staff",
  };
}

export async function requireSuperadminApi(): Promise<AdminAuthResult> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth;
  if (auth.adminRole !== "superadmin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Superadmin access required" }, { status: 403 }),
    };
  }
  return auth;
}
