"use client";

import { useState, useEffect } from "react";
import { User, Building2, Check, Shield, Globe, Receipt, Users, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useNotifications } from "@/lib/notifications";

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

const EMPLOYEE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in dropdown options below
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
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [personal, setPersonal] = useState<PersonalProfile>({
    fullName: "",
    email: "",
    phone: "",
  });
  const [business, setBusiness] = useState<BusinessProfile>({
    companyName: "",
    companyNumber: "",
    vatNumber: "",
    billingEmail: "",
    industry: "",
    employeeCount: "",
    website: "",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const pushToast = useNotifications((s) => s.push);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      type ProfileRow = {
        full_name: string | null;
        email: string | null;
        phone: string | null;
        account_type: string | null;
        account_deletion_scheduled_at?: string | null;
      };
      const full = await supabase
        .from("profiles")
        .select("full_name, email, phone, account_type, account_deletion_scheduled_at")
        .eq("id", user.id)
        .single();
      let profile: ProfileRow | null = full.data as ProfileRow | null;
      // If migration 029 is not applied yet, unknown columns cause 400 — retry without them.
      if (full.error) {
        const fb = await supabase
          .from("profiles")
          .select("full_name, email, phone, account_type")
          .eq("id", user.id)
          .single();
        profile = fb.data as ProfileRow | null;
      }
      if (profile) {
        setPersonal({
          fullName: profile.full_name ?? "",
          email: profile.email ?? user.email ?? "",
          phone: profile.phone ?? "",
        });
        setAccountType((profile.account_type as AccountType) ?? "personal");
        setDeletionScheduledAt(profile.account_deletion_scheduled_at ?? null);
      } else if (user.email) {
        setPersonal((p) => ({ ...p, email: user.email ?? "" }));
      }
      const { data: biz } = await supabase
        .from("business_profiles")
        .select("company_name, company_number, vat_number, billing_email, industry, employee_count, website")
        .eq("user_id", user.id)
        .maybeSingle();
      if (biz) {
        setBusiness({
          companyName: biz.company_name ?? "",
          companyNumber: biz.company_number ?? "",
          vatNumber: biz.vat_number ?? "",
          billingEmail: biz.billing_email ?? "",
          industry: biz.industry ?? "",
          employeeCount: biz.employee_count ?? "",
          website: biz.website ?? "",
        });
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      pushToast({
        type: "error",
        title: "Not signed in",
        message: "Sign in again to save your account details.",
      });
      return;
    }
    setSaving(true);
    const email = user.email ?? personal.email ?? "";
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email,
        full_name: personal.fullName || null,
        phone: personal.phone || null,
        account_type: accountType,
      },
      { onConflict: "id" },
    );
    if (profileError) {
      setSaving(false);
      pushToast({
        type: "error",
        title: "Couldn’t save profile",
        message: profileError.message,
      });
      return;
    }
    if (accountType === "business") {
      const { data: existing } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const payload = {
        user_id: user.id,
        company_name: business.companyName || "My Business",
        company_number: business.companyNumber || null,
        vat_number: business.vatNumber || null,
        billing_email: business.billingEmail || null,
        industry: business.industry || null,
        employee_count: business.employeeCount || null,
        website: business.website || null,
      };
      const bizRes = existing
        ? await supabase.from("business_profiles").update(payload).eq("id", existing.id)
        : await supabase.from("business_profiles").insert(payload);
      if (bizRes.error) {
        setSaving(false);
        pushToast({
          type: "error",
          title: "Couldn’t save business details",
          message: bizRes.error.message,
        });
        return;
      }
    }
    setSaving(false);
    setSaved(true);
    pushToast({
      type: "success",
      title: "Account updated",
      message: "Your details have been saved.",
    });
    setTimeout(() => setSaved(false), 2000);
  };

  const formatDeletionDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const handleRequestDeletion = async () => {
    setDeletionBusy(true);
    const { error } = await supabase.rpc("request_account_deletion");
    setDeletionBusy(false);
    setDeleteModalOpen(false);
    if (error) {
      pushToast({
        type: "error",
        title: "Couldn’t schedule deletion",
        message: error.message,
      });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("account_deletion_scheduled_at")
        .eq("id", user.id)
        .single();
      setDeletionScheduledAt(p?.account_deletion_scheduled_at ?? null);
    }
    pushToast({
      type: "success",
      title: "Deletion scheduled",
      message: "Your account will be permanently removed after the grace period unless you cancel.",
    });
  };

  const handleCancelDeletion = async () => {
    setDeletionBusy(true);
    const { error } = await supabase.rpc("cancel_account_deletion");
    setDeletionBusy(false);
    if (error) {
      pushToast({
        type: "error",
        title: "Couldn’t cancel",
        message: error.message,
      });
      return;
    }
    setDeletionScheduledAt(null);
    pushToast({
      type: "success",
      title: "Deletion cancelled",
      message: "Your account will stay active.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your profile and account type</p>

      {deletionScheduledAt && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Account deletion scheduled</p>
              <p className="mt-0.5 text-xs text-amber-800/90">
                Permanent removal on{" "}
                <span className="font-medium">{formatDeletionDate(deletionScheduledAt)}</span>. You can
                cancel anytime before then.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelDeletion}
            disabled={deletionBusy}
            className="shrink-0 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-50 disabled:opacity-50"
          >
            {deletionBusy ? "Cancelling…" : "Cancel deletion"}
          </button>
        </div>
      )}

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
              readOnly
              className="input-field mt-1 bg-slate-50"
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

      <div className="mt-6 flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary gap-2 px-8">
          <Check className="h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="text-sm font-medium text-emerald-600">Changes saved</span>
        )}
      </div>

      <div className="mt-12 rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-sm font-semibold text-red-900">Delete account</h2>
        <p className="mt-1 text-xs text-red-800/80">
          {deletionScheduledAt
            ? "You already have deletion scheduled. Use Cancel deletion above to keep your account."
            : "We will permanently delete your login and data after 30 days. You can cancel before then."}
        </p>
        {!deletionScheduledAt && (
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50"
          >
            Delete my account…
          </button>
        )}
      </div>

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-account-title" className="text-lg font-semibold text-slate-900">
              Schedule account deletion?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              After 30 days your account and associated data will be removed from our systems. Until
              then you can sign in and cancel from this page.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletionBusy}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={handleRequestDeletion}
                disabled={deletionBusy}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletionBusy ? "Scheduling…" : "Yes, schedule deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
