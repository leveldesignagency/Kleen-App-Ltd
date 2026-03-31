import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { releaseFundsForJob } from "@/lib/release-funds-internal";

/**
 * Scheduled release after dispute window (e.g. Vercel Cron daily).
 * Authorization: Bearer CRON_SECRET (same env as other cron routes).
 *
 * Picks jobs: status=completed, funds not released, escrow_release_date set and <= now.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("status", "completed")
    .is("funds_released_at", null)
    .not("escrow_release_date", "is", null)
    .lte("escrow_release_date", nowIso);

  if (error) {
    console.error("cron release-due-funds query:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { jobId: string; ok: boolean; error?: string }[] = [];
  for (const row of rows || []) {
    const jobId = row.id as string;
    const r = await releaseFundsForJob(jobId);
    if (r.ok) {
      results.push({ jobId, ok: true });
    } else {
      results.push({ jobId, ok: false, error: r.error });
    }
  }

  const okCount = results.filter((x) => x.ok).length;
  return NextResponse.json({
    scanned: (rows || []).length,
    released: okCount,
    results,
  });
}
