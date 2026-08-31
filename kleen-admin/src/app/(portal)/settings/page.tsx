"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { useAdminStaff } from "@/components/admin/AdminStaffProvider";
import { roleLabel } from "@/lib/admin-permissions";
import { Settings, User, Monitor, Loader2, Shield } from "lucide-react";
import AdminMfaPanel from "@/components/security/AdminMfaPanel";
import AdminToggle from "@/components/ui/AdminToggle";

type Tab = "profile" | "display" | "security";

type SecuritySnapshot = {
  production: boolean;
  rateLimitEnabled: boolean;
  rateLimitBlockedHits: number;
  securityHeadersEnabled: boolean;
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
    tabParam === "display" || tabParam === "security" ? tabParam : "profile",
  );
  const { profile, loading, updateProfile, preferences, hasPermission } = useAdminStaff();
  const toast = useAdminNotifications((s) => s.push);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [compactTables, setCompactTables] = useState(false);
  const [alertSounds, setAlertSounds] = useState(true);
  const [showToastAlerts, setShowToastAlerts] = useState(true);
  const [savingDisplay, setSavingDisplay] = useState(false);

  const [security, setSecurity] = useState<SecuritySnapshot | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  const canDisplay = hasPermission("settings.display");
  const canSecurity = hasPermission("security.view");
  const canMfa = hasPermission("security.mfa");

  useEffect(() => {
    if (tabParam === "profile" || tabParam === "display" || tabParam === "security") {
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

  const loadSecurity = useCallback(async () => {
    if (!canSecurity) return;
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
  }, [canSecurity]);

  useEffect(() => {
    if (tab === "security" && canSecurity) void loadSecurity();
  }, [tab, canSecurity, loadSecurity]);

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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof User; show: boolean }[] = [
    { id: "profile", label: "Profile", icon: User, show: true },
    { id: "display", label: "Display", icon: Monitor, show: canDisplay },
    { id: "security", label: "Security", icon: Shield, show: canSecurity || canMfa },
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
        {tabs
          .filter((t) => t.show)
          .map(({ id, label, icon: Icon }) => (
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
            {canMfa && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <AdminMfaPanel />
              </div>
            )}
          </div>
        )}

        {tab === "display" && canDisplay && (
          <div className="space-y-3">
            <AdminToggle
              checked={compactTables}
              onChange={setCompactTables}
              label="Compact tables"
              description="Tighter row spacing on jobs, customers, contractors, and disputes lists"
            />
            <AdminToggle
              checked={alertSounds}
              onChange={setAlertSounds}
              label="Alert sounds"
              description="Play a chime for new jobs and contractor sign-ups"
            />
            <AdminToggle
              checked={showToastAlerts}
              onChange={setShowToastAlerts}
              label="Notifications"
              description="Show alerts in the bell menu and corner toasts"
            />
            <button
              type="button"
              onClick={saveDisplay}
              disabled={savingDisplay}
              className="mt-4 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {savingDisplay && <Loader2 className="h-4 w-4 animate-spin" />}
              Save display settings
            </button>
          </div>
        )}

        {tab === "security" && canSecurity && (
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
                  <p className="mt-1 text-xs text-slate-500">
                    Infrastructure snapshot — visible to security-permitted roles only.
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["Environment", security.production ? "Production" : "Non-production"],
                      ["Rate limiting", security.rateLimitEnabled ? "On" : "Off"],
                      ["Blocked requests", String(security.rateLimitBlockedHits)],
                      ["Security headers", security.securityHeadersEnabled ? "On" : "Off"],
                      ["Preview gate", security.siteAccessGateEnabled ? "On" : "Off"],
                      ["Dev auth bypass", security.devAuthBypassEnabled ? "ON — fix" : "Off"],
                      ["CRON_SECRET", security.cronSecretConfigured ? "Set" : "Missing"],
                      ["ADMIN_SECRET", security.adminSecretConfigured ? "Set" : "Missing"],
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
