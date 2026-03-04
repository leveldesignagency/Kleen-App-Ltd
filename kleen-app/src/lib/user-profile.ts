import { create } from "zustand";
import { persist } from "zustand/middleware";

type AccountType = "personal" | "business";

interface UserProfileStore {
  fullName: string;
  email: string;
  phone: string;
  accountType: AccountType;
  setProfile: (data: { fullName?: string; email?: string; phone?: string }) => void;
  setAccountType: (type: AccountType) => void;
}

export const useUserProfile = create<UserProfileStore>()(
  persist(
    (set) => ({
      fullName: "",
      email: "",
      phone: "",
      accountType: "personal",
      setProfile: (data) => set((s) => ({ ...s, ...data })),
      setAccountType: (accountType) => set({ accountType }),
    }),
    { name: "kleen-user-profile" }
  )
);
