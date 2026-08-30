import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  sendAdminDisputeOpenedEmail,
  sendCustomerDisputeOpenedEmail,
} from "@/lib/resend-customer-job-updates";
import {
  DISPUTE_ELIGIBLE_JOB_STATUSES,
  DISPUTE_REASON_OPTIONS,
  formatDisputeReason,
  isDisputeActive,
} from "@/lib/dispute-helpers";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";

async function openDisputeHandler(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string; reasonCode?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!jobId || !reasonCode || description.length < 10) {
    return NextResponse.json(
      { error: "Choose a job, a reason, and add at least 10 characters describing the issue." },
      { status: 400 },
    );
  }

  if (!DISPUTE_REASON_OPTIONS.some((o) => o.value === reasonCode)) {
    return NextResponse.json({ error: "Invalid dispute reason." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, reference, user_id, status, service_id, escrow_release_date")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(DISPUTE_ELIGIBLE_JOB_STATUSES as readonly string[]).includes(job.status)) {
    return NextResponse.json(
      { error: "This job can’t have a dispute opened in its current status." },
      { status: 400 },
    );
  }

  const { data: existing } = await admin
    .from("disputes")
    .select("id, status")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  const active = (existing || []).find((d) => isDisputeActive(d.status));
  if (active) {
    return NextResponse.json(
      { error: "This job already has an open dispute.", disputeId: active.id },
      { status: 409 },
    );
  }

  const reasonText = formatDisputeReason(reasonCode, description);

  const { data: dispute, error: insErr } = await admin
    .from("disputes")
    .insert({
      job_id: jobId,
      user_id: user.id,
      reason: reasonText,
      status: "open",
    })
    .select("id, job_id, status, reason, resolution, created_at")
    .single();

  if (insErr || !dispute) {
    return NextResponse.json({ error: insErr?.message || "Could not open dispute" }, { status: 400 });
  }

  // Flag job disputed and pause escrow countdown while the case is open.
  await admin
    .from("jobs")
    .update({ status: "disputed", escrow_release_date: null })
    .eq("id", jobId);

  await admin.from("dispute_messages").insert({
    dispute_id: dispute.id,
    sender_id: user.id,
    recipient_role: "admin",
    message: reasonText,
  });

  const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
  const customerEmail = prof?.email?.trim() || user.email || "";
  const customerName = prof?.full_name?.trim() || "Customer";
  const jobReference = job.reference || jobId.slice(0, 8).toUpperCase();

  void sendAdminDisputeOpenedEmail({
    disputeId: dispute.id,
    jobReference,
    jobId,
    customerName,
    customerEmail,
    reason: reasonText,
  }).catch((e) => console.error("sendAdminDisputeOpenedEmail:", e));

  if (customerEmail) {
    void sendCustomerDisputeOpenedEmail({
      toEmail: customerEmail,
      customerName,
      jobReference,
      jobId,
      reason: reasonText,
    }).catch((e) => console.error("sendCustomerDisputeOpenedEmail:", e));
  }

  // Contractor is not notified until Kleen engages (status leaves "open" /
  // admin messages the operative). Admin + customer get immediate emails.

  return NextResponse.json({
    ok: true,
    dispute: {
      id: dispute.id,
      jobId: dispute.job_id,
      jobReference: job.reference,
      serviceId: job.service_id,
      status: dispute.status,
      reason: dispute.reason,
      resolution: dispute.resolution,
      createdAt: dispute.created_at,
    },
  });
}

export const POST = withSecureApiRoute("write", openDisputeHandler, { private: false });
