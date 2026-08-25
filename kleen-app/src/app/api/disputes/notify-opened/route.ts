import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendAdminDisputeOpenedEmail } from "@/lib/resend-customer-job-updates";
import { withSecureApiRoute } from "@/lib/security/with-secure-api-route";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

async function notifyOpenedHandler(request: NextRequest) {
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
  const disputeId = typeof body.disputeId === "string" ? body.disputeId : "";
  if (!disputeId) {
    return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: dispute, error } = await admin
    .from("disputes")
    .select("id, job_id, user_id, reason")
    .eq("id", disputeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  const { data: job } = await admin.from("jobs").select("id, reference").eq("id", dispute.job_id).maybeSingle();
  const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();

  const result = await sendAdminDisputeOpenedEmail({
    disputeId: dispute.id,
    jobReference: job?.reference || dispute.job_id.slice(0, 8).toUpperCase(),
    jobId: dispute.job_id,
    customerName: prof?.full_name?.trim() || "Customer",
    customerEmail: prof?.email?.trim() || user.email || "",
    reason: dispute.reason || "Dispute",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Email failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withSecureApiRoute("write", notifyOpenedHandler, { private: false });
