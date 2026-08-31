"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Scale, Plus, Unlock, Info } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import AdminToggle from "@/components/ui/AdminToggle";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";

type Hold = {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  notes: string | null;
  placed_at: string;
  released_at: string | null;
  release_notes: string | null;
};

const REASONS = [
  { value: "fraud", label: "Fraud investigation" },
  { value: "safety", label: "Safety incident" },
  { value: "legal_claim", label: "Legal claim / litigation" },
  { value: "regulatory", label: "Regulatory request" },
  { value: "dispute", label: "Active dispute" },
  { value: "other", label: "Other (document in notes)" },
];

const SUBJECT_TYPES = [
  { value: "user", label: "Customer (profile UUID)" },
  { value: "operative", label: "Contractor (operative UUID)" },
  { value: "job", label: "Job (job UUID)" },
];

export default function LegalHoldsPage() {
  const { hasPermission } = useAdminStaff();
  const canManage = hasPermission("legal_holds.manage");

  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeReleased, setIncludeReleased] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [subjectType, setSubjectType] = useState("user");
  const [subjectId, setSubjectId] = useState("");
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
    if (!canManage) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/legal-holds", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectType, subjectId: subjectId.trim(), reason, notes }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not place hold");
      return;
    }
    setSubjectId("");
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
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Scale className="h-6 w-6 text-brand-400" />
          Legal holds
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          GDPR / data-retention tool — pauses account deletion and document purge while you investigate.
          This is <strong className="text-slate-300">not</strong> the same as Enforcement (bans and marketplace lockouts).
        </p>
      </div>

      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4 text-sm">
        <p className="flex items-start gap-2 font-medium text-brand-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Legal holds vs Enforcement
        </p>
        <ul className="mt-2 space-y-1.5 pl-6 text-xs text-slate-300">
          <li>
            <strong className="text-white">Legal holds</strong> — freeze data erasure (privacy law, litigation, regulatory).
            User may still log in unless separately banned.
          </li>
          <li>
            <strong className="text-white">Enforcement</strong> — operational sanctions: bans, appeals, identity blocklist,
            repeat-disputer flags. Blocks marketplace access immediately.
          </li>
        </ul>
      </div>

      {canManage && (
        <form
          onSubmit={placeHold}
          className="admin-card-pad rounded-2xl border border-white/10 bg-white/[0.03] space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-200">Place hold</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <span className="text-xs text-slate-400">Subject type</span>
              <CustomDropdown
                className="mt-1"
                value={subjectType}
                onChange={setSubjectType}
                options={SUBJECT_TYPES}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400">
                Subject UUID
                <input
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  placeholder="Paste profile, operative, or job id"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
            </div>
            <div>
              <span className="text-xs text-slate-400">Reason</span>
              <CustomDropdown
                className="mt-1"
                value={reason}
                onChange={setReason}
                options={REASONS}
              />
            </div>
          </div>
          <label className="block text-xs text-slate-400">
            Notes {reason === "other" ? "(required)" : "(recommended)"}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Place legal hold
          </button>
        </form>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Holds</h2>
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
        <p className="text-sm text-slate-500">No holds.</p>
      ) : (
        <ul className="space-y-3">
          {holds.map((h) => (
            <li
              key={h.id}
              className="admin-card-pad rounded-2xl border border-white/10 bg-white/[0.03] text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">
                    {h.reason.replace(/_/g, " ")} · {h.subject_type}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{h.subject_id}</p>
                  {h.notes && <p className="mt-2 text-slate-300">{h.notes}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    Placed {new Date(h.placed_at).toLocaleString("en-GB")}
                    {h.released_at
                      ? ` · Released ${new Date(h.released_at).toLocaleString("en-GB")}`
                      : " · Active"}
                  </p>
                </div>
                {!h.released_at && canManage && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => releaseHold(h.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5"
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
