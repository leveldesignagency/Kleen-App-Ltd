"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, ShieldCheck, ShieldOff, FileText } from "lucide-react";

type OperativeService = {
  id: string;
  service_id: string;
  contract_title: string | null;
  contract_content: string | null;
  contract_content_preview: string | null;
  services: { name: string } | { name: string }[] | null;
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
};

function mask(s: string | null) {
  const v = (s || "").trim();
  if (!v) return "—";
  if (v.length < 4) return "••••";
  return `••••${v.slice(-4)}`;
}

export default function ContractorReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"approve" | "reject" | null>(null);
  const [op, setOp] = useState<Operative | null>(null);
  const [services, setServices] = useState<OperativeService[]>([]);
  const [rejectText, setRejectText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setError(null);
      const supabase = createClient();
      const [{ data: opRow, error: opErr }, { data: svcRows, error: svcErr }] = await Promise.all([
        supabase.from("operatives").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("operative_services")
          .select("id, service_id, contract_title, contract_content, contract_content_preview, services(name)")
          .eq("operative_id", id),
      ]);
      if (opErr || svcErr || !opRow) {
        setError(opErr?.message || svcErr?.message || "Contractor not found");
        setLoading(false);
        return;
      }
      setOp(opRow as Operative);
      setServices((svcRows as OperativeService[]) || []);
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
      error?: string;
      operative?: Operative;
      dbWarning?: string;
    };
    setSaving(null);
    if (!res.ok || !json.operative) {
      setError(json.error || "Could not save review");
      return;
    }
    setNotice(json.dbWarning ?? null);
    setOp(json.operative);
    if (action === "reject") setRejectText("");
  };

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
          <p className="mt-1"><span className="text-slate-500">UTR:</span> {op.utr_number || "—"}</p>
          {op.rejection_message && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-200">
              <span className="font-medium text-red-300">Previous decline:</span> {op.rejection_message}
            </p>
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
        <p className="text-sm font-semibold text-slate-200">Review decision</p>
        <textarea
          value={rejectText}
          onChange={(e) => setRejectText(e.target.value)}
          rows={5}
          placeholder="If declining, explain what they need to fix…"
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => run("reject")}
            disabled={saving !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-50"
          >
            {saving === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            Decline
          </button>
          <button
            type="button"
            onClick={() => run("approve")}
            disabled={saving !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {saving === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => router.push("/contractors")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
          >
            <FileText className="h-4 w-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
