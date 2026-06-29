import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireAdminApi } from "@/lib/require-admin-api";
import { parseAdminPreferences, type AdminDisplayPreferences } from "@/lib/admin-staff";

async function authClient() {
  const cookieStore = cookies();
  return createServerClient(
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
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = await authClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, avatar_url, admin_role, admin_preferences")
    .eq("id", auth.userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      avatar_url: data.avatar_url,
      admin_role: data.admin_role ?? "staff",
      admin_preferences: parseAdminPreferences(data.admin_preferences),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: {
    full_name?: string;
    phone?: string;
    admin_preferences?: Partial<AdminDisplayPreferences>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await authClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("admin_preferences")
    .eq("id", auth.userId)
    .single();

  const patch: Record<string, unknown> = {};
  if body.full_name !== undefined) patch.full_name = body.full_name.trim() || null;
  if body.phone !== undefined) patch.phone = body.phone.trim() || null;

  if (body.admin_preferences) {
    const merged = {
      ...parseAdminPreferences(current?.admin_preferences),
      ...body.admin_preferences,
    };
    patch.admin_preferences = merged;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", auth.userId)
    .select("id, email, full_name, phone, avatar_url, admin_role, admin_preferences")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    profile: {
      ...data,
      admin_role: data.admin_role ?? "staff",
      admin_preferences: parseAdminPreferences(data.admin_preferences),
    },
  });
}
