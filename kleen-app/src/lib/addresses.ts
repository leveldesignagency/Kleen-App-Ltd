import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  isDefault: boolean;
}

function rowToAddress(r: { id: string; label: string; line_1: string; line_2?: string | null; city: string | null; postcode: string; is_default: boolean }): SavedAddress {
  return {
    id: r.id,
    label: r.label,
    line1: r.line_1,
    line2: r.line_2 ?? undefined,
    city: r.city ?? "",
    postcode: r.postcode,
    isDefault: r.is_default,
  };
}

interface AddressStore {
  addresses: SavedAddress[];
  setAddresses: (addrs: SavedAddress[]) => void;
  syncFromSupabase: (supabase: SupabaseClient) => Promise<void>;
  add: (supabase: SupabaseClient, addr: Omit<SavedAddress, "id">) => Promise<SavedAddress | null>;
  update: (supabase: SupabaseClient, id: string, data: Partial<Omit<SavedAddress, "id">>) => Promise<void>;
  remove: (supabase: SupabaseClient, id: string) => Promise<void>;
  setDefault: (supabase: SupabaseClient, id: string) => Promise<void>;
  addIfNew: (supabase: SupabaseClient, line1: string, postcode: string) => Promise<void>;
}

export const useAddressStore = create<AddressStore>()((set, get) => ({
  addresses: [],

  setAddresses: (addrs) => set({ addresses: addrs }),

  syncFromSupabase: async (supabase) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ addresses: [] });
      return;
    }
    const { data: rows } = await supabase
      .from("addresses")
      .select("id, label, line_1, line_2, city, postcode, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    set({ addresses: (rows ?? []).map(rowToAddress) });
  },

  add: async (supabase, addr) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (addr.isDefault) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }
    const { data: row, error } = await supabase
      .from("addresses")
      .insert({
        user_id: user.id,
        label: addr.label || "Home",
        line_1: addr.line1,
        line_2: addr.line2 || null,
        city: addr.city || null,
        postcode: addr.postcode,
        is_default: addr.isDefault ?? false,
      })
      .select("id, label, line_1, line_2, city, postcode, is_default")
      .single();
    if (error || !row) return null;
    const newAddr = rowToAddress({ ...row, line_2: row.line_2 ?? undefined });
    set((s) => ({
      addresses: s.addresses.map((a) => ({ ...a, isDefault: false })).concat(newAddr),
    }));
    return newAddr;
  },

  update: async (supabase, id, data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: Record<string, unknown> = {};
    if (data.label !== undefined) payload.label = data.label;
    if (data.line1 !== undefined) payload.line_1 = data.line1;
    if (data.line2 !== undefined) payload.line_2 = data.line2 || null;
    if (data.city !== undefined) payload.city = data.city || null;
    if (data.postcode !== undefined) payload.postcode = data.postcode;
    if (data.isDefault === true) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
      payload.is_default = true;
    } else if (data.isDefault === false) payload.is_default = false;
    await supabase.from("addresses").update(payload).eq("id", id).eq("user_id", user.id);
    set((s) => ({
      addresses: s.addresses.map((a) => {
        if (a.id !== id) return data.isDefault ? { ...a, isDefault: false } : a;
        return { ...a, ...data };
      }),
    }));
  },

  remove: async (supabase, id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
    const current = get().addresses;
    const remaining = current.filter((a) => a.id !== id);
    if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
      await supabase.from("addresses").update({ is_default: true }).eq("id", remaining[0].id).eq("user_id", user.id);
      set({ addresses: remaining.map((a, i) => ({ ...a, isDefault: i === 0 })) });
    } else {
      set({ addresses: remaining });
    }
  },

  setDefault: async (supabase, id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
    set((s) => ({
      addresses: s.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
    }));
  },

  addIfNew: async (supabase, line1, postcode) => {
    const existing = get().addresses;
    const alreadyExists = existing.some(
      (a) =>
        a.line1.toLowerCase() === line1.toLowerCase() &&
        a.postcode.toLowerCase().replace(/\s/g, "") === postcode.toLowerCase().replace(/\s/g, "")
    );
    if (alreadyExists) return;
    const isFirst = existing.length === 0;
    await get().add(supabase, {
      label: isFirst ? "Home" : `Address ${existing.length + 1}`,
      line1,
      city: "",
      postcode,
      isDefault: isFirst,
    });
  },
}));
