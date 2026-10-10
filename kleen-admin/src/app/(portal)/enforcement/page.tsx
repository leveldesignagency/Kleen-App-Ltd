"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Flag, Loader2, ShieldAlert, Unlock, Info } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { BAN_REASON_CODES } from "@/lib/account-enforcement";
import SubjectSearchPicker, { type SelectedSubject } from "@/components/admin/SubjectSearchPicker";

type Tab = "flags" | "bans" | "appeals" | "blocklist";

type RiskFlag = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_type: string;
  severity: string;
  notes: string | null;
  created_at: string;
  subject_label?: string | null;
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
  subject_label?: string | null;
  subject_detail?: string | null;
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
  const [tab, setTab] = useState<Tab>("bans");
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [blocklist, setBlocklist] = useState<
    Array<{ id: string; block_type: string; display_hint: string | null; created_at: string }>
  >([]);

  const [banForm, setBanForm] = useState({
    subjectType: "customer" as "customer" | "contractor",
    banType: "temporary",
    reasonCode: "policy_violation",
    reason: "",
    expiresAt: "",
    blockIdentities: true,
  });
  const [selected, setSelected] = useState<SelectedSubject | null>(null);
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
    if (!selected) {
      toast({ type: "error", title: "Select an account", message: "Search and pick the customer or contractor first." });
      return;
    }
    setPlacing(true);
    const res = await fetch("/api/enforcement", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "place_ban",
        subjectType: banForm.subjectType,
        subjectId: selected.id,
        banType: banForm.banType,
        reasonCode: banForm.reasonCode,
        reason: banForm.reason,
        expiresAt: banForm.banType === "temporary" && banForm.expiresAt ? banForm.expiresAt : null,
        blockIdentities: banForm.blockIdentities,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPlacing(false);
    if (!res.ok) {
      toast({ type: "error", title: "Ban failed", message: json.error });
      return;
    }
    toast({
      type: "success",
      title: "Ban placed",
      message: `${selected.title} locked out${banForm.banType === "permanent" && banForm.blockIdentities ? "; identities blocked from re-registering" : ""}.`,
    });
    setSelected(null);
    setBanForm((f) => ({ ...f, reason: "" }));
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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert className="h-6 w-6 text-brand-400" />
          Enforcement
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Lock accounts out of the marketplace — risk flags, bans with appeals, and identity blocklist.
          For GDPR data-retention freezes, use{" "}
          <Link href="/legal-holds" className="text-brand-400 hover:underline">
            Legal holds
          </Link>{" "}
          instead.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-slate-300">
        <p className="flex items-start gap-2 font-medium text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Not the same as legal holds
        </p>
        <p className="mt-1.5 pl-6 text-xs leading-relaxed">
          Enforcement <strong className="text-white">locks users out</strong>. Legal holds only{" "}
          <strong className="text-white">pause deletion</strong> of records during investigations so evidence is
          preserved.
        </p>
      </div>

      {/* Place ban — full width industry-style account search */}
      <section className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/[0.07] to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Ban className="h-4 w-4 text-red-400" />
              Place ban
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Search by email, name, company, or address — standard support workflow. Permanent bans can also
              block those identities from creating a new account.
            </p>
          </div>
        </div>

        <form onSubmit={placeBan} className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Account type
              </span>
              <CustomDropdown
                className="mt-1.5"
                value={banForm.subjectType}
                onChange={(v) =>
                  setBanForm((f) => ({
                    ...f,
                    subjectType: v === "contractor" ? "contractor" : "customer",
                  }))
                }
                options={[
                  { value: "customer", label: "Customer" },
                  { value: "contractor", label: "Contractor" },
                ]}
              />
            </div>

            <SubjectSearchPicker
              kind={banForm.subjectType}
              value={selected}
              onChange={setSelected}
              disabled={placing}
            />
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Ban length
                </span>
                <CustomDropdown
                  className="mt-1.5"
                  value={banForm.banType}
                  onChange={(v) => setBanForm((f) => ({ ...f, banType: v }))}
                  options={[
                    { value: "temporary", label: "Temporary" },
                    { value: "permanent", label: "Permanent" },
                  ]}
                />
              </div>
              {banForm.banType === "temporary" ? (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Expires
                  </label>
                  <input
                    type="date"
                    value={banForm.expiresAt}
                    onChange={(e) => setBanForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                  />
                </div>
              ) : (
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Reason code
                  </span>
                  <CustomDropdown
                    className="mt-1.5"
                    value={banForm.reasonCode}
                    onChange={(v) => setBanForm((f) => ({ ...f, reasonCode: v }))}
                    options={BAN_REASON_CODES.map((r) => ({ value: r.value, label: r.label }))}
                  />
                </div>
              )}
            </div>

            {banForm.banType === "temporary" && (
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Reason code
                </span>
                <CustomDropdown
                  className="mt-1.5"
                  value={banForm.reasonCode}
                  onChange={(v) => setBanForm((f) => ({ ...f, reasonCode: v }))}
                  options={BAN_REASON_CODES.map((r) => ({ value: r.value, label: r.label }))}
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Reason shown to the user
              </label>
              <textarea
                value={banForm.reason}
                onChange={(e) => setBanForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                placeholder="Clear explanation they will see on the suspended screen…"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-500"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <input
                type="checkbox"
                checked={banForm.blockIdentities}
                onChange={(e) => setBanForm((f) => ({ ...f, blockIdentities: e.target.checked }))}
                className="mt-0.5"
                disabled={banForm.banType !== "permanent"}
              />
              <span>
                <span className="block text-sm text-slate-200">Block identities on permanent ban</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Email, phone, addresses, and company numbers cannot re-register. Temporary bans skip this.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={placing || !selected || !banForm.reason.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {placing ? "Placing…" : "Place ban & lock out"}
            </button>
          </div>
        </form>

        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
          <p className="flex items-center gap-1 font-semibold">
            <Flag className="h-3.5 w-3.5" /> Auto-detection
          </p>
          <p className="mt-1 text-amber-200/80">
            Customers: 2+ disputes/12mo → warning, 3+ → high, 5+ → critical. Contractors: 2+ disputes/6mo on
            assigned jobs → high.
          </p>
        </div>
      </section>

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

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_CLASS[f.severity] || SEVERITY_CLASS.warning}`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-xs text-slate-500">{f.subject_type}</span>
                    <span className="text-xs text-slate-300">
                      {f.subject_label || `${f.subject_id.slice(0, 8)}…`}
                    </span>
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
              <li key={b.id} className="rounded-xl border border-white/10 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {b.subject_label || `${b.subject_type} · ${b.subject_id.slice(0, 8)}…`}
                    </p>
                    {b.subject_detail && (
                      <p className="mt-0.5 text-xs text-slate-500">{b.subject_detail}</p>
                    )}
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
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/15"
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
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => reviewAppeal(a.id, "approved")}
                        className="rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30"
                      >
                        Approve &amp; lift ban
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewAppeal(a.id, "rejected")}
                        className="rounded-lg bg-red-600/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-600/30"
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
    </div>
  );
}
