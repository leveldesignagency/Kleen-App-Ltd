"use client";

import { useState } from "react";
import { User, Mail, Phone, MapPin, CreditCard, Save, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "John Doe",
    email: "john@example.com",
    phone: "07700 900000",
    address: "12 Oak Lane",
    postcode: "SW1A 1AA",
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
  };

  const updateField = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your account details and preferences</p>

      <div className="mt-8 space-y-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
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
                  onChange={(e) => updateField("email", e.target.value)}
                  className="input-field pl-10"
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
            <div>
              <label className="block text-sm font-medium text-slate-700">Postcode</label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={profile.postcode}
                  onChange={(e) => updateField("postcode", e.target.value.toUpperCase())}
                  className="input-field pl-10"
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="input-field mt-1"
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Payment Methods</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your saved payment methods
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No payment methods saved</p>
            <button className="btn-secondary mt-4 text-xs">
              Add Payment Method
            </button>
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
