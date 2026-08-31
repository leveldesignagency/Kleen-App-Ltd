import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requirePermissionApi } from "@/lib/require-admin-api";

type RouteParams = { params: { id: string } };

const BUCKET = "admin-staff-contracts";

/** Upload employment contract PDF for a staff member. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermissionApi("team.contracts");
  if (!auth.ok) return auth.response;

  const profileId = params.id;
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF contracts are accepted" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${profileId}/${Date.now()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  await admin.from("admin_staff_records").upsert(
    {
      profile_id: profileId,
      contract_storage_path: path,
      contract_filename: file.name,
      contract_uploaded_at: now,
      contract_uploaded_by: auth.userId,
      updated_at: now,
    },
    { onConflict: "profile_id" },
  );

  return NextResponse.json({
    ok: true,
    path,
    filename: file.name,
    uploadedAt: now,
  });
}

/** Signed URL to download contract. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermissionApi("team.contracts");
  if (!auth.ok) return auth.response;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data: record } = await admin
    .from("admin_staff_records")
    .select("contract_storage_path, contract_filename")
    .eq("profile_id", params.id)
    .maybeSingle();

  if (!record?.contract_storage_path) {
    return NextResponse.json({ error: "No contract on file" }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(record.contract_storage_path, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Could not create link" }, { status: 400 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    filename: record.contract_filename,
  });
}
