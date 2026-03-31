import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { releaseFundsForJob } from "@/lib/release-funds-internal";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { jobId } = body as { jobId?: string };
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const result = await releaseFundsForJob(jobId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      contractor_share_pence: result.contractor_share_pence,
      transferred: result.transferred,
      message: result.message,
    });
  } catch (e) {
    console.error("release-funds error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Release failed" },
      { status: 500 }
    );
  }
}
