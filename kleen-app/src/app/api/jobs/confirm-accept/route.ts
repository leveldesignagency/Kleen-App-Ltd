import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Called by the client immediately after payment succeeds (e.g. confirmCardPayment).
 * Updates the job to customer_accepted so the UI shows the right state without
 * relying on the Stripe webhook (which may not fire in local dev or can be delayed).
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId: string; quoteRequestId: string; customerPricePence: number; stripePaymentIntentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { jobId, quoteRequestId, customerPricePence, stripePaymentIntentId } = body;
  if (!jobId || !quoteRequestId || !customerPricePence || customerPricePence < 50) {
    return NextResponse.json(
      { error: "Missing or invalid jobId, quoteRequestId, or customerPricePence" },
      { status: 400 }
    );
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, user_id, status, accepted_quote_request_id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "sent_to_customer") {
    return NextResponse.json(
      { error: "Job is not awaiting acceptance" },
      { status: 400 }
    );
  }
  if (job.accepted_quote_request_id) {
    return NextResponse.json(
      { error: "A quote has already been accepted" },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const amountPence = Math.round(customerPricePence);

  const { error: updateErr } = await admin
    .from("jobs")
    .update({
      status: "customer_accepted",
      accepted_quote_request_id: quoteRequestId,
      customer_accepted_at: now,
      payment_captured_at: now,
      stripe_payment_intent_id: stripePaymentIntentId ?? null,
    })
    .eq("id", jobId);

  if (updateErr) {
    console.error("confirm-accept job update failed:", updateErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await admin.from("payments").insert({
    job_id: jobId,
    user_id: user.id,
    amount_pence: amountPence,
    currency: "gbp",
    status: "succeeded",
    stripe_payment_intent_id: stripePaymentIntentId ?? null,
    paid_at: now,
  });

  const { data: otherRequests } = await admin
    .from("quote_requests")
    .select("id")
    .eq("job_id", jobId)
    .neq("id", quoteRequestId);
  if (otherRequests?.length) {
    await admin
      .from("quote_requests")
      .update({ customer_declined_at: now })
      .in("id", otherRequests.map((r) => r.id));
  }

  return NextResponse.json({ ok: true });
}
