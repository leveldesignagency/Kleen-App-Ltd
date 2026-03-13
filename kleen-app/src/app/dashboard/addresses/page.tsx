"use client";

import { useState, useEffect } from "react";
import { MapPin, Plus, Pencil, Trash2, Star, Check, X } from "lucide-react";
import { useAddressStore, SavedAddress } from "@/lib/addresses";
import { createClient } from "@/lib/supabase/client";

const EMPTY: Omit<SavedAddress, "id"> = { label: "", line1: "", line2: "", city: "", postcode: "", isDefault: false };

export default function AddressesPage() {
  const supabase = createClient();
  const { addresses, syncFromSupabase, add, update, remove, setDefault } = useAddressStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    syncFromSupabase(supabase).then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (addr: SavedAddress) => {
    setEditing(addr.id);
    setForm({ label: addr.label, line1: addr.line1, line2: addr.line2 || "", city: addr.city, postcode: addr.postcode, isDefault: addr.isDefault });
    setAdding(false);
  };

  const startAdd = () => {
    setAdding(true);
    setEditing(null);
    setForm(EMPTY);
  };

  const cancel = () => { setEditing(null); setAdding(false); setForm(EMPTY); };

  const save = async () => {
    if (!form.label.trim() || !form.line1.trim() || !form.postcode.trim()) return;
    setSaving(true);
    if (adding) {
      await add(supabase, {
        ...form,
        isDefault: addresses.length === 0 ? true : form.isDefault,
      });
      cancel();
    } else if (editing) {
      await update(supabase, editing, form);
      cancel();
    }
    setSaving(false);
  };

  const handleRemove = async (id: string) => {
    setSaving(true);
    await remove(supabase, id);
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    setSaving(true);
    await setDefault(supabase, id);
    setSaving(false);
  };

  const isEditing = editing !== null || adding;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Addresses</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your saved addresses for quick booking</p>
        </div>
        {!isEditing && (
          <button onClick={startAdd} className="btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Add Address
          </button>
        )}
      </div>

      {isEditing && (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {adding ? "New Address" : "Edit Address"}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Label</label>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input-field mt-1" placeholder="Home, Office, etc." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Postcode</label>
              <input type="text" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value.toUpperCase() })} className="input-field mt-1" placeholder="SW1A 1AA" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Address Line 1</label>
              <input type="text" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="input-field mt-1" placeholder="42 Maple Drive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Address Line 2</label>
              <input type="text" value={form.line2 || ""} onChange={(e) => setForm({ ...form, line2: e.target.value })} className="input-field mt-1" placeholder="Flat 3B (optional)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field mt-1" placeholder="London" />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Set as default address
          </label>
          <div className="mt-5 flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary gap-2 px-6">
              <Check className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="btn-secondary gap-2 px-6">
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`flex items-center justify-between rounded-2xl border bg-white p-5 transition-all ${
              addr.isDefault ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${addr.isDefault ? "bg-brand-50" : "bg-slate-100"}`}>
                <MapPin className={`h-4.5 w-4.5 ${addr.isDefault ? "text-brand-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {addr.label}
                  {addr.isDefault && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                      <Star className="h-2.5 w-2.5 fill-brand-500" />
                      Default
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}{addr.city ? `, ${addr.city}` : ""}, {addr.postcode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!addr.isDefault && (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-brand-200 hover:text-brand-600 disabled:opacity-50"
                  title="Set as default"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => startEdit(addr)}
                className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleRemove(addr.id)}
                disabled={saving}
                className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {addresses.length === 0 && (
          <div className="py-12 text-center">
            <MapPin className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No saved addresses yet</p>
            <p className="text-xs text-slate-400">Add an address below or from your next booking</p>
          </div>
        )}
      </div>
    </div>
  );
}
