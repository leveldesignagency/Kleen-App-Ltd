import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  anonymiseCustomerAccountForDeletion,
  userHasActiveLegalHold,
} from "@/lib/gdpr/anonymise-account";

/**
 * Daily cron: anonymise + delete auth users whose scheduled deletion date has passed.
 * Skips accounts with an active legal hold (fraud / safety / legal claims).
 * Vercel Cron: GET with Authorization: Bearer CRON_SECRET
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
    .lte("account_deletion_scheduled_at", now)
    .is("anonymised_at", null);

  if (qErr) {
    console.error("purge-deleted-accounts query:", qErr);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const ids = rows?.map((r) => r.id as string) ?? [];
  const errors: string[] = [];
  let deleted = 0;
  let skippedHold = 0;

  for (const userId of ids) {
    if (await userHasActiveLegalHold(supabase, userId)) {
      skippedHold += 1;
      continue;
    }

    const anon = await anonymiseCustomerAccountForDeletion(supabase, userId);
    if (!anon.ok) {
      if (anon.skipped) {
        skippedHold += 1;
        continue;
      }
      errors.push(`${userId}: anonymise failed (${anon.reason || "unknown"})`);
      continue;
    }

    // Remove login; profile row may cascade from auth delete OR remain if FK only on auth→profiles cascade.
    // profiles.id references auth.users ON DELETE CASCADE — so deleteUser removes the anonymised profile too.
    // To retain anonymised profile tombstone we'd need to change that FK; instead we keep job/payment ledgers
    // with user_id SET NULL (migration 051) which is the durable record.
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`deleteUser ${userId}:`, error.message);
      errors.push(`${userId}: ${error.message}`);
      continue;
    }
    deleted += 1;
  }

  return NextResponse.json({
    ok: true,
    candidates: ids.length,
    deleted,
    skippedHold,
    errors: errors.length ? errors : undefined,
  });
}
