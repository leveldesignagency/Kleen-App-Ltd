"use client";

import { useState } from "react";
import { User, Building2, Check, Shield, Globe, Receipt, Users } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile";
import CustomDropdown from "@/components/ui/CustomDropdown";

type AccountType = "personal" | "business";

interface PersonalProfile {
  fullName: string;
  email: string;
  phone: string;
}

interface BusinessProfile {
  companyName: string;
  companyNumber: string;
  vatNumber: string;
  billingEmail: string;
  industry: string;
  employeeCount: string;
  website: string;
}

/* TODO: replace with Supabase query */
const INITIAL_PERSONAL: PersonalProfile = {
  fullName: "",
  email: "",
  phone: "",
};

const INITIAL_BUSINESS: BusinessProfile = {
  companyName: "",
  companyNumber: "",
  vatNumber: "",
  billingEmail: "",
  industry: "",
  employeeCount: "",
  website: "",
};

const EMPLOYEE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];
const INDUSTRY_OPTIONS = [
  "Hospitality",
  "Retail",
  "Offices & Co-working",
  "Healthcare",
  "Education",
  "Property Management",
  "Construction",
  "Other",
];

export default function AccountPage() {
  const { accountType, setAccountType, fullName, email, phone, setProfile } = useUserProfile();
  const [personal, setPersonal] = useState<PersonalProfile>({
    fullName: fullName || "",
    email: email || "",
    phone: phone || "",
  });
  const [business, setBusiness] = useState(INITIAL_BUSINESS);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setProfile({ fullName: personal.fullName, email: personal.email, phone: personal.phone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your profile and account type</p>

      {/* Account type toggle */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Account Type</h2>
        <p className="mt-1 text-xs text-slate-400">
          Business accounts unlock invoicing, VAT receipts, and commercial rates
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([
            { type: "personal" as AccountType, label: "Personal", desc: "For home & personal use", icon: User },
            { type: "business" as AccountType, label: "Business", desc: "For companies & commercial use", icon: Building2 },
          ]).map(({ type, label, desc, icon: Icon }) => {
            const active = accountType === type;
            return (
              <button
                key={type}
                onClick={() => setAccountType(type)}
                className={`relative flex flex-col items-start rounded-2xl border-2 p-5 text-left transition-all ${
                  active
                    ? "border-brand-500 bg-brand-50/50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {active && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-brand-100" : "bg-slate-100"}`}>
                  <Icon className={`h-5 w-5 ${active ? "text-brand-600" : "text-slate-400"}`} />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personal info (always visible) */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Personal Details</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              value={personal.fullName}
              onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={personal.email}
              onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="tel"
              value={personal.phone}
              onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
              className="input-field mt-1"
            />
          </div>
        </div>
      </div>

      {/* Business details (only when business) */}
      {accountType === "business" && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Business Details</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Required for invoicing and VAT receipts
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={business.companyName}
                onChange={(e) => setBusiness({ ...business, companyName: e.target.value })}
                className="input-field mt-1"
                placeholder="Acme Cleaning Ltd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Company Number</label>
              <input
                type="text"
                value={business.companyNumber}
                onChange={(e) => setBusiness({ ...business, companyNumber: e.target.value })}
                className="input-field mt-1"
                placeholder="12345678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">VAT Number</label>
              <div className="relative">
                <Shield className="absolute left-3.5 top-[calc(0.25rem+50%)] h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={business.vatNumber}
                  onChange={(e) => setBusiness({ ...business, vatNumber: e.target.value.toUpperCase() })}
                  className="input-field mt-1 pl-10"
                  placeholder="GB 123456789"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Billing Email</label>
              <div className="relative">
                <Receipt className="absolute left-3.5 top-[calc(0.25rem+50%)] h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={business.billingEmail}
                  onChange={(e) => setBusiness({ ...business, billingEmail: e.target.value })}
                  className="input-field mt-1 pl-10"
                  placeholder="accounts@acme.co.uk"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Website</label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-[calc(0.25rem+50%)] h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={business.website}
                  onChange={(e) => setBusiness({ ...business, website: e.target.value })}
                  className="input-field mt-1 pl-10"
                  placeholder="https://acme.co.uk"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Industry</label>
              <CustomDropdown
                value={business.industry}
                onChange={(v) => setBusiness({ ...business, industry: v })}
                options={INDUSTRY_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                placeholder="Select…"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Employees</label>
              <CustomDropdown
                value={business.employeeCount}
                onChange={(v) => setBusiness({ ...business, employeeCount: v })}
                options={EMPLOYEE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                icon={Users}
                placeholder="Select…"
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">
              Business accounts receive VAT-compliant invoices and unlock commercial cleaning rates.
            </p>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary gap-2 px-8">
          <Check className="h-4 w-4" />
          Save Changes
        </button>
        {saved && (
          <span className="text-sm font-medium text-emerald-600">Changes saved</span>
        )}
      </div>
    </div>
  );
}
