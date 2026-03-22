import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAdminNewJobEmail } from "@/lib/resend-admin-notify";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const jobId = body.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, reference, user_id, postcode, preferred_date, service_id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const j = job as {
    id: string;
    reference: string;
    postcode: string;
    preferred_date: string;
    service_id: string;
  };

  const { data: svc } = await admin.from("services").select("name").eq("id", j.service_id).maybeSingle();
  const serviceName = svc?.name || "Cleaning";
  const customerName = profile?.full_name?.trim() || "Customer";
  const customerEmail = profile?.email || user.email || "";
  const preferredDate =
    typeof j.preferred_date === "string"
      ? new Date(j.preferred_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
      : String(j.preferred_date);

  await sendAdminNewJobEmail({
    jobId: j.id,
    jobReference: j.reference,
    serviceName,
    customerName,
    customerEmail,
    postcode: j.postcode || "—",
    preferredDate,
  });

  return NextResponse.json({ ok: true });
}
