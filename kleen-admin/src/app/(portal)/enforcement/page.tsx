"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Flag, Loader2, ShieldAlert, Unlock } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { BAN_REASON_CODES } from "@/lib/account-enforcement";

type Tab = "flags" | "bans" | "appeals" | "blocklist";

type RiskFlag = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_type: string;
  severity: string;
  notes: string | null;
  created_at: string;
};

type Ban = {
  id: string;
  subject_type: string;
  subject_id: string;
  ban_type: string;
  reason_code: string;
  reason: string;
  expires_at: string | null;
  appeal_allowed: boolean;
  placed_at: string;
  lifted_at: string | null;
};

type Appeal = {
  id: string;
  ban_id: string;
  message: string;
  status: string;
  created_at: string;
  review_notes: string | null;
  account_bans: Ban | Ban[] | null;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "flags", label: "Risk flags" },
  { id: "bans", label: "Bans" },
  { id: "appeals", label: "Appeals" },
  { id: "blocklist", label: "Blocklist" },
];

const SEVERITY_CLASS: Record<string, string> = {
  info: "bg-slate-500/20 text-slate-300",
  warning: "bg-amber-500/20 text-amber-300",
  high: "bg-orange-500/20 text-orange-300",
  critical: "bg-red-500/20 text-red-300",
};

