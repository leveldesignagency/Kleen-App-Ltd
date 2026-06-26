import { NextRequest, NextResponse } from "next/server";
import { ensureUnsentNewJobAdminEmails } from "@/lib/ensure-new-job-admin-emails";

export const dynamic = "force-dynamic";

/** Cron / internal backup — send admin emails for jobs the customer notify missed. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensureUnsentNewJobAdminEmails();
  if (result.errors.length) {
    console.warn("cron/ensure-new-job-admin-emails:", result);
  }
  return NextResponse.json({ ok: true, ...result });
}
