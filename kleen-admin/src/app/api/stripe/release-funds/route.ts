import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const PLATFORM_FEE_RATE = 0.175; // 17.5% — Kleen keeps this; rest goes to contractor

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );
    const { data: { user } } = await supabaseAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { jobId } = body as { jobId?: string };
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, status, accepted_quote_request_id, payment_captured_at, funds_released_at")
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
    if (!job.payment_captured_at) {
      return NextResponse.json({ error: "Payment not yet captured for this job" }, { status: 400 });
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
