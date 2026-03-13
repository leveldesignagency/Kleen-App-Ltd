import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY missing)" },
      { status: 503 }
    );
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const body = await request.json();
    const {
      jobId,
      quoteRequestId,
      customerPricePence,
      paymentMethodId,
      stripePaymentMethodId,
      paymentMethodType,
    } = body as {
      jobId: string;
      quoteRequestId: string;
      customerPricePence: number;
      paymentMethodId?: string;
      stripePaymentMethodId?: string;
      /** 'paypal' | 'klarna' for redirect-based payment; card uses paymentMethodId or stripePaymentMethodId */
      paymentMethodType?: "paypal" | "klarna";
    };

    if (!jobId || !quoteRequestId || !customerPricePence || customerPricePence < 50) {
      return NextResponse.json(
        { error: "Missing or invalid jobId, quoteRequestId, or customerPricePence (min 50p)" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, user_id, status, accepted_quote_request_id")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.status !== "sent_to_customer") {
      return NextResponse.json({ error: "Job is not awaiting acceptance" }, { status: 400 });
    }
    if (job.accepted_quote_request_id) {
      return NextResponse.json({ error: "A quote has already been accepted" }, { status: 400 });
    }

    const amount = Math.round(customerPricePence);
    const metadata = { job_id: jobId, quote_request_id: quoteRequestId };

    if (paymentMethodType === "paypal" || paymentMethodType === "klarna") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "gbp",
        payment_method_types: [paymentMethodType],
        metadata,
      });
      return NextResponse.json({ clientSecret: paymentIntent.client_secret, paymentMethodType });
    }

    let pmId: string;
    if (stripePaymentMethodId) {
      pmId = stripePaymentMethodId;
    } else if (paymentMethodId) {
      const { data: pm } = await supabase
        .from("payment_methods")
        .select("stripe_payment_method_id")
        .eq("id", paymentMethodId)
        .eq("user_id", job.user_id)
        .single();
      if (!pm?.stripe_payment_method_id) {
        return NextResponse.json(
          { error: "Payment method not found or not set up for payments. Add a card in Payment Methods." },
          { status: 400 }
        );
      }
      pmId = pm.stripe_payment_method_id;
    } else {
      return NextResponse.json(
        { error: "Select a payment method or add a card" },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      payment_method_types: ["card"],
      payment_method: pmId,
      confirm: false,
      metadata,
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error("create-payment-intent-accept error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create payment" },
      { status: 500 }
    );
  }
}