export default function EnforcementPage() {
  const toast = useAdminNotifications((s) => s.push);
  const [tab, setTab] = useState<Tab>("flags");
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [blocklist, setBlocklist] = useState<
    Array<{ id: string; block_type: string; display_hint: string | null; created_at: string }>
  >([]);

  const [banForm, setBanForm] = useState({
    subjectType: "customer",
    subjectId: "",
    banType: "temporary",
    reasonCode: "policy_violation",
    reason: "",
    expiresAt: "",
    blockIdentities: true,
  });
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/enforcement?tab=${tab}`, { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (tab === "flags") setFlags(json.flags || []);
    if (tab === "bans") setBans(json.bans || []);
    if (tab === "appeals") setAppeals(json.appeals || []);
    if (tab === "blocklist") setBlocklist(json.blocklist || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const placeBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    const res = await fetch("/api/enforcement", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "place_ban",
        ...banForm,
        expiresAt: banForm.banType === "temporary" && banForm.expiresAt ? banForm.expiresAt : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPlacing(false);
    if (!res.ok) {
      toast({ type: "error", title: "Ban failed", message: json.error });
      return;
    }
    toast({ type: "success", title: "Ban placed", message: "Account locked and identities blocked if permanent." });
    setBanForm((f) => ({ ...f, subjectId: "", reason: "" }));
    setTab("bans");
    void load();
  };

  const liftBan = async (banId: string) => {
    const liftReason = window.prompt("Reason for lifting ban?") || "Lifted by admin";
    const removeBlocks = window.confirm("Also remove identity blocklist entries from this ban?");
    const res = await fetch("/api/enforcement", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "lift_ban",
        banId,
        liftReason,
        removeIdentityBlocks: removeBlocks,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast({ type: "error", title: "Failed", message: json.error });
      return;
    }
    toast({ type: "success", title: "Ban lifted" });
    void load();
  };

  const reviewAppeal = async (appealId: string, status: "approved" | "rejected") => {
    const notes = window.prompt("Review notes (optional)") || "";
    const res = await fetch("/api/enforcement", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review_appeal", appealId, appealStatus: status, reviewNotes: notes }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast({ type: "error", title: "Failed", message: json.error });
      return;
    }
    toast({ type: "success", title: status === "approved" ? "Appeal approved" : "Appeal rejected" });
    void load();
  };

  const resolveFlag = async (flagId: string) => {
    await fetch("/api/enforcement", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_flag", flagId }),
    });
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enforcement</h1>
        <p className="mt-1 text-sm text-slate-400">
          Risk detection, bans with appeals, and identity blocklist for repeat offenders.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              tab === t.id ? "bg-brand-600 text-white" : "bg-white/10 text-slate-400 hover:bg-white/15"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
            </div>
          ) : tab === "flags" ? (
            <ul className="space-y-2">
              {flags.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_CLASS[f.severity] || SEVERITY_CLASS.warning}`}>
                        {f.severity}
                      </span>
                      <span className="text-xs text-slate-500">{f.subject_type}</span>
                      <span className="font-mono text-xs text-slate-400">{f.subject_id.slice(0, 8)}…</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-200">{f.flag_type.replace(/_/g, " ")}</p>
                    {f.notes && <p className="mt-1 text-xs text-slate-500">{f.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => resolveFlag(f.id)}
                    className="shrink-0 text-xs text-brand-400 hover:underline"
                  >
                    Resolve
                  </button>
                </li>
              ))}
              {flags.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No open risk flags.</p>}
            </ul>
          ) : tab === "bans" ? (
            <ul className="space-y-2">
              {bans.map((b) => (
                <li key={b.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {b.subject_type} · <span className="font-mono text-xs">{b.subject_id.slice(0, 8)}…</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{b.reason}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {b.ban_type} · {new Date(b.placed_at).toLocaleString("en-GB")}
                        {b.expires_at && ` · until ${new Date(b.expires_at).toLocaleDateString("en-GB")}`}
                      </p>
                    </div>
                    {!b.lifted_at && (
                      <button
                        type="button"
                        onClick={() => liftBan(b.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                      >
                        <Unlock className="h-3 w-3" /> Lift
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {bans.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No active bans.</p>}
            </ul>
          ) : tab === "appeals" ? (
            <ul className="space-y-3">
              {appeals.map((a) => {
                const ban = Array.isArray(a.account_bans) ? a.account_bans[0] : a.account_bans;
                return (
                  <li key={a.id} className="rounded-xl border border-white/10 p-4">
                    <p className="text-xs text-slate-500">
                      {a.status} · {new Date(a.created_at).toLocaleString("en-GB")}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">{a.message}</p>
                    {ban && <p className="mt-1 text-xs text-slate-500">Ban: {ban.reason}</p>}
                    {a.status === "pending" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => reviewAppeal(a.id, "approved")}
                          className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30"
                        >
                          Approve & lift ban
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewAppeal(a.id, "rejected")}
                          className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-600/30"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {appeals.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No appeals.</p>}
            </ul>
          ) : (
            <ul className="space-y-2 font-mono text-xs">
              {blocklist.map((b) => (
                <li key={b.id} className="rounded-lg border border-white/10 px-3 py-2 text-slate-400">
                  <span className="text-brand-400">{b.block_type}</span> · {b.display_hint || "—"}
                </li>
              ))}
              {blocklist.length === 0 && (
                <p className="py-8 text-center font-sans text-sm text-slate-500">Blocklist empty.</p>
              )}
            </ul>
          )}
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Ban className="h-4 w-4 text-red-400" />
            Place ban
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Permanent bans block email, phone, addresses & company IDs from re-registering.
          </p>
          <form onSubmit={placeBan} className="mt-4 space-y-3">
            <CustomDropdown
              value={banForm.subjectType}
              onChange={(v) => setBanForm((f) => ({ ...f, subjectType: v }))}
              options={[
                { value: "customer", label: "Customer (profile UUID)" },
                { value: "contractor", label: "Contractor (operative UUID)" },
              ]}
            />
            <input
              value={banForm.subjectId}
              onChange={(e) => setBanForm((f) => ({ ...f, subjectId: e.target.value }))}
              placeholder="Subject UUID"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
            <CustomDropdown
              value={banForm.banType}
              onChange={(v) => setBanForm((f) => ({ ...f, banType: v }))}
              options={[
                { value: "temporary", label: "Temporary" },
                { value: "permanent", label: "Permanent" },
              ]}
            />
            {banForm.banType === "temporary" && (
              <input
                type="date"
                value={banForm.expiresAt}
                onChange={(e) => setBanForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            )}
            <CustomDropdown
              value={banForm.reasonCode}
              onChange={(v) => setBanForm((f) => ({ ...f, reasonCode: v }))}
              options={BAN_REASON_CODES.map((r) => ({ value: r.value, label: r.label }))}
            />
            <textarea
              value={banForm.reason}
              onChange={(e) => setBanForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Reason shown to the user…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={banForm.blockIdentities}
                onChange={(e) => setBanForm((f) => ({ ...f, blockIdentities: e.target.checked }))}
              />
              Block identities on permanent ban
            </label>
            <button
              type="submit"
              disabled={placing || !banForm.subjectId || !banForm.reason.trim()}
              className="w-full rounded-xl bg-red-600/80 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {placing ? "Placing…" : "Place ban & lock out"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
            <p className="flex items-center gap-1 font-semibold">
              <Flag className="h-3.5 w-3.5" /> Auto-detection
            </p>
            <p className="mt-1 text-amber-200/80">
              Customers: 2+ disputes/12mo → warning, 3+ → high, 5+ → critical. Contractors: 2+ disputes/6mo on
              assigned jobs → high.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
