import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { Resend } from "resend";

// Use Resend's default so only RESEND_API_KEY is required; no domain verification needed
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Kleen <onboarding@resend.dev>";
const CUSTOMER_DASHBOARD_URL = process.env.CUSTOMER_DASHBOARD_URL || "https://dashboard.kleenapp.co.uk";

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
  const { jobId, quoteCount } = body as { jobId?: string; quoteCount?: number };
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  const count = typeof quoteCount === "number" && quoteCount >= 1 ? quoteCount : 1;

  const supabase = createServiceRoleClient();
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, user_id, reference, services(name)")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const userId = (job as { user_id?: string }).user_id;
  if (!userId) {
    return NextResponse.json({ error: "Job has no customer" }, { status: 400 });
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (!customer?.email) {
    return NextResponse.json({ error: "Customer has no email" }, { status: 400 });
  }

  const ref = (job as { reference?: string }).reference || jobId.slice(0, 8).toUpperCase();
  const serviceName = (job as { services?: { name?: string } }).services?.name || "Cleaning";
  const jobUrl = `${CUSTOMER_DASHBOARD_URL.replace(/\/$/, "")}/dashboard/jobs/${jobId}`;
  const quoteWord = count === 1 ? "quote" : "quotes";
  const intro =
    count === 1
      ? "You have a quote available for your cleaning job."
      : `You have ${count} quotes available for your cleaning job.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quotes ready — ${ref}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">Your ${quoteWord} ${count === 1 ? "is" : "are"} ready</h1>
  <p style="color: #64748b; margin-bottom: 16px;">${intro}</p>
  <p style="margin-bottom: 24px;">Job <strong>${ref}</strong> · ${serviceName}</p>
  <p style="margin-bottom: 24px;">
    <a href="${jobUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">View ${quoteWord} in your dashboard</a>
  </p>
  <p style="color: #64748b; font-size: 0.875rem;">Log in to choose your preferred quote and confirm the booking.</p>
</body>
</html>
`.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      subject: count === 1 ? `Quote ready for job ${ref}` : `${count} quotes ready for job ${ref}`,
      html,
    });
    if (error) {
      console.error("Resend send error (notify-customer-quotes):", error);
      return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, to: customer.email });
  } catch (e) {
    console.error("notify-customer-quotes error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
