import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAdminQuoteAcceptedEmail } from "@/lib/resend-admin-notify";
import { generateOperativePortalToken } from "@/lib/operative-portal-token";

type ServiceSupabase = SupabaseClient;

/**
 * Customer authorized card (manual capture) — funds held until admin captures/releases.
 */
export async function applyQuoteAcceptAuthorized(params: {
  supabase: ServiceSupabase;
  jobId: string;
  quoteRequestId: string;
  amountPence: number;
  stripePaymentIntentId: string | null;
  sendAdminEmail: boolean;
}): Promise<string | null> {
  const { supabase, jobId, quoteRequestId, amountPence, stripePaymentIntentId, sendAdminEmail } = params;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("jobs")
    .select("id, accepted_quote_request_id, operative_portal_token")
    .eq("id", jobId)
    .single();

  if (existing?.accepted_quote_request_id) {
    if (existing.accepted_quote_request_id === quoteRequestId) {
      return null;
    }
    return "Quote already accepted for this job";
  }

  const token = (existing as { operative_portal_token?: string })?.operative_portal_token || generateOperativePortalToken();

  const { error: jobUpdateErr } = await supabase
    .from("jobs")
    .update({
      status: "customer_accepted",
      accepted_quote_request_id: quoteRequestId,
      customer_accepted_at: now,
      payment_authorized_at: now,
      stripe_payment_intent_id: stripePaymentIntentId,
      operative_portal_token: token,
      operative_portal_token_created_at: now,
    })
    .eq("id", jobId);

  if (jobUpdateErr) {
    console.error("applyQuoteAcceptAuthorized job update failed:", jobUpdateErr);
    return "Database update failed";
  }

  const { data: job } = await supabase.from("jobs").select("user_id").eq("id", jobId).single();
  if (job?.user_id) {
    const { data: existingPay } = await supabase.from("payments").select("id").eq("job_id", jobId).limit(1).maybeSingle();
    if (!existingPay) {
      await supabase.from("payments").insert({
        job_id: jobId,
        user_id: job.user_id,
        amount_pence: amountPence,
        currency: "gbp",
        status: "authorized",
        stripe_payment_intent_id: stripePaymentIntentId,
        paid_at: now,
      });
    }
  }

  const { data: otherRequests } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("job_id", jobId)
    .neq("id", quoteRequestId);
  if (otherRequests?.length) {
    await supabase
      .from("quote_requests")
      .update({ customer_declined_at: now })
      .in("id", otherRequests.map((r) => r.id));
  }

  if (sendAdminEmail) {
    const { data: jobRow } = await supabase.from("jobs").select("reference, user_id").eq("id", jobId).single();
    const uid = jobRow?.user_id;
    let customerName = "Customer";
    let customerEmail = "";
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", uid).single();
      if (prof?.full_name) customerName = prof.full_name;
      if (prof?.email) customerEmail = prof.email;
    }
    const ref = jobRow?.reference || jobId.slice(0, 8).toUpperCase();
    await sendAdminQuoteAcceptedEmail({
      jobId,
      jobReference: ref,
      customerName,
      customerEmail,
      amountPence,
    });
  }

  return null;
}

/** After Stripe capture() for a manual PI — funds available on platform. */
export async function applyPaymentCaptured(params: {
  supabase: ServiceSupabase;
  jobId: string;
  stripePaymentIntentId: string;
}): Promise<void> {
  const { supabase, jobId, stripePaymentIntentId } = params;
  const now = new Date().toISOString();

  const { data: job } = await supabase
    .from("jobs")
    .select("payment_captured_at, stripe_payment_intent_id")
    .eq("id", jobId)
    .single();

  if (!job || job.payment_captured_at) return;
  if (job.stripe_payment_intent_id && job.stripe_payment_intent_id !== stripePaymentIntentId) return;

  await supabase
    .from("jobs")
    .update({ payment_captured_at: now })
    .eq("id", jobId);

  await supabase
    .from("payments")
    .update({ status: "succeeded", paid_at: now })
    .eq("job_id", jobId)
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .eq("status", "authorized");
}

/**
 * Immediate capture (Checkout or automatic PI) — legacy behaviour.
 */
export async function applyLegacyImmediateCapture(
  supabase: ServiceSupabase,
  jobId: string,
  quoteRequestId: string,
  amountPence: number,
  paymentIntentId: string | null
): Promise<string | null> {
  const now = new Date().toISOString();
  const token = generateOperativePortalToken();

  const { error: jobUpdateErr } = await supabase
    .from("jobs")
    .update({
      status: "customer_accepted",
      accepted_quote_request_id: quoteRequestId,
      customer_accepted_at: now,
      payment_captured_at: now,
      payment_authorized_at: now,
      stripe_payment_intent_id: paymentIntentId,
      operative_portal_token: token,
      operative_portal_token_created_at: now,
    })
    .eq("id", jobId);
  if (jobUpdateErr) {
    console.error("applyLegacyImmediateCapture job update failed:", jobUpdateErr);
    return "Database update failed";
  }
  const { data: job } = await supabase.from("jobs").select("user_id").eq("id", jobId).single();
  if (job?.user_id) {
    const { data: existingPay } = await supabase.from("payments").select("id").eq("job_id", jobId).limit(1).maybeSingle();
    if (!existingPay) {
      await supabase.from("payments").insert({
        job_id: jobId,
        user_id: job.user_id,
        amount_pence: amountPence,
        currency: "gbp",
        status: "succeeded",
        stripe_payment_intent_id: paymentIntentId,
        paid_at: now,
      });
    }
  }
  const { data: otherRequests } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("job_id", jobId)
    .neq("id", quoteRequestId);
  if (otherRequests?.length) {
    await supabase
      .from("quote_requests")
      .update({ customer_declined_at: now })
      .in("id", otherRequests.map((r) => r.id));
  }

  const { data: jobRow } = await supabase.from("jobs").select("reference, user_id").eq("id", jobId).single();
  const uid = jobRow?.user_id;
  let customerName = "Customer";
  let customerEmail = "";
  if (uid) {
    const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", uid).single();
    if (prof?.full_name) customerName = prof.full_name;
    if (prof?.email) customerEmail = prof.email;
  }
  const ref = jobRow?.reference || jobId.slice(0, 8).toUpperCase();
  await sendAdminQuoteAcceptedEmail({
    jobId,
    jobReference: ref,
    customerName,
    customerEmail,
    amountPence,
  });

  return null;
}
