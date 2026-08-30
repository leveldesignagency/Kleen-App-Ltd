import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isDisputeResolved } from "@/lib/dispute-helpers";
import type { ResolutionType } from "@/lib/dispute-resolution-types";
import { loadDisputeContext, logDisputeAction } from "@/lib/dispute-context";
import { refundJobInternal } from "@/lib/refund-job-internal";
import { releaseFundsForJob } from "@/lib/release-funds-internal";
import { issueGoodwillPromo } from "@/lib/dispute-promo";
import {
  sendCustomerDisputeResolvedEmail,
  sendContractorDisputeResolvedEmail,
} from "@/lib/resend-customer-job-updates";

const DISPUTE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export type SettleDisputeParams = {
  disputeId: string;
  actorId: string;
  status: "resolved" | "closed" | "under_review" | "escalated";
  resolutionType: ResolutionType;
  resolutionNote: string;
  internalNote?: string;
  partialRefundPence?: number;
  promo?: {
    discountKind: "percentage" | "fixed";
    discountValue: number;
    description: string;
  };
};

export type SettleDisputeResult =
  | { ok: true; summary: string[]; promoCode?: string }
  | { ok: false; error: string; status: number };

export async function settleDispute(params: SettleDisputeParams): Promise<SettleDisputeResult> {
  const ctx = await loadDisputeContext(params.disputeId);
  if (!ctx) {
    return { ok: false, error: "Dispute not found", status: 404 };
  }

  const { dispute, job, pricing, customer, contractor } = ctx;
  if (!job) {
    return { ok: false, error: "Job not found", status: 404 };
  }

  const summary: string[] = [];
  let refundTotal = dispute.refund_amount_pence ?? 0;
  let promoCodeId = dispute.promo_code_id as string | null;
  let issuedPromoCode: string | undefined;

  const notePrefix = `[Dispute ${params.disputeId.slice(0, 8)}] `;
  const reason = notePrefix + (params.resolutionNote || params.resolutionType);

  if (params.internalNote?.trim()) {
    const admin = createServiceRoleClient();
    const merged = [dispute.internal_notes, params.internalNote.trim()].filter(Boolean).join("\n\n");
    await admin.from("disputes").update({ internal_notes: merged }).eq("id", dispute.id);
    await logDisputeAction({
      disputeId: dispute.id,
      actorId: params.actorId,
      actionType: "internal_note",
      summary: params.internalNote.trim().slice(0, 280),
    });
    summary.push("Internal note saved");
  }

  switch (params.resolutionType) {
    case "cancel_authorization": {
      const res = await refundJobInternal({
        jobId: job.id,
        cancelAuthorizationOnly: true,
        reason,
      });
      if (!res.ok) return { ok: false, error: res.error, status: res.status };
      summary.push(res.message || "Card authorisation cancelled");
      await logDisputeAction({
        disputeId: dispute.id,
        actorId: params.actorId,
        actionType: "cancel_authorization",
        summary: "Cancelled uncaptured card hold",
      });
      break;
    }
    case "customer_full_refund": {
      const res = await refundJobInternal({ jobId: job.id, reason });
      if (!res.ok) return { ok: false, error: res.error, status: res.status };
      refundTotal = res.total_refunded_pence ?? pricing.chargedPence;
      summary.push(`Refunded ${formatPence(res.amount_pence ?? refundTotal)} to customer`);
      await logDisputeAction({
        disputeId: dispute.id,
        actorId: params.actorId,
        actionType: "full_refund",
        summary: summary[summary.length - 1],
        metadata: { amount_pence: res.amount_pence },
      });
      break;
    }
    case "customer_partial_refund": {
      const amount = params.partialRefundPence;
      if (!amount || amount <= 0) {
        return { ok: false, error: "Enter a valid partial refund amount", status: 400 };
      }
      const res = await refundJobInternal({ jobId: job.id, amountPence: amount, reason });
      if (!res.ok) return { ok: false, error: res.error, status: res.status };
      refundTotal = res.total_refunded_pence ?? amount;
      summary.push(`Partial refund ${formatPence(res.amount_pence)} to customer`);
      await logDisputeAction({
        disputeId: dispute.id,
        actorId: params.actorId,
        actionType: "partial_refund",
        summary: summary[summary.length - 1],
        metadata: { amount_pence: res.amount_pence },
      });
      break;
    }
    case "split_settlement": {
      const amount = params.partialRefundPence;
      if (!amount || amount <= 0) {
        return { ok: false, error: "Enter refund amount for split settlement", status: 400 };
      }
      const res = await refundJobInternal({ jobId: job.id, amountPence: amount, reason });
      if (!res.ok) return { ok: false, error: res.error, status: res.status };
      refundTotal = res.total_refunded_pence ?? amount;
      summary.push(`Partial refund ${formatPence(res.amount_pence)} to customer`);
      await logDisputeAction({
        disputeId: dispute.id,
        actorId: params.actorId,
        actionType: "partial_refund",
        summary: summary[summary.length - 1],
        metadata: { amount_pence: res.amount_pence },
      });
      if (!job.funds_released_at) {
        const rel = await releaseFundsForJob(job.id, { skipDisputeCheck: true });
        if (!rel.ok) {
          return {
            ok: false,
            error: `Refund succeeded but contractor release failed: ${rel.error}`,
            status: rel.status,
          };
        }
        summary.push(`Released ${formatPence(rel.contractor_share_pence)} to contractor`);
        await logDisputeAction({
          disputeId: dispute.id,
          actorId: params.actorId,
          actionType: "release_funds",
          summary: summary[summary.length - 1],
          metadata: { contractor_share_pence: rel.contractor_share_pence },
        });
      }
      break;
    }
    case "contractor_upheld": {
      if (!job.funds_released_at) {
        const rel = await releaseFundsForJob(job.id, { skipDisputeCheck: true });
        if (!rel.ok) return { ok: false, error: rel.error, status: rel.status };
        summary.push(`Released ${formatPence(rel.contractor_share_pence)} to contractor`);
        await logDisputeAction({
          disputeId: dispute.id,
          actorId: params.actorId,
          actionType: "release_funds",
          summary: summary[summary.length - 1],
          metadata: { contractor_share_pence: rel.contractor_share_pence },
        });
      } else {
        summary.push("Funds already released to contractor");
      }
      break;
    }
    case "goodwill_promo": {
      if (!params.promo || !dispute.user_id) {
        return { ok: false, error: "Promo details and customer required", status: 400 };
      }
      const promo = await issueGoodwillPromo({
        customerUserId: dispute.user_id,
        disputeId: dispute.id,
        discountKind: params.promo.discountKind,
        discountValue: params.promo.discountValue,
        description: params.promo.description,
      });
      if (!promo.ok) return { ok: false, error: promo.error, status: 400 };
      promoCodeId = promo.promoCodeId;
      issuedPromoCode = promo.code;
      summary.push(`Issued promo code ${promo.code}`);
      await logDisputeAction({
        disputeId: dispute.id,
        actorId: params.actorId,
        actionType: "goodwill_promo",
        summary: summary[summary.length - 1],
        metadata: { code: promo.code },
      });
      break;
    }
    case "documented_only":
    default:
      summary.push("Case documented — no payment action");
      await logDisputeAction({
        disputeId: dispute.id,
        actorId: params.actorId,
        actionType: "documented_only",
        summary: "No financial action taken",
      });
      break;
  }

  const admin = createServiceRoleClient();
  const becomingResolved = isDisputeResolved(params.status) && !isDisputeResolved(dispute.status);

  const disputeUpdates: Record<string, unknown> = {
    status: params.status,
    resolution: params.resolutionNote.trim() || null,
    resolution_type: params.resolutionType,
    refund_amount_pence: refundTotal > 0 ? refundTotal : dispute.refund_amount_pence,
    promo_code_id: promoCodeId,
  };

  if (becomingResolved) {
    disputeUpdates.resolved_at = new Date().toISOString();
    disputeUpdates.resolved_by = params.actorId;
  }

  await admin.from("disputes").update(disputeUpdates).eq("id", dispute.id);

  if (becomingResolved && job.status === "disputed") {
    let nextStatus = "awaiting_completion";
    if (job.customer_confirmed_complete_at && job.contractor_confirmed_complete_at) {
      nextStatus = "completed";
    } else if (job.operative_marked_complete_at || job.customer_confirmed_complete_at) {
      nextStatus = "pending_confirmation";
    }
    const jobUpdates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "completed" && !job.funds_released_at) {
      jobUpdates.escrow_release_date = new Date(Date.now() + DISPUTE_DAYS_MS).toISOString();
    }
    await admin.from("jobs").update(jobUpdates).eq("id", job.id);
  }

  if (becomingResolved) {
    const jobReference = job.reference || job.id.slice(0, 8).toUpperCase();
    if (customer?.email) {
      void sendCustomerDisputeResolvedEmail({
        toEmail: customer.email,
        customerName: customer.name,
        jobReference,
        jobId: job.id,
        resolution: params.resolutionNote.trim() || null,
        status: params.status,
      }).catch((e) => console.error("sendCustomerDisputeResolvedEmail:", e));
    }
    if (contractor?.email) {
      void sendContractorDisputeResolvedEmail({
        toEmail: contractor.email,
        contractorName: contractor.name,
        jobReference,
        resolution: params.resolutionNote.trim() || null,
        status: params.status,
      }).catch((e) => console.error("sendContractorDisputeResolvedEmail:", e));
    }
    await logDisputeAction({
      disputeId: dispute.id,
      actorId: params.actorId,
      actionType: "case_resolved",
      summary: `Case marked ${params.status}`,
      metadata: { resolution_type: params.resolutionType },
    });
    summary.push(`Case marked ${params.status}`);
  }

  return { ok: true, summary, promoCode: issuedPromoCode };
}

function formatPence(pence: number | null | undefined): string {
  if (pence == null) return "£0.00";
  return `£${(pence / 100).toFixed(2)}`;
}
