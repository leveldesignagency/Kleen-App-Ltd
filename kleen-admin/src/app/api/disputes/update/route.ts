import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isDisputeResolved } from "@/lib/dispute-helpers";
import {
  sendCustomerDisputeResolvedEmail,
  sendContractorDisputeResolvedEmail,
} from "@/lib/resend-customer-job-updates";

const ALLOWED = new Set(["open", "under_review", "escalated", "resolved", "closed"]);

const DISPUTE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { disputeId?: string; status?: string; resolution?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const disputeId = typeof body.disputeId === "string" ? body.disputeId : "";
  const status = typeof body.status === "string" ? body.status : "";
  const resolution =
    body.resolution == null ? null : typeof body.resolution === "string" ? body.resolution.trim() || null : null;

  if (!disputeId || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "Invalid disputeId or status" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: dispute, error: dErr } = await admin
    .from("disputes")
    .select("id, job_id, user_id, status, reason, resolution")
    .eq("id", disputeId)
    .maybeSingle();

  if (dErr || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  const becomingResolved = isDisputeResolved(status) && !isDisputeResolved(dispute.status);
  const updates: Record<string, unknown> = {
    status,
    resolution,
  };
  if (becomingResolved) {
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = auth.userId;
  } else if (!isDisputeResolved(status)) {
    updates.resolved_at = null;
    updates.resolved_by = null;
  }

  const { error: updErr } = await admin.from("disputes").update(updates).eq("id", disputeId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  let nextJobStatus: string | null = null;
  if (becomingResolved) {
    const { data: jobRow } = await admin
      .from("jobs")
      .select(
        "id, reference, status, user_id, operative_marked_complete_at, customer_confirmed_complete_at, contractor_confirmed_complete_at",
      )
      .eq("id", dispute.job_id)
      .maybeSingle();

    if (jobRow?.status === "disputed") {
      let nextStatus = "awaiting_completion";
      if (jobRow.customer_confirmed_complete_at && jobRow.contractor_confirmed_complete_at) {
        nextStatus = "completed";
      } else if (jobRow.operative_marked_complete_at || jobRow.customer_confirmed_complete_at) {
        nextStatus = "pending_confirmation";
      }
      const jobUpdates: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "completed") {
        jobUpdates.escrow_release_date = new Date(Date.now() + DISPUTE_DAYS_MS).toISOString();
      }
      await admin.from("jobs").update(jobUpdates).eq("id", dispute.job_id);
      nextJobStatus = nextStatus;

      const jobReference = jobRow.reference || dispute.job_id.slice(0, 8).toUpperCase();

      if (dispute.user_id) {
        const { data: prof } = await admin
          .from("profiles")
          .select("full_name, email")
          .eq("id", dispute.user_id)
          .maybeSingle();
        if (prof?.email) {
          void sendCustomerDisputeResolvedEmail({
            toEmail: prof.email,
            customerName: prof.full_name?.trim() || "Customer",
            jobReference,
            jobId: dispute.job_id,
            resolution,
            status,
          }).catch((e) => console.error("sendCustomerDisputeResolvedEmail:", e));
        }
      }

      const { data: assignment } = await admin
        .from("job_assignments")
        .select("operatives ( full_name, email, user_id )")
        .eq("job_id", dispute.job_id)
        .limit(1)
        .maybeSingle();
      const op = Array.isArray(assignment?.operatives) ? assignment?.operatives[0] : assignment?.operatives;
      let opEmail = (op as { email?: string | null } | null)?.email || null;
      const opUid = (op as { user_id?: string | null } | null)?.user_id;
      if (!opEmail && opUid) {
        const { data: authUser } = await admin.auth.admin.getUserById(opUid);
        opEmail = authUser.user?.email ?? null;
      }
      if (opEmail) {
        void sendContractorDisputeResolvedEmail({
          toEmail: opEmail,
          contractorName: (op as { full_name?: string | null } | null)?.full_name || "Contractor",
          jobReference,
          resolution,
          status,
        }).catch((e) => console.error("sendContractorDisputeResolvedEmail:", e));
      }
    }
  }

  return NextResponse.json({ ok: true, status, nextJobStatus });
}
