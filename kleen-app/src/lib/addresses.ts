import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  isDefault: boolean;
}

interface AddressStore {
  addresses: SavedAddress[];
  add: (addr: SavedAddress) => void;
  update: (id: string, data: Partial<SavedAddress>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
  addIfNew: (line1: string, postcode: string) => void;
}

export const useAddressStore = create<AddressStore>()(
  persist(
    (set, get) => ({
      addresses: [],

      add: (addr) =>
        set((s) => {
          const others = addr.isDefault
            ? s.addresses.map((a) => ({ ...a, isDefault: false }))
            : s.addresses;
          return { addresses: [...others, addr] };
        }),

      update: (id, data) =>
        set((s) => ({
          addresses: s.addresses.map((a) => {
            if (a.id === id) return { ...a, ...data };
            if (data.isDefault) return { ...a, isDefault: false };
            return a;
          }),
        })),

      remove: (id) =>
        set((s) => {
          const remaining = s.addresses.filter((a) => a.id !== id);
          if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
            remaining[0].isDefault = true;
          }
          return { addresses: remaining };
        }),

      setDefault: (id) =>
        set((s) => ({
          addresses: s.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
        })),

      addIfNew: (line1, postcode) => {
        const existing = get().addresses;
        const alreadyExists = existing.some(
          (a) =>
            a.line1.toLowerCase() === line1.toLowerCase() &&
            a.postcode.toLowerCase() === postcode.toLowerCase()
        );
        if (alreadyExists) return;

        const isFirst = existing.length === 0;
        const newAddr: SavedAddress = {
          id: `addr-${Date.now()}`,
          label: isFirst ? "Home" : `Address ${existing.length + 1}`,
          line1,
          city: "",
          postcode,
          isDefault: isFirst,
        };
        set((s) => ({ addresses: [...s.addresses, newAddr] }));
      },
    }),
    { name: "kleen-addresses" }
  )
);
