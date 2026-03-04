"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import { Settings, User, Shield, Loader2 } from "lucide-react";

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useAdminNotifications((s) => s.push);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", user.id)
          .single();
        if (data) {
          setProfile({
            full_name: data.full_name || "",
            email: data.email || "",
            phone: data.phone || "",
          });
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
        })
        .eq("id", user.id);
      toast({ type: "success", title: "Settings saved" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20">
          <Settings className="h-5 w-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-slate-400">Manage your admin profile</p>
        </div>
      </div>

      <div className="mt-8 max-w-lg space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <User className="h-4 w-4" />
            Profile
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400">Full Name</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-500 outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed here</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Phone</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                placeholder="+44 7XXX XXXXXX"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Shield className="h-4 w-4" />
            Security
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Password resets and MFA configuration are managed through the Supabase dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
