import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { Resend } from "resend";
import { resolveResendFrom } from "@/lib/resend-config";

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email not configured (RESEND_API_KEY missing)" },
      { status: 503 }
    );
  }
  const resend = new Resend(apiKey);

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
  const { data: { user } } = await supabaseAuth.auth.getUser();
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
    .select(
      "id, reference, address_line_1, address_line_2, city, postcode, preferred_date, preferred_time, notes, accepted_quote_request_id, operative_portal_token, services(name)"
    )
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const quoteRequestId = (job as { accepted_quote_request_id?: string }).accepted_quote_request_id;
  if (!quoteRequestId) {
    return NextResponse.json({ error: "Job has no accepted quote" }, { status: 400 });
  }

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("operative_id")
    .eq("id", quoteRequestId)
    .single();
  if (!qr?.operative_id) {
    return NextResponse.json({ error: "Accepted quote or contractor not found" }, { status: 404 });
  }

  const { data: operative } = await supabase
    .from("operatives")
    .select("email, full_name")
    .eq("id", qr.operative_id)
    .single();
  if (!operative?.email) {
    return NextResponse.json({ error: "Contractor has no email" }, { status: 400 });
  }

  const { data: resp } = await supabase
    .from("quote_responses")
    .select("customer_price_pence, estimated_hours, available_date")
    .eq("quote_request_id", quoteRequestId)
    .single();

  const addressParts = [
    (job as { address_line_1?: string }).address_line_1,
    (job as { address_line_2?: string }).address_line_2,
    (job as { city?: string }).city,
    (job as { postcode?: string }).postcode,
  ].filter(Boolean);
  const address = addressParts.length ? addressParts.join(", ") : "—";
  const serviceName = (job as { services?: { name?: string } }).services?.name || "Cleaning";
  const ref = (job as { reference?: string }).reference || jobId.slice(0, 8).toUpperCase();
  const customerPrice = resp?.customer_price_pence
    ? `£${(resp.customer_price_pence / 100).toFixed(2)}`
    : "—";
  const estimatedHours = resp?.estimated_hours ?? "—";
  const availableDate = resp?.available_date
    ? new Date(resp.available_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
    : "—";
  const preferredDate = (job as { preferred_date?: string }).preferred_date
    ? new Date((job as { preferred_date: string }).preferred_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
    : "—";
  const preferredTime = (job as { preferred_time?: string }).preferred_time || "—";
  const notes = (job as { notes?: string }).notes || "None";

  let portalToken = (job as { operative_portal_token?: string | null }).operative_portal_token;
  if (!portalToken) {
    portalToken = randomBytes(24).toString("hex");
    const ts = new Date().toISOString();
    await supabase
      .from("jobs")
      .update({ operative_portal_token: portalToken, operative_portal_token_created_at: ts })
      .eq("id", jobId);
  }
  /** `/o/[token]` is served by kleen-app (customer deployment), not the contractor portal. */
  const portalBase =
    process.env.CUSTOMER_DASHBOARD_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.replace(/\/$/, "") ||
    "https://dashboard.kleenapp.co.uk";
  const fieldPortalUrl = `${portalBase}/o/${portalToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Job ${ref}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">Job assigned — ${ref}</h1>
  <p style="color: #64748b; margin-bottom: 24px;">The customer has accepted your quote. Here are the job details.</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Reference</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${ref}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Service</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${serviceName}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Address</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${address}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Preferred date</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${preferredDate}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Preferred time</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${preferredTime}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Customer price</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${customerPrice}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Est. hours</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${estimatedHours}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Your available date</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${availableDate}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Notes</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${notes}</td></tr>
  </table>
  <p style="margin-top: 24px; margin-bottom: 12px; font-weight: 600;">Field updates (on my way → arrived → complete)</p>
  <p style="margin-bottom: 16px;">
    <a href="${fieldPortalUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Open job status page</a>
  </p>
  <p style="color: #64748b; font-size: 0.875rem;">Use this link on the day of the job — no login required. If you have any questions, contact Kleen admin.</p>
</body>
</html>
`.trim();

  try {
    const { error } = await resend.emails.send({
      from: resolveResendFrom(),
      to: operative.email,
      subject: `Job ${ref} — You've been assigned`,
      html,
    });
    if (error) {
      console.error("Resend send error:", error);
      return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, to: operative.email });
  } catch (e) {
    console.error("send-contractor-email error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
