import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Daily cron: delete auth users whose scheduled deletion date has passed.
 * Vercel Cron or external scheduler: GET with Authorization: Bearer CRON_SECRET
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
  const now = new Date().toISOString();

  const { data: rows, error: qErr } = await supabase
    .from("profiles")
    .select("id")
    .not("account_deletion_scheduled_at", "is", null)
    .lte("account_deletion_scheduled_at", now);

  if (qErr) {
    console.error("purge-deleted-accounts query:", qErr);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const ids = rows?.map((r) => r.id as string) ?? [];
  const errors: string[] = [];

  for (const userId of ids) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`deleteUser ${userId}:`, error.message);
      errors.push(`${userId}: ${error.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    processed: ids.length,
    errors: errors.length ? errors : undefined,
  });
}
