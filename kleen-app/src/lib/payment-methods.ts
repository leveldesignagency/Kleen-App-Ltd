import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PaymentMethod } from "@/types";

function rowToMethod(r: { id: string; type: string; label: string; last_four: string | null; brand: string | null; is_default: boolean; stripe_payment_method_id?: string | null }): PaymentMethod {
  return {
    id: r.id,
    type: r.type as PaymentMethod["type"],
    label: r.label,
    last4: r.last_four ?? undefined,
    brand: r.brand ?? undefined,
    isDefault: r.is_default,
    stripePaymentMethodId: r.stripe_payment_method_id ?? undefined,
  };
}

interface PaymentMethodStore {
  methods: PaymentMethod[];
  setMethods: (methods: PaymentMethod[]) => void;
  syncFromSupabase: (supabase: SupabaseClient) => Promise<void>;
  add: (supabase: SupabaseClient, method: Omit<PaymentMethod, "id">) => Promise<PaymentMethod | null>;
  remove: (supabase: SupabaseClient, id: string) => Promise<void>;
  setDefault: (supabase: SupabaseClient, id: string) => Promise<void>;
  addIfNew: (supabase: SupabaseClient, method: PaymentMethod) => Promise<void>;
}

export const usePaymentMethodStore = create<PaymentMethodStore>()((set, get) => ({
  methods: [],

  setMethods: (methods) => set({ methods }),

  syncFromSupabase: async (supabase) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ methods: [] });
      return;
    }
    const { data: rows } = await supabase
      .from("payment_methods")
      .select("id, type, label, last_four, brand, is_default, stripe_payment_method_id")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    set({ methods: (rows ?? []).map(rowToMethod) });
  },

  add: async (supabase, method) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (method.isDefault) {
      await supabase.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
    }
    const isFirst = get().methods.length === 0;
    const { data: row, error } = await supabase
      .from("payment_methods")
      .insert({
        user_id: user.id,
        type: method.type,
        label: method.label,
        last_four: method.last4 ?? null,
        brand: method.brand ?? null,
        is_default: isFirst ? true : (method.isDefault ?? false),
        ...(method.stripePaymentMethodId && { stripe_payment_method_id: method.stripePaymentMethodId }),
      })
      .select("id, type, label, last_four, brand, is_default, stripe_payment_method_id")
      .single();
    if (error || !row) return null;
    const newMethod = rowToMethod(row);
    set((s) => ({
      methods: s.methods.map((m) => ({ ...m, isDefault: false })).concat(newMethod),
    }));
    return newMethod;
  },

  remove: async (supabase, id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("payment_methods").delete().eq("id", id).eq("user_id", user.id);
    const remaining = get().methods.filter((m) => m.id !== id);
    if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
      await supabase.from("payment_methods").update({ is_default: true }).eq("id", remaining[0].id).eq("user_id", user.id);
      set({ methods: remaining.map((m, i) => ({ ...m, isDefault: i === 0 })) });
    } else {
      set({ methods: remaining });
    }
  },

  setDefault: async (supabase, id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("payment_methods").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
    set((s) => ({
      methods: s.methods.map((m) => ({ ...m, isDefault: m.id === id })),
    }));
  },

  addIfNew: async (supabase, method) => {
    const existing = get().methods;
    const alreadyExists = existing.some(
      (m) => m.last4 === method.last4 && m.brand === method.brand
    );
    if (alreadyExists) return;
    await get().add(supabase, {
      type: method.type,
      label: method.label,
      last4: method.last4,
      brand: method.brand,
      isDefault: existing.length === 0,
      ...(method.stripePaymentMethodId && { stripePaymentMethodId: method.stripePaymentMethodId }),
    });
  },
}));
