import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notifyAdminNewJobEmail } from "@/lib/admin-new-job-email";
import { markAdminNewJobEmailSent } from "@/lib/mark-admin-new-job-email-sent";
import { broadcastJobToMatchingContractors } from "@/lib/broadcast-job-to-contractors";

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

function normalizePreferredTime(time: string): string {
  const t = time.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) return `${t}:00`;
  return t;
}

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

/** Create job + details + quote server-side, then email admin (Bearer or cookie auth). */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized — sign in again and retry" }, { status: 401 });
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

    let admin;
    try {
      admin = createServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server configuration error";
      console.error("jobs/submit service role:", msg);
      return NextResponse.json({ error: "Job service unavailable" }, { status: 503 });
    }

    const { serviceId, cleaningType, address, postcode, preferredDate, preferredTime, notes, detail, estimate } = body;

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .insert({
        user_id: user.id,
        service_id: serviceId,
        cleaning_type: cleaningType,
        address_line_1: address!.trim(),
        postcode: postcode!.trim(),
        preferred_date: preferredDate,
        preferred_time: normalizePreferredTime(preferredTime!),
        notes: notes?.trim() || null,
      })
      .select("id, reference, postcode, preferred_date, service_id")
      .single();

    if (jobError || !job) {
      console.error("jobs/submit insert:", jobError);
      return NextResponse.json({ error: jobError?.message || "Could not create job" }, { status: 400 });
    }

    const { error: detailError } = await admin.from("job_details").insert({
      job_id: job.id,
      service_id: serviceId,
      size: detail!.size,
      quantity: detail!.quantity,
      complexity: detail!.complexity,
    });
    if (detailError) {
      console.error("jobs/submit job_details:", detailError);
      return NextResponse.json(
        { error: `Job created but details failed: ${detailError.message}`, jobId: job.id, reference: job.reference },
        { status: 400 },
      );
    }

    const { error: quoteError } = await admin.from("quotes").insert({
      job_id: job.id,
      min_price_pence: Math.round(estimate!.minPrice! * 100),
      max_price_pence: Math.round(estimate!.maxPrice! * 100),
      estimated_duration_min: estimate!.estimatedDuration,
      operatives_required: estimate!.operativesRequired,
    });
    if (quoteError) {
      console.error("jobs/submit quotes:", quoteError);
      return NextResponse.json(
        { error: `Job created but quote failed: ${quoteError.message}`, jobId: job.id, reference: job.reference },
        { status: 400 },
      );
    }

    const adminEmail = await notifyAdminNewJobEmail(admin, {
      jobId: job.id,
      userId: user.id,
      userEmail: user.email,
    });

    if (!adminEmail.ok) {
      console.error("jobs/submit admin email failed:", adminEmail.error, { jobId: job.id });
    } else {
      await markAdminNewJobEmailSent(job.id);
    }

    const broadcast = await broadcastJobToMatchingContractors(admin, job.id);
    if (!broadcast.ok) {
      console.error("jobs/submit marketplace broadcast failed:", broadcast.error, { jobId: job.id });
    }

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      reference: job.reference,
      adminEmailSent: adminEmail.ok,
      adminEmailError: adminEmail.error,
      marketplaceInvited: broadcast.invitedCount,
      marketplaceEmailsSent: broadcast.emailsSent,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Job submit failed";
    console.error("jobs/submit unhandled:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
