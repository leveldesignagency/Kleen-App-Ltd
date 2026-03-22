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
    const { jobId, quoteRequestId, customerPricePence } = body as {
      jobId: string;
      quoteRequestId: string;
      customerPricePence: number;
    };

    if (!jobId || !quoteRequestId || !customerPricePence || customerPricePence < 50) {
      return NextResponse.json(
        { error: "Missing or invalid jobId, quoteRequestId, or customerPricePence (min 50p)" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", job.user_id)
      .single();

    const customerEmail = (profile?.email as string) || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(customerPricePence),
            product_data: {
              name: "KLEEN — Accepted quote",
              description: "Payment for your accepted cleaning quote",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        job_id: jobId,
        quote_request_id: quoteRequestId,
      },
      success_url: `${siteUrl}/dashboard/jobs/${jobId}?payment=success`,
      cancel_url: `${siteUrl}/dashboard/jobs/${jobId}/quotes?payment=cancelled`,
      customer_email: customerEmail || undefined,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("create-accept-session error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
