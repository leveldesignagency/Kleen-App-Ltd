import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { notifyAdminNewJobEmail } from "@/lib/admin-new-job-email";
import { markAdminNewJobEmailSent } from "@/lib/mark-admin-new-job-email-sent";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequestUser(request);
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
        userId: user.id,
        userEmail: user.email,
      });
      return NextResponse.json(
        { error: result.error || "Email not sent", jobId },
        { status: 503 },
      );
    }

    await markAdminNewJobEmailSent(jobId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Notify failed";
    console.error("notify-admin-new-job unhandled:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
