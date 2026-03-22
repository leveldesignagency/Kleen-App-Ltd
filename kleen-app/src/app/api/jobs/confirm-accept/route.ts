import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { applyQuoteAcceptAuthorized } from "@/lib/stripe-job-accept";

/**
 * Called after the customer confirms card payment (manual capture = authorized, not charged yet).
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    jobId: string;
    quoteRequestId: string;
    customerPricePence: number;
    stripePaymentIntentId?: string;
  };
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
  if (job.accepted_quote_request_id === quoteRequestId && job.status === "customer_accepted") {
    return NextResponse.json({ ok: true, idempotent: true });
  }
  if (job.status !== "sent_to_customer") {
    return NextResponse.json({ error: "Job is not awaiting acceptance" }, { status: 400 });
  }
  if (job.accepted_quote_request_id) {
    return NextResponse.json({ error: "A quote has already been accepted" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const amountPence = Math.round(customerPricePence);

  const err = await applyQuoteAcceptAuthorized({
    supabase: admin,
    jobId,
    quoteRequestId,
    amountPence,
    stripePaymentIntentId: stripePaymentIntentId ?? null,
    sendAdminEmail: true,
  });

  if (err) {
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
