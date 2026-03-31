import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAdminApi } from "@/lib/require-admin-api";

const PLATFORM_FEE_RATE = 0.175; // 17.5% — Kleen keeps this; rest goes to contractor

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
    const { jobId } = body as { jobId?: string };
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select(
        "id, status, accepted_quote_request_id, payment_captured_at, funds_released_at, stripe_payment_intent_id, payment_authorized_at, escrow_release_date"
      )
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.funds_released_at) {
      return NextResponse.json({ error: "Funds already released for this job" }, { status: 400 });
    }
    if (!job.accepted_quote_request_id) {
      return NextResponse.json({ error: "Job has no accepted quote" }, { status: 400 });
    }

    const stripePiId = (job as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id;
    let paymentCapturedAt = (job as { payment_captured_at?: string | null }).payment_captured_at;

    if (!paymentCapturedAt && stripePiId) {
      let pi = await stripe.paymentIntents.retrieve(stripePiId);
      if (pi.status === "requires_capture") {
        pi = await stripe.paymentIntents.capture(stripePiId);
      }
      if (pi.status === "succeeded") {
        const nowCap = new Date().toISOString();
        await supabase.from("jobs").update({ payment_captured_at: nowCap }).eq("id", jobId);
        await supabase
          .from("payments")
          .update({ status: "succeeded", paid_at: nowCap })
          .eq("job_id", jobId)
          .eq("stripe_payment_intent_id", stripePiId)
          .eq("status", "authorized");
        paymentCapturedAt = nowCap;
      }
    }

    if (!paymentCapturedAt) {
      return NextResponse.json(
        { error: "Payment not yet authorized or captured for this job" },
        { status: 400 }
      );
    }

    const escrowRelease = (job as { escrow_release_date?: string | null }).escrow_release_date;
    if (escrowRelease) {
      const until = new Date(escrowRelease).getTime();
      if (Number.isFinite(until) && Date.now() < until) {
        return NextResponse.json(
          {
            error: `Dispute window active until ${new Date(escrowRelease).toISOString()}. Release after that time or resolve disputes first.`,
          },
          { status: 400 }
        );
      }
    }

    const { data: openDispute } = await supabase
      .from("disputes")
      .select("id")
      .eq("job_id", jobId)
      .in("status", ["open", "under_review", "escalated"])
      .limit(1)
      .maybeSingle();

    if (openDispute?.id) {
      return NextResponse.json(
        { error: "Resolve or close the open dispute before releasing funds." },
        { status: 400 }
      );
    }

    const { data: qr } = await supabase
      .from("quote_requests")
      .select("id, operative_id")
      .eq("id", job.accepted_quote_request_id)
      .single();

    if (!qr?.operative_id) {
      return NextResponse.json({ error: "Accepted quote request or operative not found" }, { status: 404 });
    }

    const { data: resp } = await supabase
      .from("quote_responses")
      .select("customer_price_pence")
      .eq("quote_request_id", qr.id)
      .single();

    const customerPricePence = resp?.customer_price_pence;
    if (!customerPricePence || customerPricePence < 0) {
      return NextResponse.json({ error: "Quote response or customer price not found" }, { status: 404 });
    }

    const contractorSharePence = Math.round(customerPricePence * (1 - PLATFORM_FEE_RATE));

    const { data: operative } = await supabase
      .from("operatives")
      .select("id, stripe_account_id, full_name")
      .eq("id", qr.operative_id)
      .single();

    const now = new Date().toISOString();

    if (operative?.stripe_account_id) {
      await stripe.transfers.create({
        amount: contractorSharePence,
        currency: "gbp",
        destination: operative.stripe_account_id,
        description: `KLEEN job payout`,
        metadata: { job_id: jobId },
      });
    }
    // If no stripe_account_id, we still mark funds as released (manual payout by admin)

    const { error: updateErr } = await supabase
      .from("jobs")
      .update({ status: "funds_released", funds_released_at: now })
      .eq("id", jobId);

    if (updateErr) {
      console.error("Release funds job update failed:", updateErr);
      return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      contractor_share_pence: contractorSharePence,
      transferred: !!operative?.stripe_account_id,
      message: operative?.stripe_account_id
        ? "Funds transferred to contractor Stripe account"
        : "Job marked as funds released; pay contractor manually (no Stripe Connect account).",
    });
  } catch (e) {
    console.error("release-funds error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Release failed" },
      { status: 500 }
    );
  }
}
