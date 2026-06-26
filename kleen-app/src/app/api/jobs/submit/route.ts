import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAdminNewJobEmail } from "@/lib/resend-admin-notify";
import { getService } from "@/lib/services";

type SubmitBody = {
  serviceId?: string;
  cleaningType?: "domestic" | "commercial";
  address?: string;
  postcode?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string | null;
  detail?: {
    size?: "S" | "M" | "L";
    quantity?: number;
    complexity?: "standard" | "deep";
  };
  estimate?: {
    minPrice?: number;
    maxPrice?: number;
    estimatedDuration?: number;
    operativesRequired?: number;
  };
};

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    serviceId,
    cleaningType,
    address,
    postcode,
    preferredDate,
    preferredTime,
    notes,
    detail,
    estimate,
  } = body;

  if (
    !serviceId ||
    !cleaningType ||
    !address?.trim() ||
    !postcode?.trim() ||
    !preferredDate ||
    !preferredTime ||
    !detail?.size ||
    !detail.quantity ||
    !detail.complexity ||
    !estimate?.minPrice ||
    !estimate?.maxPrice ||
    !estimate.estimatedDuration ||
    !estimate.operativesRequired
  ) {
    return NextResponse.json({ error: "Missing required job fields" }, { status: 400 });
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      service_id: serviceId,
      cleaning_type: cleaningType,
      address_line_1: address.trim(),
      postcode: postcode.trim(),
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      notes: notes?.trim() || null,
    })
    .select("id, reference, postcode, preferred_date, service_id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message || "Could not create job" }, { status: 400 });
  }

  const { error: detailError } = await supabase.from("job_details").insert({
    job_id: job.id,
    service_id: serviceId,
    size: detail.size,
    quantity: detail.quantity,
    complexity: detail.complexity,
  });
  if (detailError) {
    console.error("jobs/submit job_details:", detailError);
  }

  const { error: quoteError } = await supabase.from("quotes").insert({
    job_id: job.id,
    min_price_pence: Math.round(estimate.minPrice * 100),
    max_price_pence: Math.round(estimate.maxPrice * 100),
    estimated_duration_min: estimate.estimatedDuration,
    operatives_required: estimate.operativesRequired,
  });
  if (quoteError) {
    console.error("jobs/submit quotes:", quoteError);
  }

  let adminEmail: { ok: boolean; error?: string } = { ok: false, error: "Not attempted" };
  try {
    const admin = createServiceRoleClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const { data: svc } = await admin.from("services").select("name").eq("id", job.service_id).maybeSingle();
    const serviceName = svc?.name || getService(serviceId)?.name || "Cleaning";
    const customerName = profile?.full_name?.trim() || "Customer";
    const customerEmail = profile?.email || user.email || "";
    const preferredDateLabel =
      typeof job.preferred_date === "string"
        ? new Date(job.preferred_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
        : String(job.preferred_date);

    adminEmail = await sendAdminNewJobEmail({
      jobId: job.id,
      jobReference: job.reference,
      serviceName,
      customerName,
      customerEmail,
      postcode: job.postcode || "—",
      preferredDate: preferredDateLabel,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Admin email failed";
    console.error("jobs/submit admin email:", message);
    adminEmail = { ok: false, error: message };
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    reference: job.reference,
    adminEmailSent: adminEmail.ok,
    adminEmailError: adminEmail.error,
  });
}
