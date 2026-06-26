import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyAdminNewJobEmail } from "@/lib/admin-new-job-email";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const jobId = body.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const result = await notifyAdminNewJobEmail(supabase, {
    jobId,
    userId: user.id,
    userEmail: user.email,
  });

  if (!result.ok) {
    console.error("notify-admin-new-job:", result.error, {
      jobId,
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
    });
    return NextResponse.json({ error: result.error || "Email not sent" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
