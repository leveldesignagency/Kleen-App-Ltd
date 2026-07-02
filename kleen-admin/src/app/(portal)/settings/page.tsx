"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { useAdminStaff, roleLabel } from "@/components/admin/AdminStaffProvider";
import { Settings, User, Monitor, Users, Loader2, Shield, Trash2 } from "lucide-react";
import type { AdminStaffRole } from "@/lib/admin-staff";

type Tab = "profile" | "display" | "team" | "security";

type SecuritySnapshot = {
  production: boolean;
  service: string;
  securityHeadersEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitBlockedHits: number;
  siteAccessGateEnabled: boolean;
  devAuthBypassEnabled: boolean;
  headerEmailBypassEnabled: boolean;
  cronSecretConfigured: boolean;
  adminSecretConfigured: boolean;
  shareLinkSecretConfigured: boolean;
  authProvider: string;
  notes: string[];
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    tabParam === "display" || tabParam === "team" || tabParam === "security" ? tabParam : "profile",
  );
  const { profile, loading, updateProfile, isSuperadmin, preferences } = useAdminStaff();
  const toast = useAdminNotifications((s) => s.push);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [compactTables, setCompactTables] = useState(false);
  const [alertSounds, setAlertSounds] = useState(true);
  const [showToastAlerts, setShowToastAlerts] = useState(true);
  const [savingDisplay, setSavingDisplay] = useState(false);

  const [teamStaff, setTeamStaff] = useState<
    { id: string; email: string; full_name: string | null; admin_role: string | null }[]
  >([]);
  const [allowlist, setAllowlist] = useState<{ email: string; admin_role: string }[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AdminStaffRole>("staff");
  const [addingTeam, setAddingTeam] = useState(false);
  const [security, setSecurity] = useState<SecuritySnapshot | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  useEffect(() => {
    if (tabParam === "profile" || tabParam === "display" || tabParam === "team" || tabParam === "security") {
      setTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setCompactTables(preferences.compactTables);
    setAlertSounds(preferences.alertSounds);
    setShowToastAlerts(preferences.showToastAlerts);
  }, [profile, preferences]);

  const loadTeam = useCallback(async () => {
    if (!isSuperadmin) return;
    setTeamLoading(true);
    try {
      const res = await fetch("/api/admin/team", { credentials: "include" });
      if (res.ok) {
        const json = (await res.json()) as {
          staff: typeof teamStaff;
          allowlist: typeof allowlist;
        };
        setTeamStaff(json.staff || []);
        setAllowlist(json.allowlist || []);
      }
    } finally {
      setTeamLoading(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    if (tab === "team" && isSuperadmin) void loadTeam();
  }, [tab, isSuperadmin, loadTeam]);

  const loadSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const res = await fetch("/api/admin/security", { credentials: "include" });
      if (res.ok) {
        const json = (await res.json()) as { security: SecuritySnapshot };
        setSecurity(json.security);
      }
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "security") void loadSecurity();
  }, [tab, loadSecurity]);

  const saveProfile = async () => {
    setSaving(true);
    const ok = await updateProfile({ full_name: fullName, phone });
    setSaving(false);
    toast(ok ? { type: "success", title: "Profile saved" } : { type: "error", title: "Could not save profile" });
  };

  const saveDisplay = async () => {
    setSavingDisplay(true);
    const ok = await updateProfile({
      admin_preferences: { compactTables, alertSounds, showToastAlerts },
    });
    setSavingDisplay(false);
    toast(ok ? { type: "success", title: "Display settings saved" } : { type: "error", title: "Could not save" });
  };

  const addTeamMember = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAddingTeam(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, admin_role: newRole }),
    });
    setAddingTeam(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ type: "error", title: json.error || "Could not add staff" });
      return;
    }
    toast({ type: "success", title: "Staff email added", message: "They can sign in once their Supabase Auth account exists." });
    setNewEmail("");
    void loadTeam();
  };

  const removeAllowlist = async (email: string) => {
    const res = await fetch(`/api/admin/team?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ type: "error", title: json.error || "Could not remove" });
      return;
    }
    toast({ type: "success", title: "Removed from allowlist" });
    void loadTeam();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof User; superOnly?: boolean }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "display", label: "Display", icon: Monitor },
    { id: "security", label: "Security", icon: Shield },
    ...(isSuperadmin ? [{ id: "team" as Tab, label: "Team", icon: Users, superOnly: true }] : []),
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20">
          <Settings className="h-5 w-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-slate-400">
            {profile?.full_name || profile?.email} · {roleLabel(profile?.admin_role)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-white/10">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === id
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8 max-w-2xl">
        {tab === "profile" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Email</label>
                <input
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                  placeholder="+44 7XXX XXXXXX"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="mt-6 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save profile
            </button>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Shield className="h-4 w-4" />
                Security
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Password and MFA are managed in Supabase Auth. Use a unique staff login — not a shared inbox password.
              </p>
            </div>
          </div>
        )}

        {tab === "display" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Compact tables</p>
                <p className="text-xs text-slate-500">Tighter row spacing on list pages</p>
              </div>
              <input
                type="checkbox"
                checked={compactTables}
                onChange={(e) => setCompactTables(e.target.checked)}
                className="h-4 w-4 rounded border-white/20"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Alert sounds</p>
                <p className="text-xs text-slate-500">Play a chime for new jobs and contractor sign-ups</p>
              </div>
              <input
                type="checkbox"
                checked={alertSounds}
                onChange={(e) => setAlertSounds(e.target.checked)}
                className="h-4 w-4 rounded border-white/20"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Toast notifications</p>
                <p className="text-xs text-slate-500">Show pop-up alerts in the corner</p>
              </div>
              <input
                type="checkbox"
                checked={showToastAlerts}
                onChange={(e) => setShowToastAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-white/20"
              />
            </label>
            <button
              type="button"
              onClick={saveDisplay}
              disabled={savingDisplay}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {savingDisplay && <Loader2 className="h-4 w-4 animate-spin" />}
              Save display settings
            </button>
          </div>
        )}

        {tab === "team" && isSuperadmin && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100/90">
              <p className="font-semibold text-amber-200">Safer staff access</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                Create a dedicated login per employee (e.g. <code className="text-amber-200">charles@kleenapp.co.uk</code>
                ), not a shared inbox. Add their email here, then create their user in Supabase Auth (or invite them).
                Only <strong>superadmin</strong> can manage the team. Keep <code className="text-amber-200">info@</code> as
                superadmin or migrate to a random admin email you control.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white">Add staff email</h2>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="employee@kleenapp.co.uk"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminStaffRole)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  <option value="staff">Staff</option>
                  <option value="superadmin">Superadmin</option>
                </select>
                <button
                  type="button"
                  onClick={addTeamMember}
                  disabled={addingTeam || !newEmail.trim()}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {addingTeam ? "Adding…" : "Add"}
                </button>
              </div>
            </div>

            {teamLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <h2 className="text-sm font-semibold text-white">Active admin accounts</h2>
                  <ul className="mt-3 divide-y divide-white/5">
                    {teamStaff.map((s) => (
                      <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                        <div>
                          <p className="font-medium text-white">{s.full_name || s.email}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-400">
                          {roleLabel(s.admin_role as AdminStaffRole)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <h2 className="text-sm font-semibold text-white">Email allowlist</h2>
                  <p className="mt-1 text-xs text-slate-500">New Supabase Auth sign-ups with these emails become admin.</p>
                  <ul className="mt-3 divide-y divide-white/5">
                    {allowlist.map((a) => (
                      <li key={a.email} className="flex items-center justify-between py-3 text-sm">
                        <div>
                          <p className="text-white">{a.email}</p>
                          <p className="text-xs text-slate-500">{roleLabel(a.admin_role as AdminStaffRole)}</p>
                        </div>
                        {a.email.toLowerCase() !== "info@kleenapp.co.uk" && (
                          <button
                            type="button"
                            onClick={() => removeAllowlist(a.email)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "security" && (
          <div className="space-y-4">
            {securityLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
              </div>
            ) : security ? (
              <>
                {security.notes.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                    <p className="font-semibold text-amber-200">Warnings</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {security.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <h2 className="text-sm font-semibold text-white">Security posture</h2>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["Environment", security.production ? "Production" : "Non-production"],
                      ["Rate limiting", security.rateLimitEnabled ? "On" : "Off"],
                      ["Blocked requests", String(security.rateLimitBlockedHits)],
                      ["Security headers", security.securityHeadersEnabled ? "On" : "Off"],
                      ["Preview gate (customer app)", security.siteAccessGateEnabled ? "On" : "Off"],
                      ["Dev auth bypass", security.devAuthBypassEnabled ? "ON — fix" : "Off"],
                      ["Header email bypass", security.headerEmailBypassEnabled ? "ON — fix" : "Off"],
                      ["CRON_SECRET", security.cronSecretConfigured ? "Set" : "Missing"],
                      ["ADMIN_SECRET", security.adminSecretConfigured ? "Set" : "Missing"],
                      ["SHARE_LINK_SECRET", security.shareLinkSecretConfigured ? "Set" : "Not set"],
                      ["Auth", security.authProvider],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="font-medium text-white">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    type="button"
                    onClick={() => void loadSecurity()}
                    className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                  >
                    Refresh
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Could not load security snapshot.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
