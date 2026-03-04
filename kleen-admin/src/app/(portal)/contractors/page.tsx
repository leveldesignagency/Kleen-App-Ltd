"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminStore, Contractor, ContractorType } from "@/lib/admin-store";
import { useAdminNotifications } from "@/lib/admin-notifications";
import {
  Users,
  Plus,
  Search,
  Filter,
  Loader2,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Star,
  X,
  Check,
  Building2,
  UserRound,
  Landmark,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";


const emptyContractor: Omit<Contractor, "id" | "created_at"> = {
  full_name: "",
  email: "",
  phone: "",
  contractor_type: "sole_trader",
  company_name: "",
  specialisations: [],
  service_areas: [],
  rating: 0,
  total_jobs: 0,
  hourly_rate: undefined,
  is_active: true,
  is_verified: false,
  notes: "",
  bank_account_name: "",
  bank_sort_code: "",
  bank_account_number: "",
  company_number: "",
  vat_number: "",
  utr_number: "",
};

export default function AdminContractorsPage() {
  const { contractors, setContractors, addContractor, updateContractor, removeContractor } =
    useAdminStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<{
    mode: "add" | "edit";
    data: typeof emptyContractor & { id?: string };
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contractor | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const toast = useAdminNotifications((s) => s.push);

  useEffect(() => {
    const loadServices = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("services")
        .select("name")
        .eq("is_active", true)
        .order("name");
      if (data) setAvailableServices(data.map((s: { name: string }) => s.name));
    };
    loadServices();
  }, []);

  useEffect(() => {
    if (contractors.length > 0) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("operatives")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) {
        setContractors(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((c: any) => ({
            id: c.id,
            user_id: c.user_id,
            full_name: c.full_name || "",
            email: c.email || "",
            phone: c.phone || "",
            contractor_type: c.contractor_type || "sole_trader",
            company_name: c.company_name || "",
            specialisations: c.specialisations || [],
            service_areas: c.service_areas || [],
            rating: c.avg_rating || 0,
            total_jobs: c.total_jobs || 0,
            hourly_rate: c.hourly_rate,
            is_active: c.is_active ?? true,
            is_verified: c.is_verified ?? false,
            notes: c.notes || "",
            bank_account_name: c.bank_account_name || "",
            bank_sort_code: c.bank_sort_code || "",
            bank_account_number: c.bank_account_number || "",
            company_number: c.company_number || "",
            vat_number: c.vat_number || "",
            utr_number: c.utr_number || "",
            stripe_account_id: c.stripe_account_id || "",
            created_at: c.created_at,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, [contractors.length, setContractors]);

  const filtered = useMemo(() => {
    let list = contractors;
    if (statusFilter === "active") list = list.filter((c) => c.is_active);
    else if (statusFilter === "inactive") list = list.filter((c) => !c.is_active);
    else if (statusFilter === "verified") list = list.filter((c) => c.is_verified);
    else if (statusFilter === "sole_trader") list = list.filter((c) => c.contractor_type === "sole_trader");
    else if (statusFilter === "business") list = list.filter((c) => c.contractor_type === "business");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [contractors, statusFilter, search]);

  const handleSave = async () => {
    if (!modal) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id, ...data } = modal.data as any;

    const payload = {
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || null,
      contractor_type: data.contractor_type || "sole_trader",
      company_name: data.company_name || null,
      specialisations: data.specialisations || [],
      service_areas: data.service_areas || [],
      hourly_rate: data.hourly_rate || null,
      is_active: data.is_active ?? true,
      is_verified: data.is_verified ?? false,
      notes: data.notes || null,
      bank_account_name: data.bank_account_name || null,
      bank_sort_code: data.bank_sort_code || null,
      bank_account_number: data.bank_account_number || null,
      company_number: data.company_number || null,
      vat_number: data.vat_number || null,
      utr_number: data.utr_number || null,
    };

    if (modal.mode === "add") {
      const { data: inserted, error } = await supabase
        .from("operatives")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        toast({ type: "error", title: "Save Failed", message: error.message });
        return;
      }

      if (inserted) {
        addContractor({
          ...data,
          ...payload,
          id: inserted.id,
          rating: 0,
          total_jobs: 0,
          created_at: inserted.created_at,
        });
        toast({ type: "success", title: "Contractor Added", message: `${data.full_name} has been added` });
      }
    } else {
      const { error } = await supabase
        .from("operatives")
        .update(payload)
        .eq("id", id);

      if (error) {
        console.error("Update error:", error);
        toast({ type: "error", title: "Save Failed", message: error.message });
        return;
      }

      updateContractor(id, { ...data, ...payload });
      toast({ type: "success", title: "Contractor Updated", message: `${data.full_name} has been updated` });
    }

    setModal(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    const name = deleteTarget.full_name;
    await supabase.from("operatives").delete().eq("id", deleteTarget.id);
    removeContractor(deleteTarget.id);
    setDeleteTarget(null);
    toast({ type: "info", title: "Contractor Removed", message: `${name} has been deleted` });
  };

  const toggleActive = async (c: Contractor) => {
    const supabase = createClient();
    await supabase.from("operatives").update({ is_active: !c.is_active }).eq("id", c.id);
    updateContractor(c.id, { is_active: !c.is_active });
  };

  const toggleVerified = async (c: Contractor) => {
    const supabase = createClient();
    await supabase.from("operatives").update({ is_verified: !c.is_verified }).eq("id", c.id);
    updateContractor(c.id, { is_verified: !c.is_verified });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contractors</h1>
          <p className="mt-1 text-sm text-slate-400">
            {contractors.length} total &middot;{" "}
            {contractors.filter((c) => c.is_active).length} active
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "add", data: { ...emptyContractor } })}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" />
          Add Contractor
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contractors…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
          />
        </div>
        <CustomDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "verified", label: "Verified" },
            { value: "sole_trader", label: "Sole Traders" },
            { value: "business", label: "Businesses" },
          ]}
          icon={Filter}
          className="w-44"
        />
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 font-medium text-slate-400">Type</th>
                <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">Company</th>
                <th className="hidden px-4 py-3 font-medium text-slate-400 lg:table-cell">Services</th>
                <th className="px-4 py-3 font-medium text-slate-400">Rating</th>
                <th className="px-4 py-3 font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Users className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2">No contractors found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-slate-500">{c.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          c.contractor_type === "business"
                            ? "bg-indigo-500/20 text-indigo-400"
                            : "bg-teal-500/20 text-teal-400"
                        }`}
                      >
                        {c.contractor_type === "business" ? (
                          <Building2 className="h-3 w-3" />
                        ) : (
                          <UserRound className="h-3 w-3" />
                        )}
                        {c.contractor_type === "business" ? "Business" : "Sole Trader"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 md:table-cell">
                      {c.company_name || "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.specialisations.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300"
                          >
                            {s}
                          </span>
                        ))}
                        {c.specialisations.length > 2 && (
                          <span className="text-[11px] text-slate-500">
                            +{c.specialisations.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm">{c.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            c.is_active
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                        {c.is_verified && (
                          <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setModal({
                              mode: "edit",
                              data: { ...c },
                            })
                          }
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(c)}
                          className={`rounded-lg p-1.5 transition-colors ${
                            c.is_active
                              ? "text-amber-400 hover:bg-amber-500/20"
                              : "text-emerald-400 hover:bg-emerald-500/20"
                          }`}
                          title={c.is_active ? "Deactivate" : "Activate"}
                        >
                          {c.is_active ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleVerified(c)}
                          className={`rounded-lg p-1.5 transition-colors ${
                            c.is_verified
                              ? "text-brand-400 hover:bg-brand-500/20"
                              : "text-slate-400 hover:bg-white/10"
                          }`}
                          title={c.is_verified ? "Unverify" : "Verify"}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/20"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <ContractorModal
          mode={modal.mode}
          data={modal.data}
          availableServices={availableServices}
          onChange={(updates) =>
            setModal((m) => (m ? { ...m, data: { ...m.data, ...updates } } : null))
          }
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Delete Contractor</h2>
            <p className="mt-2 text-sm text-slate-400">
              Remove {deleteTarget.full_name} from the database? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractorModal({
  mode,
  data,
  availableServices,
  onChange,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  availableServices: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (updates: any) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [areaInput, setAreaInput] = useState("");

  const addArea = () => {
    const val = areaInput.trim();
    if (val && !data.service_areas.includes(val)) {
      onChange({ service_areas: [...data.service_areas, val] });
    }
    setAreaInput("");
  };

  const removeArea = (a: string) => {
    onChange({ service_areas: data.service_areas.filter((x: string) => x !== a) });
  };

  const canProceed = data.full_name.trim() && data.email.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold">
          {mode === "add" ? "Add Contractor" : "Edit Contractor"}
        </h2>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              step === 1
                ? "bg-brand-500/20 text-brand-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <UserRound className="h-3.5 w-3.5" />
            Details
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <button
            onClick={() => canProceed && setStep(2)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              step === 2
                ? "bg-brand-500/20 text-brand-400"
                : canProceed
                  ? "text-slate-500 hover:text-slate-300"
                  : "cursor-not-allowed text-slate-600"
            }`}
          >
            <Landmark className="h-3.5 w-3.5" />
            Financial
          </button>
        </div>

        {/* ─── Step 1: Details ─── */}
        {step === 1 && (
          <div className="mt-5 space-y-4">
            <InputField
              label="Full Name"
              value={data.full_name}
              onChange={(v) => onChange({ full_name: v })}
              required
            />
            <InputField
              label="Email"
              type="email"
              value={data.email}
              onChange={(v) => onChange({ email: v })}
              required
            />

            <div>
              <label className="block text-xs font-medium text-slate-400">Contractor Type</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {([
                  { value: "sole_trader" as ContractorType, label: "Sole Trader", icon: UserRound },
                  { value: "business" as ContractorType, label: "Business", icon: Building2 },
                ]).map((opt) => {
                  const Icon = opt.icon;
                  const active = data.contractor_type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChange({ contractor_type: opt.value })}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-brand-500/50 bg-brand-500/15 text-brand-400"
                          : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Phone"
                value={data.phone}
                onChange={(v) => onChange({ phone: v })}
              />
              <InputField
                label="Company Name"
                value={data.company_name}
                onChange={(v) => onChange({ company_name: v })}
                placeholder={data.contractor_type === "business" ? "Required for businesses" : "Optional"}
              />
            </div>
            <InputField
              label="Hourly Rate (£)"
              type="number"
              value={data.hourly_rate || ""}
              onChange={(v) => onChange({ hourly_rate: v ? Number(v) : undefined })}
            />

            <ServiceTagPicker
              selected={data.specialisations}
              available={availableServices}
              onAdd={(s) => onChange({ specialisations: [...data.specialisations, s] })}
              onRemove={(s) =>
                onChange({ specialisations: data.specialisations.filter((x: string) => x !== s) })
              }
            />

            <div>
              <label className="block text-xs font-medium text-slate-400">Service Areas</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.service_areas.map((a: string) => (
                  <span
                    key={a}
                    className="flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-1 text-xs text-violet-300"
                  >
                    {a}
                    <button onClick={() => removeArea(a)} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArea())}
                  placeholder="e.g. London, Manchester…"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={addArea}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400">Notes</label>
              <textarea
                value={data.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                rows={3}
                placeholder="Internal notes…"
              />
            </div>
          </div>
        )}

        {/* ─── Step 2: Financial / Banking ─── */}
        {step === 2 && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Landmark className="h-4 w-4 text-brand-400" />
                Bank Details
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Used for automated Stripe payouts after job completion
              </p>
              <div className="mt-4 space-y-3">
                <InputField
                  label="Account Holder Name"
                  value={data.bank_account_name}
                  onChange={(v) => onChange({ bank_account_name: v })}
                  placeholder="As it appears on the bank account"
                />
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="Sort Code"
                    value={data.bank_sort_code}
                    onChange={(v) => onChange({ bank_sort_code: v })}
                    placeholder="XX-XX-XX"
                  />
                  <InputField
                    label="Account Number"
                    value={data.bank_account_number}
                    onChange={(v) => onChange({ bank_account_number: v })}
                    placeholder="8 digits"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Building2 className="h-4 w-4 text-brand-400" />
                Company &amp; Tax
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Required for invoicing and HMRC compliance
              </p>
              <div className="mt-4 space-y-3">
                <InputField
                  label="Company Registration Number"
                  value={data.company_number}
                  onChange={(v) => onChange({ company_number: v })}
                  placeholder={data.contractor_type === "business" ? "e.g. 12345678" : "N/A for sole traders"}
                />
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="VAT Number"
                    value={data.vat_number}
                    onChange={(v) => onChange({ vat_number: v })}
                    placeholder="GB 123 4567 89"
                  />
                  <InputField
                    label="UTR Number"
                    value={data.utr_number}
                    onChange={(v) => onChange({ utr_number: v })}
                    placeholder="10 digits"
                  />
                </div>
              </div>
            </div>

            {data.stripe_account_id && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Stripe Connected — {data.stripe_account_id}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                onClick={() => canProceed && setStep(2)}
                disabled={!canProceed}
                className="flex items-center gap-1 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={onSave}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
              >
                {mode === "add" ? "Add Contractor" : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceTagPicker({
  selected,
  available,
  onAdd,
  onRemove,
}: {
  selected: string[];
  available: string[];
  onAdd: (s: string) => void;
  onRemove: (s: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const remaining = available.filter((s) => !selected.includes(s));
  const filtered = query
    ? remaining.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : remaining;

  return (
    <div ref={ref}>
      <label className="block text-xs font-medium text-slate-400">Specialist Services</label>

      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 rounded-full bg-brand-500/20 px-2.5 py-1 text-xs text-brand-300"
            >
              {s}
              <button
                type="button"
                onClick={() => onRemove(s)}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search services…"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-brand-500"
        />

        {focused && filtered.length > 0 && (
          <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-slate-800 py-1 shadow-xl shadow-black/30">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onAdd(s);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Plus className="h-3.5 w-3.5 text-brand-400" />
                {s}
              </button>
            ))}
          </div>
        )}

        {focused && query && filtered.length === 0 && (
          <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-xl border border-white/10 bg-slate-800 p-3 shadow-xl shadow-black/30">
            <p className="text-center text-sm text-slate-500">
              No services match &ldquo;{query}&rdquo;
            </p>
          </div>
        )}
      </div>

      {selected.length === 0 && !focused && (
        <p className="mt-1.5 text-xs text-slate-500">
          Search and add the services this contractor specialises in
        </p>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
      />
    </div>
  );
}
