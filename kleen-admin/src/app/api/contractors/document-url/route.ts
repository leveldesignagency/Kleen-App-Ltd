import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { path?: string };
  const path = String(body.path || "").trim();
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from("contractor-documents").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Could not create link" }, { status: 400 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
