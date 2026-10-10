"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Scale, Plus, Unlock, Info, Shield, Snowflake } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import AdminToggle from "@/components/ui/AdminToggle";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import SubjectSearchPicker, {
  type SelectedSubject,
  type SubjectKind,
} from "@/components/admin/SubjectSearchPicker";

type Hold = {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  notes: string | null;
  placed_at: string;
  released_at: string | null;
  release_notes: string | null;
  subject_label?: string | null;
  subject_detail?: string | null;
};

const REASONS = [
  { value: "fraud", label: "Fraud investigation" },
  { value: "safety", label: "Safety incident" },
  { value: "legal_claim", label: "Legal claim / litigation" },
  { value: "regulatory", label: "Regulatory request" },
  { value: "dispute", label: "Active dispute" },
  { value: "other", label: "Other (document in notes)" },
];

const SUBJECT_TYPES: { value: string; label: string; kind: SubjectKind }[] = [
  { value: "user", label: "Customer", kind: "customer" },
  { value: "operative", label: "Contractor", kind: "contractor" },
  { value: "job", label: "Job", kind: "job" },
];

function subjectKindForType(subjectType: string): SubjectKind {
  if (subjectType === "operative") return "contractor";
  if (subjectType === "job") return "job";
  return "customer";
}

export default function LegalHoldsPage() {
  const { hasPermission } = useAdminStaff();
  const canManage = hasPermission("legal_holds.manage");

  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeReleased, setIncludeReleased] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [subjectType, setSubjectType] = useState("user");
  const [selected, setSelected] = useState<SelectedSubject | null>(null);
  const [reason, setReason] = useState("fraud");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/legal-holds?includeReleased=${includeReleased ? "1" : "0"}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to load holds");
      setHolds([]);
    } else {
      setHolds(data.holds || []);
    }
    setLoading(false);
  }, [includeReleased]);

  useEffect(() => {
    void load();
  }, [load]);

  const placeHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !selected) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/legal-holds", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectType,
        subjectId: selected.id,
        reason,
        notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not place hold");
      return;
    }
    setSelected(null);
    setNotes("");
    await load();
  };

  const releaseHold = async (holdId: string) => {
    const releaseNotes = window.prompt("Release notes (optional)") ?? "";
    setBusy(true);
    const res = await fetch("/api/legal-holds", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId, releaseNotes }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not release hold");
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Scale className="h-6 w-6 text-brand-400" />
          Legal holds
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Freeze deletion and document purge while you investigate. This does not lock the person out of
          the app — use{" "}
          <Link href="/enforcement" className="text-brand-400 hover:underline">
            Enforcement
          </Link>{" "}
          for bans.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-sky-200">
            <Snowflake className="h-4 w-4" />
            How a legal hold works
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
            <li>
              It does <strong className="text-white">not copy or export</strong> data. It{" "}
              <strong className="text-white">keeps what you already have</strong> from being erased.
            </li>
            <li>
              Blocks customer account-deletion requests and the daily purge/anonymisation cron while the
              hold is active.
            </li>
            <li>
              Blocks scheduled purge of contractor ID documents past their retention date.
            </li>
            <li>
              This is the normal litigation / GDPR investigation process (a “litigation hold”).
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Shield className="h-4 w-4" />
            vs Enforcement
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
            <li>
              <strong className="text-white">Legal hold</strong> — preserve records for fraud, safety,
              claims, or regulators. Login may still work.
            </li>
            <li>
              <strong className="text-white">Enforcement ban</strong> — lock marketplace access and
              optionally block email / phone / company identity from re-registering.
            </li>
          </ul>
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Place a hold as soon as you open an investigation — before anyone requests deletion.
          </p>
        </div>
      </div>

      {canManage && (
        <form
          onSubmit={placeHold}
          className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Place hold</h2>
            <p className="mt-1 text-xs text-slate-500">
              Search for the customer, contractor, or job by name, email, company, or address.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Subject type
              </span>
              <CustomDropdown
                className="mt-1.5"
                value={subjectType}
                onChange={setSubjectType}
                options={SUBJECT_TYPES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </span>
              <CustomDropdown className="mt-1.5" value={reason} onChange={setReason} options={REASONS} />
            </div>
          </div>

          <SubjectSearchPicker
            kind={subjectKindForType(subjectType)}
            value={selected}
            onChange={setSelected}
            disabled={busy}
          />

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Notes {reason === "other" ? "(required)" : "(recommended)"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Case reference, investigator, why records must be preserved…"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !selected || (reason === "other" && notes.trim().length < 8)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 sm:w-auto sm:min-w-[12rem]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Place legal hold
          </button>
        </form>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Active &amp; recent holds</h2>
        <AdminToggle
          checked={includeReleased}
          onChange={setIncludeReleased}
          label="Include released holds"
          description="Show historical holds that have been lifted"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : holds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Scale className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">No holds yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {holds.map((h) => (
            <li
              key={h.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                      {h.subject_type === "user"
                        ? "Customer"
                        : h.subject_type === "operative"
                          ? "Contractor"
                          : "Job"}
                    </span>
                    <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-200">
                      {h.reason.replace(/_/g, " ")}
                    </span>
                    {h.released_at ? (
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                        Released
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-medium text-white">
                    {h.subject_label || h.subject_id.slice(0, 8) + "…"}
                  </p>
                  {h.subject_detail && (
                    <p className="mt-0.5 text-xs text-slate-400">{h.subject_detail}</p>
                  )}
                  {h.notes && <p className="mt-2 text-slate-300">{h.notes}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    Placed {new Date(h.placed_at).toLocaleString("en-GB")}
                    {h.released_at
                      ? ` · Released ${new Date(h.released_at).toLocaleString("en-GB")}`
                      : ""}
                  </p>
                </div>
                {!h.released_at && canManage && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => releaseHold(h.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Release
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
