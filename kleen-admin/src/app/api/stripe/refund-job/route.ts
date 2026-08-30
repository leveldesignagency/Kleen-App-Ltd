import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { refundJobInternal } from "@/lib/refund-job-internal";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { jobId, amountPence, reason, cancelAuthorizationOnly } = body as {
      jobId?: string;
      amountPence?: number;
      reason?: string;
      cancelAuthorizationOnly?: boolean;
    };

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const result = await refundJobInternal({
      jobId,
      amountPence,
      reason,
      cancelAuthorizationOnly,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      amount_pence: result.amount_pence,
      total_refunded_pence: result.total_refunded_pence,
      cancelledAuthorization: result.cancelledAuthorization,
      message: result.message,
    });
  } catch (e) {
    console.error("refund-job:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refund failed" },
      { status: 500 },
    );
  }
}
