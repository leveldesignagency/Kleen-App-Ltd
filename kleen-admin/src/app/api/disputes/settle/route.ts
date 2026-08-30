import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { settleDispute } from "@/lib/dispute-settlement";
import { RESOLUTION_TYPES, type ResolutionType } from "@/lib/dispute-resolution-types";
import { logDisputeAction, loadDisputeContext } from "@/lib/dispute-context";
import { refundJobInternal } from "@/lib/refund-job-internal";
import { releaseFundsForJob } from "@/lib/release-funds-internal";

const ALLOWED_STATUS = new Set(["resolved", "closed", "under_review", "escalated"]);
const RESOLUTION_SET = new Set(RESOLUTION_TYPES.map((r) => r.value));

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: {
    disputeId?: string;
    status?: string;
    resolutionType?: string;
    resolutionNote?: string;
    internalNote?: string;
    partialRefundPence?: number;
    promo?: {
      discountKind?: string;
      discountValue?: number;
      description?: string;
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const disputeId = typeof body.disputeId === "string" ? body.disputeId.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";
  const resolutionType = typeof body.resolutionType === "string" ? body.resolutionType : "";
  const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";

  if (!disputeId || !ALLOWED_STATUS.has(status) || !RESOLUTION_SET.has(resolutionType as ResolutionType)) {
    return NextResponse.json({ error: "Invalid disputeId, status, or resolution type" }, { status: 400 });
  }

  if (isDisputeClosing(status) && resolutionNote.length < 10) {
    return NextResponse.json(
      { error: "Resolution note must be at least 10 characters when closing a case" },
      { status: 400 },
    );
  }

  const result = await settleDispute({
    disputeId,
    actorId: auth.userId,
    status: status as "resolved" | "closed" | "under_review" | "escalated",
    resolutionType: resolutionType as ResolutionType,
    resolutionNote,
    internalNote: typeof body.internalNote === "string" ? body.internalNote.trim() : undefined,
    partialRefundPence:
      typeof body.partialRefundPence === "number" ? Math.round(body.partialRefundPence) : undefined,
    promo:
      body.promo?.discountKind === "percentage" || body.promo?.discountKind === "fixed"
        ? {
            discountKind: body.promo.discountKind,
            discountValue: Math.round(body.promo.discountValue ?? 0),
            description: (body.promo.description || "Goodwill gesture from Kleen").slice(0, 500),
          }
        : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, summary: result.summary, promoCode: result.promoCode });
}

function isDisputeClosing(status: string) {
  return status === "resolved" || status === "closed";
}

/** Quick financial action without closing the case */
export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: {
    disputeId?: string;
    action?: string;
    amountPence?: number;
    reason?: string;
    note?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const disputeId = typeof body.disputeId === "string" ? body.disputeId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!disputeId) {
    return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
  }

  const ctx = await loadDisputeContext(disputeId);
  if (!ctx?.job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reason = (body.reason || body.note || "Dispute terminal action").slice(0, 500);

  if (action === "partial_refund" || action === "full_refund") {
    const res = await refundJobInternal({
      jobId: ctx.job.id,
      amountPence: action === "full_refund" ? undefined : body.amountPence,
      reason,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    await logDisputeAction({
      disputeId,
      actorId: auth.userId,
      actionType: action,
      summary: `Refund processed: ${res.amount_pence ?? 0} pence`,
      metadata: { amount_pence: res.amount_pence },
    });
    return NextResponse.json({
      ok: true,
      amount_pence: res.amount_pence,
      total_refunded_pence: res.total_refunded_pence,
      cancelledAuthorization: res.cancelledAuthorization,
      message: res.message,
    });
  }

  if (action === "cancel_auth") {
    const res = await refundJobInternal({
      jobId: ctx.job.id,
      cancelAuthorizationOnly: true,
      reason,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    await logDisputeAction({
      disputeId,
      actorId: auth.userId,
      actionType: "cancel_authorization",
      summary: "Authorization cancelled",
    });
    return NextResponse.json({
      ok: true,
      cancelledAuthorization: res.cancelledAuthorization,
      message: res.message,
    });
  }

  if (action === "release_funds") {
    const res = await releaseFundsForJob(ctx.job.id, { skipDisputeCheck: true });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    await logDisputeAction({
      disputeId,
      actorId: auth.userId,
      actionType: "release_funds",
      summary: `Released ${res.contractor_share_pence} pence to contractor`,
    });
    return NextResponse.json({ ok: true, contractor_share_pence: res.contractor_share_pence });
  }

  if (action === "internal_note" && body.note?.trim()) {
    await logDisputeAction({
      disputeId,
      actorId: auth.userId,
      actionType: "internal_note",
      summary: body.note.trim().slice(0, 280),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
