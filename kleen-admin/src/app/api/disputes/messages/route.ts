import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendContractorDisputeOpenedEmail } from "@/lib/resend-customer-job-updates";

/**
 * Admin mediated messaging:
 * - GET: full thread
 * - POST: reply to customer or contractor; first engagement moves open → under_review
 *   and notifies the contractor when they are brought in.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const disputeId = request.nextUrl.searchParams.get("disputeId")?.trim() || "";
  if (!disputeId) {
    return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: messages, error } = await admin
    .from("dispute_messages")
    .select("id, sender_id, recipient_role, message, created_at")
    .eq("dispute_id", disputeId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ messages: messages || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { disputeId?: string; message?: string; recipientRole?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const disputeId = typeof body.disputeId === "string" ? body.disputeId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const recipientRole = body.recipientRole === "operative" ? "operative" : "customer";

  if (!disputeId || !message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: dispute } = await admin
    .from("disputes")
    .select("id, job_id, status, reason, user_id")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: insErr } = await admin.from("dispute_messages").insert({
    dispute_id: disputeId,
    sender_id: auth.userId,
    recipient_role: recipientRole,
    message,
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  const wasOpen = dispute.status === "open";
  if (wasOpen) {
    await admin.from("disputes").update({ status: "under_review" }).eq("id", disputeId);
  }

  // Bring contractor into the loop when Kleen first messages them, or when
  // the case leaves "open" (first admin touch) and we message the operative.
  if (recipientRole === "operative" || wasOpen) {
    const { data: job } = await admin
      .from("jobs")
      .select("id, reference")
      .eq("id", dispute.job_id)
      .maybeSingle();
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
    // Only email contractor when messaging them (or when engaging the case if we
    // want a heads-up). Prefer email when recipient is operative.
    if (opEmail && recipientRole === "operative") {
      void sendContractorDisputeOpenedEmail({
        toEmail: opEmail,
        contractorName: (op as { full_name?: string | null } | null)?.full_name || "Contractor",
        jobReference: job?.reference || dispute.job_id.slice(0, 8).toUpperCase(),
        reason: message.slice(0, 280),
      }).catch((e) => console.error("sendContractorDisputeOpenedEmail:", e));
    }
  }

  return NextResponse.json({ ok: true, status: wasOpen ? "under_review" : dispute.status });
}
