import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { purgeDueContractorDocuments } from "@/lib/gdpr/purge-contractor-docs";

/**
 * Daily cron: purge contractor ID docs past documents_retain_until (unless legal hold).
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
  const result = await purgeDueContractorDocuments(supabase);
  return NextResponse.json({ ok: true, ...result });
}
