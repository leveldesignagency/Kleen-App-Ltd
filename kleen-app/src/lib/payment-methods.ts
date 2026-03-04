import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PaymentMethod } from "@/types";

interface PaymentMethodStore {
  methods: PaymentMethod[];
  add: (method: PaymentMethod) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
  addIfNew: (method: PaymentMethod) => void;
}

export const usePaymentMethodStore = create<PaymentMethodStore>()(
  persist(
    (set, get) => ({
      methods: [],

      add: (method) =>
        set((s) => {
          const isFirst = s.methods.length === 0;
          const m = { ...method, isDefault: isFirst ? true : method.isDefault };
          const others = m.isDefault
            ? s.methods.map((x) => ({ ...x, isDefault: false }))
            : s.methods;
          return { methods: [...others, m] };
        }),

      remove: (id) =>
        set((s) => {
          const remaining = s.methods.filter((m) => m.id !== id);
          if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
            remaining[0].isDefault = true;
          }
          return { methods: remaining };
        }),

      setDefault: (id) =>
        set((s) => ({
          methods: s.methods.map((m) => ({ ...m, isDefault: m.id === id })),
        })),

      addIfNew: (method) => {
        const existing = get().methods;
        const alreadyExists = existing.some(
          (m) => m.last4 === method.last4 && m.brand === method.brand
        );
        if (alreadyExists) return;

        const isFirst = existing.length === 0;
        set((s) => ({
          methods: [...s.methods, { ...method, isDefault: isFirst }],
        }));
      },
    }),
    { name: "kleen-payment-methods" }
  )
);
