import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

/**
 * Partial or full refund to the customer while funds are still on the platform
 * (before admin marks "funds released" to the contractor).
 * If the PaymentIntent is still uncaptured (manual capture), you can cancel the authorisation instead.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    const stripe = new Stripe(stripeKey);

    const body = await request.json().catch(() => ({}));
    const { jobId, amountPence, reason, cancelAuthorizationOnly } = body as {
      jobId?: string;
      amountPence?: number;
      reason?: string;
      cancelAuthorizationOnly?: boolean;
    };

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, stripe_payment_intent_id, funds_released_at")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.funds_released_at) {
      return NextResponse.json(
        {
          error:
            "Funds were already released to the contractor. Use Stripe Dashboard or support for adjustments.",
        },
        { status: 400 }
      );
    }

    const piId = job.stripe_payment_intent_id as string | null;
    if (!piId) {
      return NextResponse.json({ error: "No Stripe payment on this job" }, { status: 400 });
    }

    const pi = await stripe.paymentIntents.retrieve(piId);

    if (pi.status === "requires_capture" && (cancelAuthorizationOnly || amountPence == null)) {
      await stripe.paymentIntents.cancel(piId);
      const { data: payRow } = await supabase.from("payments").select("id").eq("job_id", jobId).maybeSingle();
      if (payRow?.id) {
        await supabase
          .from("payments")
          .update({
            status: "refunded",
            refund_amount_pence: 0,
            refund_reason: reason || "Authorization cancelled before capture",
          })
          .eq("id", payRow.id);
      }
      return NextResponse.json({
        ok: true,
        message: "Card authorisation cancelled — customer was not charged.",
        cancelledAuthorization: true,
      });
    }

    if (pi.status !== "succeeded") {
      return NextResponse.json(
        { error: `Refund not available in state: ${pi.status}` },
        { status: 400 }
      );
    }

    const maxPence = pi.amount_received ?? pi.amount;
    const { data: pay } = await supabase.from("payments").select("id, refund_amount_pence").eq("job_id", jobId).maybeSingle();
    const alreadyRefunded = pay?.refund_amount_pence ?? 0;
    const remaining = maxPence - alreadyRefunded;
    if (remaining <= 0) {
      return NextResponse.json({ error: "Nothing left to refund on this charge" }, { status: 400 });
    }

    const requested = amountPence != null && amountPence > 0 ? Math.round(amountPence) : remaining;
    const actualRefund = Math.min(requested, remaining);

    await stripe.refunds.create({
      payment_intent: piId,
      amount: actualRefund,
      reason: "requested_by_customer",
      metadata: { job_id: jobId, admin_note: (reason || "").slice(0, 500) },
    });

    const newTotal = alreadyRefunded + actualRefund;
    if (pay?.id) {
      const fullRefund = newTotal >= maxPence;
      await supabase
        .from("payments")
        .update({
          refund_amount_pence: newTotal,
          refund_reason: reason || (fullRefund ? "Full refund" : "Partial refund"),
          ...(fullRefund ? { status: "refunded" as const } : {}),
        })
        .eq("id", pay.id);
    }

    return NextResponse.json({
      ok: true,
      amount_pence: actualRefund,
      total_refunded_pence: newTotal,
    });
  } catch (e) {
    console.error("refund-job:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refund failed" },
      { status: 500 }
    );
  }
}
