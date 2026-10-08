import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data, error } = await admin
    .from("service_area_waitlist")
    .select(
      "id, email, postcode, audience, source, created_at, area_label, admin_county, admin_district, region, postcode_area",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ entries: data || [] });
}
