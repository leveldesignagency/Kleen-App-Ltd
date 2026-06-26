import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyAdminNewJobEmail } from "@/lib/admin-new-job-email";

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

function missingFields(body: SubmitBody): string | null {
  const { serviceId, cleaningType, address, postcode, preferredDate, preferredTime, detail, estimate } = body;
  if (!serviceId || !cleaningType || !address?.trim() || !postcode?.trim() || !preferredDate || !preferredTime) {
    return "Missing job details";
  }
  if (!detail?.size || detail.quantity == null || !detail.complexity) {
    return "Missing job size/quantity";
  }
  if (
    estimate?.minPrice == null ||
    estimate?.maxPrice == null ||
    estimate?.estimatedDuration == null ||
    estimate?.operativesRequired == null
  ) {
    return "Missing estimate";
  }
  return null;
}

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

  const validationError = missingFields(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { serviceId, cleaningType, address, postcode, preferredDate, preferredTime, notes, detail, estimate } = body;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      service_id: serviceId,
      cleaning_type: cleaningType,
      address_line_1: address!.trim(),
      postcode: postcode!.trim(),
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
    size: detail!.size,
    quantity: detail!.quantity,
    complexity: detail!.complexity,
  });
  if (detailError) {
    console.error("jobs/submit job_details:", detailError);
  }

  const { error: quoteError } = await supabase.from("quotes").insert({
    job_id: job.id,
    min_price_pence: Math.round(estimate!.minPrice! * 100),
    max_price_pence: Math.round(estimate!.maxPrice! * 100),
    estimated_duration_min: estimate!.estimatedDuration,
    operatives_required: estimate!.operativesRequired,
  });
  if (quoteError) {
    console.error("jobs/submit quotes:", quoteError);
  }

  const adminEmail = await notifyAdminNewJobEmail(supabase, {
    jobId: job.id,
    userId: user.id,
    userEmail: user.email,
  });

  if (!adminEmail.ok) {
    console.error("jobs/submit admin email failed:", adminEmail.error, {
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      to: process.env.ADMIN_NOTIFY_EMAIL || "info@kleenapp.co.uk",
    });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    reference: job.reference,
    adminEmailSent: adminEmail.ok,
    adminEmailError: adminEmail.error,
  });
}
