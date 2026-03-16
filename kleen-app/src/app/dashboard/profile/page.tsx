"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, Mail, Phone, Save, Loader2, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
  });

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .single();
      if (row) {
        setProfile({
          fullName: row.full_name ?? "",
          email: row.email ?? user.email ?? "",
          phone: row.phone ?? "",
        });
      } else if (user.email) {
        setProfile((p) => ({ ...p, email: user.email ?? "" }));
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.fullName || null,
        phone: profile.phone || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      console.error(error);
      return;
    }
  };

  const updateField = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your account details and preferences</p>

      <div className="mt-8 space-y-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
          <p className="mt-1 text-xs text-slate-500">Saved to your account. Email is managed via sign-in.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <div className="relative mt-1">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  className="input-field pl-10 bg-slate-50"
                  title="Change email via your account provider"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <div className="relative mt-1">
                <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Payment Methods</h2>
          <p className="mt-1 text-sm text-slate-500">Manage your saved payment methods</p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">Manage cards in Payment Methods</p>
            <Link href="/dashboard/payment-methods" className="btn-secondary mt-4 inline-flex gap-2 text-xs">
              <CreditCard className="h-4 w-4" />
              Payment Methods
            </Link>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
