"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  Scale,
  Send,
  Shield,
  User,
  Wrench,
} from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useAdminNotifications } from "@/lib/admin-notifications";
import {
  DISPUTE_STATUS_OPTIONS,
  disputeStatusBadgeClass,
  isDisputeResolved,
} from "@/lib/dispute-helpers";
import {
  RESOLUTION_TYPES,
  formatPence,
  poundsToPence,
  type ResolutionType,
} from "@/lib/dispute-resolution-types";

type QueueRow = {
  id: string;
  job_id: string;
  user_id: string;
  status: string;
  reason: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  jobs: { reference: string; status: string } | { reference: string; status: string }[] | null;
};

type Msg = {
  id: string;
  sender_id: string;
  recipient_role: "admin" | "customer" | "operative";
  message: string;
  created_at: string;
};

type DisputeContext = {
  dispute: {
    id: string;
    status: string;
    reason: string;
    resolution: string | null;
    resolution_type: string | null;
    refund_amount_pence: number | null;
    internal_notes: string | null;
    created_at: string;
    resolved_at: string | null;
  };
  job: {
    id: string;
    reference: string;
    status: string;
    payment_authorized_at: string | null;
    payment_captured_at: string | null;
    funds_released_at: string | null;
    escrow_release_date: string | null;
    operative_marked_complete_at: string | null;
    customer_confirmed_complete_at: string | null;
    contractor_confirmed_complete_at: string | null;
  } | null;
  payment: {
    amount_pence: number;
    refund_amount_pence: number | null;
    status: string;
  } | null;
  pricing: {
    customerPricePence: number | null;
    chargedPence: number;
    refundedPence: number;
    remainingRefundablePence: number;
    contractorSharePence: number;
    platformFeePence: number;
    netAfterRefundPence: number;
  };
  customer: { id: string; name: string; email: string } | null;
  contractor: { id: string; name: string; email: string } | null;
  promoCode: string | null;
  actions: Array<{
    id: string;
    action_type: string;
    summary: string;
    created_at: string;
  }>;
  customerHistory: { priorDisputes: number };
  riskFlags?: {
    customer: Array<{ flag_type: string; severity: string; notes: string | null }>;
    contractor: Array<{ flag_type: string; severity: string; notes: string | null }>;
  };
  evidence?: Array<{
    source: "dispute" | "job_report";
    label: string;
    note: string | null;
    paths: string[];
    signedUrls: string[];
    created_at: string | null;
  }>;
  jobReports?: Array<{
    id: string;
    stage: string;
    job_outcome: string | null;
    summary: string | null;
    submitted_at: string;
    itemCount: number;
  }>;
  mediation?: {
    contractorNotified: boolean;
    firstContractorMessageAt: string | null;
    contractorReplyCount: number;
  };
};

type Tab = "overview" | "thread" | "evidence" | "audit";

const FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "resolved", label: "Resolved" },
];

const RECIPIENT_OPTIONS = [
  { value: "customer", label: "Reply to customer" },
  { value: "operative", label: "Forward to contractor" },
];

function buildContractorBrief(customerReason: string) {
  const trimmed = customerReason.trim().slice(0, 600);
  return [
    "We've received a customer concern about this job and need your response.",
    "",
    "Please reply in Disputes with:",
    "1. Your account of what happened on site",
    "2. Any photos / checklist evidence already on the job report (or note if none)",
    "3. Whether you believe work was completed as quoted",
    "",
    "Kleen summary of the concern (do not contact the customer):",
    trimmed || "(see full case with Kleen)",
  ].join("\n");
}

function buildCustomerAck() {
  return [
    "Thanks for raising this — we've opened a review.",
    "",
    "We'll gather information from the contractor and come back to you with an update.",
    "Please keep any photos of the issue ready in case we need them.",
    "",
    "You only message Kleen here — never the contractor directly.",
  ].join("\n");
}

function buildEvidenceRequest() {
  return [
    "Please send your evidence for this dispute via the contractor app:",
    "",
    "• Reply here with your written response",
    "• Ensure before/after photos and checklist notes are on the job report",
    "• Flag anything the customer said that doesn't match what you saw on site",
    "",
    "Do not contact the customer. Reply only to Kleen.",
  ].join("\n");
}

