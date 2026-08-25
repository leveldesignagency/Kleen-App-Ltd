import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendCustomerQuotesReadyEmail } from "@/lib/resend-customer-job-updates";

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Email not configured (RESEND_API_KEY missing)" },
      { status: 503 }
    );
  }

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

  const result = await sendCustomerQuotesReadyEmail({
    toEmail: customer.email,
    customerName: customer.full_name?.trim() || "there",
    jobReference: ref,
    jobId,
    serviceName,
    quoteCount: count,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to: customer.email });
}
