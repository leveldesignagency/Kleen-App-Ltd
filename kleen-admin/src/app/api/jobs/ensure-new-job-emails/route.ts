import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { ensureUnsentNewJobAdminEmails } from "@/lib/ensure-new-job-admin-emails";

export const dynamic = "force-dynamic";

/** Called when admin opens dashboard — catches jobs customer notify missed. */
export async function POST() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const result = await ensureUnsentNewJobAdminEmails();
  if (result.errors.length) {
    console.warn("ensure-new-job-emails:", result);
  }
  return NextResponse.json({ ok: true, ...result });
}