export default function DisputeTerminal() {
  const toast = useAdminNotifications((s) => s.push);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<DisputeContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [recipientRole, setRecipientRole] = useState("customer");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const [resolutionType, setResolutionType] = useState<ResolutionType>("documented_only");
  const [statusDraft, setStatusDraft] = useState("resolved");
  const [resolutionNote, setResolutionNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [partialPounds, setPartialPounds] = useState("");
  const [promoKind, setPromoKind] = useState<"percentage" | "fixed">("percentage");
  const [promoValue, setPromoValue] = useState("15");
  const [settling, setSettling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadRows = useCallback(async () => {
    const res = await fetch("/api/disputes/list", { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { disputes?: QueueRow[] };
    setRows(json.disputes || []);
    setLoading(false);
  }, []);

  const loadContext = useCallback(async (disputeId: string) => {
    setCtxLoading(true);
    const res = await fetch(`/api/disputes/detail?disputeId=${encodeURIComponent(disputeId)}`, {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as { context?: DisputeContext };
    setCtx(json.context ?? null);
    if (json.context) {
      setResolutionNote(json.context.dispute.resolution || "");
      setStatusDraft(isDisputeResolved(json.context.dispute.status) ? json.context.dispute.status : "resolved");
      if (json.context.dispute.resolution_type) {
        setResolutionType(json.context.dispute.resolution_type as ResolutionType);
      }
    }
    setCtxLoading(false);
  }, []);

  const loadMessages = useCallback(async (disputeId: string) => {
    setMsgLoading(true);
    const res = await fetch(`/api/disputes/messages?disputeId=${encodeURIComponent(disputeId)}`, {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: Msg[] };
    setMessages(json.messages || []);
    setMsgLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filter === "resolved") list = list.filter((r) => isDisputeResolved(r.status));
    else if (filter === "active") list = list.filter((r) => !isDisputeResolved(r.status));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const j = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
      return (
        r.reason.toLowerCase().includes(q) ||
        (j?.reference || "").toLowerCase().includes(q) ||
        r.status.includes(q)
      );
    });
  }, [rows, filter, search]);

  const openCase = useCallback(
    async (id: string) => {
      setActiveId(id);
      setTab("overview");
      setReplyText("");
      setRecipientRole("customer");
      await Promise.all([loadContext(id), loadMessages(id)]);
    },
    [loadContext, loadMessages],
  );

  useEffect(() => {
    if (deepLinkHandled || loading || rows.length === 0) return;
    const disputeId = searchParams.get("disputeId")?.trim();
    const jobId = searchParams.get("jobId")?.trim();
    if (disputeId) {
      setDeepLinkHandled(true);
      void openCase(disputeId);
      return;
    }
    if (jobId) {
      const match =
        rows.find((r) => r.job_id === jobId && !isDisputeResolved(r.status)) ||
        rows.find((r) => r.job_id === jobId);
      if (match) {
        setDeepLinkHandled(true);
        void openCase(match.id);
      }
    }
  }, [deepLinkHandled, loading, rows, searchParams, openCase]);

  const activeRow = rows.find((r) => r.id === activeId) || null;

  const applyDraft = (role: "customer" | "operative", text: string) => {
    setRecipientRole(role);
    setReplyText(text);
    setTab("thread");
  };

  const sendReply = async () => {
    if (!activeId || !replyText.trim()) return;
    setSending(true);
    const res = await fetch("/api/disputes/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId: activeId, message: replyText.trim(), recipientRole }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
    setSending(false);
    if (!res.ok) {
      toast({ type: "error", title: "Send failed", message: json.error || "Could not send" });
      return;
    }
    setReplyText("");
    void loadRows();
    await Promise.all([loadMessages(activeId), loadContext(activeId)]);
    toast({
      type: "success",
      title: recipientRole === "operative" ? "Sent to contractor" : "Sent to customer",
      message:
        recipientRole === "operative"
          ? "Contractor can reply with evidence in their app."
          : "Customer will see this in their disputes thread.",
    });
  };

  const executeSettlement = async () => {
    if (!activeId) return;
    setSettling(true);
    setShowConfirm(false);

    const partialRefundPence =
      resolutionType === "customer_partial_refund" || resolutionType === "split_settlement"
        ? poundsToPence(partialPounds) ?? undefined
        : undefined;

    const promo =
      resolutionType === "goodwill_promo"
        ? {
            discountKind: promoKind,
            discountValue:
              promoKind === "percentage"
                ? Math.min(100, Math.max(1, parseInt(promoValue, 10) || 15))
                : poundsToPence(promoValue) ?? 1000,
            description: `Goodwill — dispute ${activeId.slice(0, 8)}`,
          }
        : undefined;

    const res = await fetch("/api/disputes/settle", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disputeId: activeId,
        status: statusDraft,
        resolutionType,
        resolutionNote,
        internalNote: internalNote.trim() || undefined,
        partialRefundPence,
        promo,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      summary?: string[];
      promoCode?: string;
    };
    setSettling(false);

    if (!res.ok) {
      toast({ type: "error", title: "Settlement failed", message: json.error || "Could not settle" });
      return;
    }

    toast({
      type: "success",
      title: "Settlement executed",
      message: (json.summary || []).join(" · ") || "Done",
    });
    setInternalNote("");
    await Promise.all([loadRows(), loadContext(activeId)]);
  };

  const quickAction = async (action: string, amountPence?: number) => {
    if (!activeId) return;
    const res = await fetch("/api/disputes/settle", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId: activeId, action, amountPence, note: internalNote }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast({ type: "error", title: "Action failed", message: json.error || "Failed" });
      return;
    }
    toast({ type: "success", title: "Action completed" });
    await loadContext(activeId);
  };

  const msgMeta = (m: Msg) => {
    if (m.recipient_role === "customer") {
      return { label: "Kleen → Customer", lane: "customer" as const, fromCustomer: false };
    }
    if (m.recipient_role === "operative") {
      return { label: "Kleen → Contractor", lane: "contractor" as const, fromCustomer: false };
    }
    if (activeRow?.user_id && m.sender_id === activeRow.user_id) {
      return { label: "Customer → Kleen", lane: "customer" as const, fromCustomer: true };
    }
    return { label: "Contractor → Kleen", lane: "contractor" as const, fromCustomer: false };
  };

  const selectedOutcome = RESOLUTION_TYPES.find((r) => r.value === resolutionType);
  const caseClosed = ctx ? isDisputeResolved(ctx.dispute.status) : false;
  const piState = ctx?.job?.funds_released_at
    ? "released"
    : ctx?.job?.payment_captured_at
      ? "captured"
      : ctx?.job?.payment_authorized_at
        ? "authorized"
        : "none";
  const mediation = ctx?.mediation;
  const evidenceCount = (ctx?.evidence || []).reduce((n, e) => n + e.signedUrls.length, 0);

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dispute resolution terminal</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Mediate between customer and contractor. Document outcomes, execute refunds, issue goodwill codes, and
            release escrow — parties never see each other&apos;s details.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="h-4 w-4 text-brand-400" />
          All actions are logged for audit
        </div>
      </header>

      <div className="grid flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        {/* Queue */}
        <aside className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Queue</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              {filteredRows.length}
            </span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref or reason…"
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-brand-500"
          />
          <div className="mt-2">
            <CustomDropdown value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            </div>
          ) : (
            <ul className="mt-3 max-h-[65vh] flex-1 space-y-2 overflow-y-auto">
              {filteredRows.map((r) => {
                const j = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openCase(r.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        activeId === r.id
                          ? "border-brand-500/50 bg-brand-500/10"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs font-semibold text-slate-100">{j?.reference || "Job"}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${disputeStatusBadgeClass(r.status)}`}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.reason}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {new Date(r.created_at).toLocaleString("en-GB")}
                      </p>
                    </button>
                  </li>
                );
              })}
              {filteredRows.length === 0 && (
                <li className="py-8 text-center text-sm text-slate-500">No disputes in this filter.</li>
              )}
            </ul>
          )}
        </aside>

        {/* Workspace */}
        <main className="flex min-h-[480px] flex-col rounded-2xl border border-white/10 bg-white/[0.03]">
          {!activeId || !activeRow ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <Scale className="h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">Select a case from the queue to open the resolution workspace.</p>
            </div>
          ) : ctxLoading && !ctx ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold text-slate-100">
                      {ctx?.job?.reference || "Case"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{activeRow.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/jobs/${activeRow.job_id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-white/10"
                    >
                      Job record <ExternalLink className="h-3 w-3" />
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${disputeStatusBadgeClass(activeRow.status)}`}
                    >
                      {activeRow.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-1 border-b border-white/5 pb-0">
                  {(
                    [
                      ["overview", "Overview", FileText],
                      ["thread", "Mediate", MessageSquare],
                      ["evidence", "Evidence", ImageIcon],
                      ["audit", "Audit log", Clock],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                        tab === key
                          ? "border-brand-400 text-brand-300"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {key === "evidence" && evidenceCount > 0 && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{evidenceCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {tab === "overview" && ctx && (
                  <div className="space-y-5">
                    {!caseClosed && (
                      <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">
                          Mediation checklist
                        </p>
                        <ol className="mt-3 space-y-2.5 text-sm text-slate-300">
                          <MediationStep
                            done
                            title="Customer opened dispute"
                            detail="Only Kleen sees the raw reason until you rewrite & forward."
                          />
                          <MediationStep
                            done={Boolean(mediation?.contractorNotified)}
                            title="Forward rewritten brief to contractor"
                            detail={
                              mediation?.contractorNotified
                                ? `Notified ${mediation.firstContractorMessageAt ? new Date(mediation.firstContractorMessageAt).toLocaleString("en-GB") : ""}`
                                : "Rewrite the customer concern, then send via Mediate → Forward to contractor."
                            }
                            action={
                              !mediation?.contractorNotified && !caseClosed
                                ? {
                                    label: "Draft contractor brief",
                                    onClick: () =>
                                      applyDraft("operative", buildContractorBrief(ctx.dispute.reason)),
                                  }
                                : undefined
                            }
                          />
                          <MediationStep
                            done={(mediation?.contractorReplyCount || 0) > 0}
                            title="Collect contractor evidence"
                            detail={
                              (mediation?.contractorReplyCount || 0) > 0
                                ? `${mediation?.contractorReplyCount} reply(ies) from contractor`
                                : "Contractor replies in their app with notes + job-report photos."
                            }
                            action={
                              mediation?.contractorNotified && (mediation?.contractorReplyCount || 0) === 0
                                ? {
                                    label: "Request evidence",
                                    onClick: () => applyDraft("operative", buildEvidenceRequest()),
                                  }
                                : undefined
                            }
                          />
                          <MediationStep
                            done={caseClosed}
                            title="Settle & document outcome"
                            detail="Use the settlement panel — refund, uphold, promo, or document only."
                          />
                        </ol>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applyDraft("customer", buildCustomerAck())}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
                          >
                            Draft customer acknowledgement
                          </button>
                          <button
                            type="button"
                            onClick={() => applyDraft("operative", buildContractorBrief(ctx.dispute.reason))}
                            className="rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-500/25"
                          >
                            Rewrite &amp; forward to contractor
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <PartyCard
                        icon={User}
                        title="Customer"
                        name={ctx.customer?.name || "—"}
                        email={ctx.customer?.email || "—"}
                        meta={
                          ctx.customerHistory.priorDisputes > 0
                            ? `${ctx.customerHistory.priorDisputes} prior dispute(s)`
                            : "No prior disputes"
                        }
                        flags={ctx.riskFlags?.customer}
                      />
                      <PartyCard
                        icon={Wrench}
                        title="Contractor"
                        name={ctx.contractor?.name || "Unassigned"}
                        email={ctx.contractor?.email || "—"}
                        meta={
                          mediation?.contractorNotified
                            ? "Brought into the case via Kleen message"
                            : "Not notified until you message them"
                        }
                        flags={ctx.riskFlags?.contractor}
                      />
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <Banknote className="h-4 w-4 text-emerald-400" />
                        Payment & escrow
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <Stat label="Customer paid" value={formatPence(ctx.pricing.chargedPence)} />
                        <Stat label="Refunded" value={formatPence(ctx.pricing.refundedPence)} />
                        <Stat label="Refundable left" value={formatPence(ctx.pricing.remainingRefundablePence)} />
                        <Stat label="Contractor share (est.)" value={formatPence(ctx.pricing.contractorSharePence)} />
                        <Stat label="Platform fee (est.)" value={formatPence(ctx.pricing.platformFeePence)} />
                        <Stat label="Payment state" value={piState} />
                      </div>
                      <EscrowTimeline job={ctx.job} />
                    </div>

                    {ctx.dispute.resolution && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-xs font-semibold uppercase text-emerald-300">Resolution on record</p>
                        <p className="mt-2 text-sm text-emerald-100">{ctx.dispute.resolution}</p>
                        {ctx.promoCode && (
                          <p className="mt-2 font-mono text-xs text-emerald-200">Promo: {ctx.promoCode}</p>
                        )}
                      </div>
                    )}

                    {ctx.dispute.internal_notes && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <p className="text-xs font-semibold uppercase text-amber-300">Staff notes (internal)</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-amber-100">{ctx.dispute.internal_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {tab === "thread" && (
                  <div>
                    {msgLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                      </div>
                    ) : (
                      <>
                        <p className="mb-3 text-xs text-slate-500">
                          Two lanes — customer never sees contractor messages and vice versa. Rewrite before forwarding.
                        </p>
                        <ul className="max-h-[42vh] space-y-2 overflow-y-auto">
                          {messages.map((m) => {
                            const meta = msgMeta(m);
                            return (
                              <li
                                key={m.id}
                                className={`rounded-lg border px-3 py-2.5 text-sm ${
                                  meta.lane === "customer"
                                    ? "border-sky-500/20 bg-sky-500/5"
                                    : "border-amber-500/20 bg-amber-500/5"
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-slate-500">
                                    {meta.label} · {new Date(m.created_at).toLocaleString("en-GB")}
                                  </p>
                                  {meta.fromCustomer && !caseClosed && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        applyDraft("operative", buildContractorBrief(m.message))
                                      }
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
                                    >
                                      <Copy className="h-3 w-3" />
                                      Rewrite → contractor
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-slate-200">{m.message}</p>
                              </li>
                            );
                          })}
                          {messages.length === 0 && (
                            <li className="text-sm text-slate-500">No messages yet.</li>
                          )}
                        </ul>
                        {!caseClosed && (
                          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyDraft("customer", buildCustomerAck())}
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                              >
                                Customer ack template
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  applyDraft(
                                    "operative",
                                    buildContractorBrief(activeRow?.reason || ctx?.dispute.reason || ""),
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                              >
                                Contractor brief template
                              </button>
                              <button
                                type="button"
                                onClick={() => applyDraft("operative", buildEvidenceRequest())}
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                              >
                                Request evidence template
                              </button>
                            </div>
                            <CustomDropdown
                              value={recipientRole}
                              onChange={setRecipientRole}
                              options={RECIPIENT_OPTIONS}
                            />
                            {recipientRole === "operative" && (
                              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100/90">
                                Contractor will see this text only — not the customer&apos;s raw reason. Edit before sending.
                              </p>
                            )}
                            <div className="flex gap-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={5}
                                placeholder={
                                  recipientRole === "operative"
                                    ? "Rewrite the concern for the contractor — no customer PII…"
                                    : "Reply as Kleen — redact direct contact details…"
                                }
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                              />
                              <button
                                type="button"
                                disabled={sending || !replyText.trim()}
                                onClick={sendReply}
                                className="inline-flex h-fit items-center gap-2 self-end rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                              >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {recipientRole === "operative" ? "Forward" : "Send"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {tab === "evidence" && ctx && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Job-report photos and any dispute uploads. Ask the contractor to add missing evidence via Mediate.
                    </p>
                    {(ctx.jobReports || []).length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">Job reports</p>
                        <ul className="mt-2 space-y-1.5">
                          {ctx.jobReports!.map((r) => (
                            <li key={r.id} className="text-sm text-slate-300">
                              <span className="font-medium capitalize">{r.stage.replace(/_/g, " ")}</span>
                              {r.job_outcome ? ` · ${r.job_outcome.replace(/_/g, " ")}` : ""}
                              <span className="text-slate-500">
                                {" "}
                                · {r.itemCount} item(s) · {new Date(r.submitted_at).toLocaleString("en-GB")}
                              </span>
                              {r.summary && (
                                <p className="mt-0.5 text-xs text-slate-400">{r.summary}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(ctx.evidence || []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                        No evidence files yet. Forward to the contractor and request photos from the job report.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {ctx.evidence!.map((group, idx) => (
                          <li key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <p className="text-xs font-semibold uppercase text-slate-400">{group.label}</p>
                            {group.note && (
                              <p className="mt-1 text-sm text-slate-300">{group.note}</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.signedUrls.map((url, i) => {
                                const isVideo = /\.(mp4|webm|mov)/i.test(group.paths[i] || url);
                                return isVideo ? (
                                  <video
                                    key={url}
                                    src={url}
                                    controls
                                    className="max-h-40 max-w-[200px] rounded-lg border border-white/10"
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <a key={url} href={url} target="_blank" rel="noreferrer">
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-28 w-28 rounded-lg border border-white/10 object-cover hover:opacity-90"
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {ctx.job?.id && (
                      <Link
                        href={`/jobs/${ctx.job.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:underline"
                      >
                        Open full job record <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}

                {tab === "audit" && ctx && (
                  <ul className="space-y-2">
                    {(ctx.actions || []).map((a) => (
                      <li
                        key={a.id}
                        className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm"
                      >
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        <div>
                          <p className="text-slate-200">{a.summary}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {a.action_type.replace(/_/g, " ")} ·{" "}
                            {new Date(a.created_at).toLocaleString("en-GB")}
                          </p>
                        </div>
                      </li>
                    ))}
                    {ctx.actions.length === 0 && (
                      <li className="text-sm text-slate-500">No actions logged yet.</li>
                    )}
                  </ul>
                )}
              </div>
            </>
          )}
        </main>

        {/* Settlement panel */}
        <aside className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Scale className="h-4 w-4 text-brand-400" />
            Settlement
          </h2>
          {!activeId || !ctx ? (
            <p className="mt-4 text-sm text-slate-500">Select a case to configure settlement.</p>
          ) : (
            <div className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-400">Outcome</label>
                <CustomDropdown
                  className="mt-1"
                  value={resolutionType}
                  onChange={(v) => setResolutionType(v as ResolutionType)}
                  options={RESOLUTION_TYPES.map((r) => ({ value: r.value, label: r.label }))}
                />
                {selectedOutcome && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{selectedOutcome.description}</p>
                )}
              </div>

              {(resolutionType === "customer_partial_refund" || resolutionType === "split_settlement") && (
                <div>
                  <label className="text-xs font-medium text-slate-400">Refund amount (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partialPounds}
                    onChange={(e) => setPartialPounds(e.target.value)}
                    placeholder={`Max ${formatPence(ctx.pricing.remainingRefundablePence)}`}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {resolutionType === "goodwill_promo" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-400">Type</label>
                    <CustomDropdown
                      className="mt-1"
                      value={promoKind}
                      onChange={(v) => setPromoKind(v as "percentage" | "fixed")}
                      options={[
                        { value: "percentage", label: "% off" },
                        { value: "fixed", label: "£ off" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">Value</label>
                    <input
                      value={promoValue}
                      onChange={(e) => setPromoValue(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-400">Case status</label>
                <CustomDropdown
                  className="mt-1"
                  value={statusDraft}
                  onChange={setStatusDraft}
                  options={[...DISPUTE_STATUS_OPTIONS]}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Resolution note <span className="text-slate-600">(shown to customer & contractor)</span>
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  placeholder="Document the decision and what each party should expect…"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Internal note <span className="text-slate-600">(staff only)</span>
                </label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={2}
                  placeholder="Investigation notes, policy rationale, risk flags…"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                />
              </div>

              {!caseClosed && (
                <>
                  <button
                    type="button"
                    disabled={settling}
                    onClick={() => setShowConfirm(true)}
                    className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                  >
                    {settling ? "Executing…" : "Execute settlement"}
                  </button>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs font-semibold text-slate-400">Quick actions (without closing)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ctx.pricing.remainingRefundablePence > 0 && piState === "captured" && (
                        <QuickBtn
                          label="Partial refund"
                          onClick={() => {
                            const p = poundsToPence(partialPounds);
                            if (!p) {
                              toast({ type: "error", title: "Enter amount", message: "Set refund £ in the field above." });
                              return;
                            }
                            void quickAction("partial_refund", p);
                          }}
                        />
                      )}
                      {piState === "authorized" && (
                        <QuickBtn label="Cancel hold" onClick={() => quickAction("cancel_auth")} />
                      )}
                      {piState === "captured" && !ctx.job?.funds_released_at && (
                        <QuickBtn label="Release contractor" onClick={() => quickAction("release_funds")} />
                      )}
                    </div>
                  </div>
                </>
              )}

              {caseClosed && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Case closed — view audit log for history.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {showConfirm && ctx && (
        <ConfirmModal
          resolutionType={resolutionType}
          status={statusDraft}
          resolutionNote={resolutionNote}
          pricing={ctx.pricing}
          partialPounds={partialPounds}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => executeSettlement()}
        />
      )}
    </div>
  );
}

function MediationStep({
  done,
  title,
  detail,
  action,
}: {
  done: boolean;
  title: string;
  detail: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-500"
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-slate-400" : "text-slate-100"}`}>{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1.5 text-xs font-semibold text-brand-300 hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
    </li>
  );
}

function PartyCard({
  icon: Icon,
  title,
  name,
  email,
  meta,
  flags,
}: {
  icon: typeof User;
  title: string;
  name: string;
  email: string;
  meta: string;
  flags?: Array<{ flag_type: string; severity: string; notes: string | null }>;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="mt-2 font-medium text-slate-100">{name}</p>
      <p className="text-xs text-slate-400">{email}</p>
      <p className="mt-2 text-[11px] text-slate-500">{meta}</p>
      {flags && flags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {flags.map((f, i) => (
            <li
              key={i}
              className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200"
            >
              {f.severity}: {f.flag_type.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function EscrowTimeline({
  job,
}: {
  job: {
    payment_authorized_at: string | null;
    payment_captured_at: string | null;
    funds_released_at: string | null;
    escrow_release_date: string | null;
  } | null;
}) {
  if (!job) return null;
  const steps = [
    { label: "Authorized", at: job.payment_authorized_at, done: !!job.payment_authorized_at },
    { label: "Captured", at: job.payment_captured_at, done: !!job.payment_captured_at },
    { label: "Escrow window", at: job.escrow_release_date, done: !!job.escrow_release_date },
    { label: "Released", at: job.funds_released_at, done: !!job.funds_released_at },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {steps.map((s) => (
        <div
          key={s.label}
          className={`rounded-lg px-2.5 py-1.5 text-[10px] ${
            s.done ? "bg-brand-500/15 text-brand-200" : "bg-white/5 text-slate-600"
          }`}
        >
          {s.label}
          {s.at && (
            <span className="ml-1 opacity-70">
              {new Date(s.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10"
    >
      {label}
    </button>
  );
}

function ConfirmModal({
  resolutionType,
  status,
  resolutionNote,
  pricing,
  partialPounds,
  onCancel,
  onConfirm,
}: {
  resolutionType: ResolutionType;
  status: string;
  resolutionNote: string;
  pricing: DisputeContext["pricing"];
  partialPounds: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const outcome = RESOLUTION_TYPES.find((r) => r.value === resolutionType);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h3 className="font-semibold text-slate-100">Confirm settlement</h3>
            <p className="mt-1 text-sm text-slate-400">This may trigger Stripe actions. They cannot be undone in-app.</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>
            <span className="text-slate-500">Outcome:</span> {outcome?.label}
          </li>
          <li>
            <span className="text-slate-500">Status:</span> {status}
          </li>
          {(resolutionType === "customer_partial_refund" || resolutionType === "split_settlement") && (
            <li>
              <span className="text-slate-500">Refund:</span> £{partialPounds || "0"}
            </li>
          )}
          {resolutionType === "contractor_upheld" && (
            <li>
              <span className="text-slate-500">Contractor payout:</span>{" "}
              {formatPence(pricing.contractorSharePence)}
            </li>
          )}
        </ul>
        <p className="mt-3 rounded-lg bg-white/5 p-2 text-xs text-slate-400">{resolutionNote || "—"}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Confirm & execute
          </button>
        </div>
      </div>
    </div>
  );
}
