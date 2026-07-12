"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { useAdminStore } from "@/lib/admin-store";
import { Loader2, ArrowLeft, ShieldCheck, ShieldOff, FileText, CheckCircle2 } from "lucide-react";

type OperativeService = {
  id: string;
  service_id: string;
  contract_title: string | null;
  contract_content: string | null;
  contract_content_preview: string | null;
  default_price_pence: number | null;
  services: { name: string } | { name: string }[] | null;
};

type Personnel = {
  id: string;
  full_name: string;
  role: string;
  id_document_storage_path: string | null;
};

type Operative = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  contractor_type: "sole_trader" | "business";
  company_name: string | null;
  specialisations: string[] | null;
  service_areas: string[] | null;
  is_active: boolean;
  is_verified: boolean;
  submitted_for_review_at: string | null;
  rejected_at: string | null;
  rejection_message: string | null;
  verified_at: string | null;
  trading_name: string | null;
  registered_address: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  company_number: string | null;
  vat_number: string | null;
  utr_number: string | null;
  id_document_storage_path: string | null;
};

function mask(s: string | null) {
  const v = (s || "").trim();
  if (!v) return "—";
  if (v.length < 4) return "••••";
  return `••••${v.slice(-4)}`;
}

function formatGbp(pence: number | null | undefined) {
  if (pence == null || pence <= 0) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

async function openDocument(path: string) {
  const res = await fetch("/api/contractors/document-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
  if (!res.ok || !json.signedUrl) {
    alert(json.error || "Could not open document");
    return;
  }
  window.open(json.signedUrl, "_blank", "noopener,noreferrer");
}

export default function ContractorReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const toast = useAdminNotifications((s) => s.push);
  const updateContractor = useAdminStore((s) => s.updateContractor);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"approve" | "reject" | null>(null);
  const [completed, setCompleted] = useState<"approve" | "reject" | null>(null);
  const [op, setOp] = useState<Operative | null>(null);
  const [services, setServices] = useState<OperativeService[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [rejectText, setRejectText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setError(null);
      const supabase = createClient();
      const [{ data: opRow, error: opErr }, { data: svcRows, error: svcErr }, { data: persRows, error: persErr }] =
        await Promise.all([
        supabase.from("operatives").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("operative_services")
          .select("id, service_id, contract_title, contract_content, contract_content_preview, default_price_pence, services(name)")
          .eq("operative_id", id),
        supabase.from("operative_personnel").select("id, full_name, role, id_document_storage_path").eq("operative_id", id),
      ]);
      if (opErr || svcErr || persErr || !opRow) {
        setError(opErr?.message || svcErr?.message || persErr?.message || "Contractor not found");
        setLoading(false);
        return;
      }
      setOp(opRow as Operative);
      setServices((svcRows as OperativeService[]) || []);
      setPersonnel((persRows as Personnel[]) || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const statusLabel = useMemo(() => {
    if (!op) return "";
    if (op.is_verified) return "Verified";
    if (op.rejected_at) return "Declined";
    if (op.submitted_for_review_at) return "Awaiting review";
    return "Draft";
  }, [op]);

  useEffect(() => {
    if (!completed) return;
    const t = window.setTimeout(() => router.push("/contractors"), 1400);
    return () => window.clearTimeout(t);
  }, [completed, router]);

  const run = async (action: "approve" | "reject") => {
    if (!op) return;
    if (action === "reject" && !rejectText.trim()) {
      setError("Add a decline reason so the contractor knows what to fix.");
      return;
    }
    setError(null);
    setSaving(action);
    const res = await fetch("/api/contractors/verification", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operativeId: op.id,
        action,
        message: action === "reject" ? rejectText.trim() : undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      operative?: Operative;
      emailWarning?: string;
      dbWarning?: string;
    };

    if (!res.ok) {
      setSaving(null);
      setError(json.error || "Could not save review");
      return;
    }

    const updated = json.operative ?? {
      ...op,
      is_verified: action === "approve",
      verified_at: action === "approve" ? new Date().toISOString() : null,
      submitted_for_review_at: action === "approve" ? null : op.submitted_for_review_at,
      rejected_at: action === "reject" ? new Date().toISOString() : null,
      rejection_message: action === "reject" ? rejectText.trim() : null,
    };

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
            ? `${op.full_name} is verified. Approval email sent.`
            : `Email sent to ${op.email}.`,
      });
    }

    setNotice(json.dbWarning ?? null);
    setOp(updated);
    updateContractor(op.id, {
      is_verified: updated.is_verified,
      verified_at: updated.verified_at,
      submitted_for_review_at: updated.submitted_for_review_at,
      rejected_at: updated.rejected_at,
      rejection_message: updated.rejection_message,
    });
    if (action === "reject") setRejectText("");
    setCompleted(action);
    setSaving(null);
  };

  const busy = saving !== null || completed !== null;

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error || "Contractor not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {notice}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/contractors" className="inline-flex items-center gap-1 text-sm text-brand-400 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to contractors
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{op.full_name}</h1>
          <p className="mt-1 text-sm text-slate-400">{op.email}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">{statusLabel}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          <p><span className="text-slate-500">Phone:</span> {op.phone || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">Type:</span> {op.contractor_type === "business" ? "Business" : "Sole Trader"}</p>
          <p className="mt-1"><span className="text-slate-500">Company:</span> {op.company_name || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">Trading name:</span> {op.trading_name || "—"}</p>
          <p className="mt-1 whitespace-pre-wrap"><span className="text-slate-500">Address:</span> {op.registered_address || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">Areas:</span> {op.service_areas?.join(", ") || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">Specialisms:</span> {op.specialisations?.join(", ") || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">Submitted:</span> {op.submitted_for_review_at ? new Date(op.submitted_for_review_at).toLocaleString("en-GB") : "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          <p><span className="text-slate-500">Bank name:</span> {op.bank_account_name || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">Sort code:</span> {mask(op.bank_sort_code)}</p>
          <p className="mt-1"><span className="text-slate-500">Account:</span> {mask(op.bank_account_number)}</p>
          <p className="mt-1"><span className="text-slate-500">Company no:</span> {op.company_number || "—"}</p>
          <p className="mt-1"><span className="text-slate-500">VAT:</span> {op.vat_number || "—"}</p>
          {op.rejection_message && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-200">
              <span className="font-medium text-red-300">Previous decline:</span> {op.rejection_message}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-slate-200">Verification documents</p>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          {op.contractor_type === "sole_trader" ? (
            op.id_document_storage_path ? (
              <button
                type="button"
                onClick={() => openDocument(op.id_document_storage_path!)}
                className="text-brand-400 hover:underline"
              >
                View sole trader photo ID
              </button>
            ) : (
              <p className="text-slate-500">No ID document uploaded.</p>
            )
          ) : personnel.length === 0 ? (
            <p className="text-slate-500">No key personnel listed.</p>
          ) : (
            <ul className="space-y-2">
              {personnel.map((p) => (
                <li key={p.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="font-medium text-slate-100">{p.full_name}</p>
                  <p className="text-xs text-slate-500">{p.role}</p>
                  {p.id_document_storage_path ? (
                    <button
                      type="button"
                      onClick={() => openDocument(p.id_document_storage_path!)}
                      className="mt-1 text-xs text-brand-400 hover:underline"
                    >
                      View ID document
                    </button>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">No ID uploaded</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-slate-200">Services & contracts</p>
        <div className="mt-3 space-y-3">
          {services.length === 0 && <p className="text-sm text-slate-500">No services linked.</p>}
          {services.map((s) => {
            const svc = Array.isArray(s.services) ? s.services[0] : s.services;
            return (
              <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="font-medium text-slate-100">{svc?.name || s.service_id}</p>
                <p className="mt-1 text-xs text-emerald-300/90">
                  Default price per job: {formatGbp(s.default_price_pence)} (ex VAT)
                </p>
                <p className="mt-1 text-xs text-slate-500">{s.contract_title || "Untitled contract"}</p>
                {s.contract_content_preview && <p className="mt-2 text-xs text-slate-400">{s.contract_content_preview}</p>}
                {s.contract_content && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-brand-400">Show full contract text</summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-400">{s.contract_content}</p>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {completed ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2
              className={`h-12 w-12 ${completed === "approve" ? "text-emerald-400" : "text-amber-400"}`}
            />
            <p className="mt-4 text-lg font-semibold text-white">
              {completed === "approve" ? "Contractor approved" : "Application declined"}
            </p>
            <p className="mt-2 text-sm text-slate-400">Returning to contractors…</p>
            <Loader2 className="mt-4 h-5 w-5 animate-spin text-brand-400" />
          </div>
        ) : (
          <>
        <p className="text-sm font-semibold text-slate-200">Review decision</p>
        <textarea
          value={rejectText}
          onChange={(e) => setRejectText(e.target.value)}
          rows={5}
          disabled={busy}
          placeholder="If declining, explain what they need to fix…"
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500 disabled:opacity-50"
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => run("reject")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-50"
          >
            {saving === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            Decline
          </button>
          <button
            type="button"
            onClick={() => run("approve")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {saving === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => router.push("/contractors")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Done
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
