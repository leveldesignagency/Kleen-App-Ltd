"use client";

import { useEffect, useState } from "react";
import type { Contractor } from "@/lib/admin-store";
import type { AdminToast } from "@/lib/admin-notifications";
import {
  X,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Building2,
  UserRound,
  MapPin,
  Landmark,
  FileText,
  CheckCircle2,
} from "lucide-react";

type Props = {
  contractor: Contractor;
  onClose: () => void;
  onUpdated: (c: Contractor) => void;
  toast: (t: Omit<AdminToast, "id">) => void;
};

function maskBank(s: string) {
  if (!s || s.length < 4) return s ? "••••" : "—";
  return "••••" + s.slice(-4);
}

export default function ReviewContractorModal({ contractor, onClose, onUpdated, toast }: Props) {
  const [rejectText, setRejectText] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [completed, setCompleted] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    if (!completed) return;
    const t = window.setTimeout(() => onClose(), 1400);
    return () => window.clearTimeout(t);
  }, [completed, onClose]);

  const run = async (action: "approve" | "reject") => {
    if (action === "reject" && !rejectText.trim()) {
      toast({
        type: "error",
        title: "Message required",
        message: "Explain what the contractor must fix — this is emailed to them.",
      });
      return;
    }
    setSubmitting(action);
    const res = await fetch("/api/contractors/verification", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operativeId: contractor.id,
        action,
        message: action === "reject" ? rejectText.trim() : undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      operative?: Record<string, unknown>;
      emailWarning?: string;
      dbWarning?: string;
    };

    if (!res.ok) {
      setSubmitting(null);
      toast({
        type: "error",
        title: action === "approve" ? "Approve failed" : "Decline failed",
        message: json.error || res.statusText,
      });
      return;
    }

    const o = json.operative;
    const updated: Contractor = {
      ...contractor,
      is_verified: o ? Boolean(o.is_verified) : action === "approve",
      verified_at: o?.verified_at ? String(o.verified_at) : action === "approve" ? new Date().toISOString() : null,
      submitted_for_review_at: o?.submitted_for_review_at
        ? String(o.submitted_for_review_at)
        : action === "approve"
          ? null
          : contractor.submitted_for_review_at,
      rejected_at: o?.rejected_at ? String(o.rejected_at) : action === "reject" ? new Date().toISOString() : null,
      rejection_message: o?.rejection_message ? String(o.rejection_message) : action === "reject" ? rejectText.trim() : null,
    };
    onUpdated(updated);

    if (json.dbWarning) {
      toast({ type: "info", title: "Database", message: json.dbWarning });
    }
    if (json.emailWarning) {
      toast({ type: "info", title: "Saved", message: json.emailWarning });
    } else {
      toast({
        type: "success",
        title: action === "approve" ? "Approved" : "Declined",
        message:
          action === "approve"
            ? `${contractor.full_name} is verified. Approval email sent.`
            : `Email sent to ${contractor.email}.`,
      });
    }

    setCompleted(action);
    setSubmitting(null);
  };

  const busy = submitting !== null || completed !== null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {completed ? (
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <CheckCircle2
              className={`h-14 w-14 ${completed === "approve" ? "text-emerald-400" : "text-amber-400"}`}
            />
            <h2 className="mt-4 text-xl font-bold text-white">
              {completed === "approve" ? "Contractor approved" : "Application declined"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {completed === "approve"
                ? `${contractor.full_name} has been verified. Returning to contractors…`
                : `Email sent to ${contractor.email}. Returning to contractors…`}
            </p>
            <Loader2 className="mt-6 h-5 w-5 animate-spin text-brand-400" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Review contractor</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Approve to unlock jobs &amp; payouts, or decline with a clear email to the applicant.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-center gap-2 text-white">
                  {contractor.contractor_type === "business" ? (
                    <Building2 className="h-4 w-4 text-indigo-400" />
                  ) : (
                    <UserRound className="h-4 w-4 text-teal-400" />
                  )}
                  <span className="font-semibold">{contractor.full_name}</span>
                </div>
                <p>
                  <span className="text-slate-500">Email</span>{" "}
                  <a href={`mailto:${contractor.email}`} className="text-brand-400 hover:underline">
                    {contractor.email}
                  </a>
                </p>
                {contractor.company_name && (
                  <p>
                    <span className="text-slate-500">Company</span> {contractor.company_name}
                  </p>
                )}
                {(contractor.trading_name || contractor.registered_address) && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <MapPin className="h-3.5 w-3.5" /> UK business
                    </p>
                    {contractor.trading_name && <p className="mt-2">Trading as: {contractor.trading_name}</p>}
                    {contractor.registered_address && (
                      <p className="mt-1 whitespace-pre-wrap text-slate-400">{contractor.registered_address}</p>
                    )}
                  </div>
                )}
                <p>
                  <span className="text-slate-500">Phone</span> {contractor.phone || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Areas</span>{" "}
                  {contractor.service_areas?.length ? contractor.service_areas.join(", ") : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Specialisms</span>{" "}
                  {contractor.specialisations?.length ? contractor.specialisations.join(", ") : "—"}
                </p>
                <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <Landmark className="h-4 w-4 shrink-0 text-slate-500" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Bank (on file)</p>
                    <p className="mt-1 font-mono text-xs">
                      {contractor.bank_account_name || "—"} · sort {maskBank(contractor.bank_sort_code || "")} · acct{" "}
                      {maskBank(contractor.bank_account_number || "")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>
                    <span className="text-slate-500">Company no.</span> {contractor.company_number || "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">VAT</span> {contractor.vat_number || "—"}
                  </p>
                </div>
                {contractor.notes && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <FileText className="h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <p className="text-xs font-medium text-amber-500/80">Their notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-400">{contractor.notes}</p>
                    </div>
                  </div>
                )}
                {contractor.rejection_message && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    <p className="font-medium text-red-300">Previous decline message</p>
                    <p className="mt-1 whitespace-pre-wrap">{contractor.rejection_message}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label className="block text-xs font-medium text-slate-400">
                  If declining — detail what to fix (emailed to contractor)
                </label>
                <textarea
                  value={rejectText}
                  onChange={(e) => setRejectText(e.target.value)}
                  rows={6}
                  disabled={busy}
                  placeholder="Example: Company number could not be verified on Companies House; please add a valid UK VAT number or confirm sole trader status…"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-brand-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run("reject")}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-50"
              >
                {submitting === "reject" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                Decline &amp; email
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run("approve")}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {submitting === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Approve
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
