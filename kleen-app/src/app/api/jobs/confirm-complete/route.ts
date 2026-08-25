import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendContractorCustomerConfirmedEmail } from "@/lib/resend-contractor-lifecycle";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { escrowReleaseFromNow } from "@/lib/contractor-field-job";

async function confirmCompleteHandler(request: NextRequest) {
  const cookieStore = cookies();
  const cookieOpts = getSupabaseAuthCookieOptions();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOpts ? { cookieOptions: cookieOpts } : {}),
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select(
      "id, reference, user_id, status, customer_confirmed_complete_at, contractor_confirmed_complete_at, accepted_quote_request_id",
    )
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.customer_confirmed_complete_at) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  const now = new Date().toISOString();
  const updates: Record<string, string | null> = {
    customer_confirmed_complete_at: now,
  };
  const bothConfirmed = Boolean(job.contractor_confirmed_complete_at);
  if (bothConfirmed) {
    updates.status = "completed";
    updates.escrow_release_date = escrowReleaseFromNow();
  } else {
    updates.status = "pending_confirmation";
  }

  const { error: updateErr } = await admin.from("jobs").update(updates).eq("id", jobId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  if (job.accepted_quote_request_id) {
    const { data: qr } = await admin
      .from("quote_requests")
      .select("operative_id")
      .eq("id", job.accepted_quote_request_id)
      .maybeSingle();
    if (qr?.operative_id) {
      const { data: op } = await admin
        .from("operatives")
        .select("email, full_name")
        .eq("id", qr.operative_id)
        .maybeSingle();
      const toEmail = op?.email?.trim();
      if (toEmail) {
        void sendContractorCustomerConfirmedEmail({
          toEmail,
          contractorName: op?.full_name?.trim() || "there",
          jobReference: job.reference || jobId.slice(0, 8).toUpperCase(),
          jobId,
          bothConfirmed,
        }).catch((e) => console.error("sendContractorCustomerConfirmedEmail:", e));
      }
    }
  }

  return NextResponse.json({
    ok: true,
    status: updates.status,
    customer_confirmed_complete_at: now,
    escrow_release_date: updates.escrow_release_date ?? null,
  });
}

export const POST = withSecureApiRoute("write", confirmCompleteHandler, { private: false });
