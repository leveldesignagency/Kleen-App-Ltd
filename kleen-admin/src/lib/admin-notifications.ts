import { create } from "zustand";

export interface AdminToast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
}

interface AdminNotificationStore {
  toasts: AdminToast[];
  push: (toast: Omit<AdminToast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useAdminNotifications = create<AdminNotificationStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
