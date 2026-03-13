import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const jobId = session.metadata?.job_id;
    const quoteRequestId = session.metadata?.quote_request_id;
    if (!jobId || !quoteRequestId) {
      console.error("Webhook missing job_id or quote_request_id in metadata");
      return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
    }
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
    const amountPence = session.amount_total ?? 0;
    const err = await applyAcceptPayment(supabase, jobId, quoteRequestId, amountPence, paymentIntentId);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const jobId = pi.metadata?.job_id;
    const quoteRequestId = pi.metadata?.quote_request_id;
    if (!jobId || !quoteRequestId) return NextResponse.json({ received: true });
    const err = await applyAcceptPayment(supabase, jobId, quoteRequestId, pi.amount, pi.id);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}

async function applyAcceptPayment(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  jobId: string,
  quoteRequestId: string,
  amountPence: number,
  paymentIntentId: string | null
): Promise<string | null> {
  const now = new Date().toISOString();
  const { error: jobUpdateErr } = await supabase
    .from("jobs")
    .update({
      status: "customer_accepted",
      accepted_quote_request_id: quoteRequestId,
      customer_accepted_at: now,
      payment_captured_at: now,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", jobId);
  if (jobUpdateErr) {
    console.error("Webhook job update failed:", jobUpdateErr);
    return "Database update failed";
  }
  const { data: job } = await supabase.from("jobs").select("user_id").eq("id", jobId).single();
  if (job?.user_id) {
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
  return null;
}
