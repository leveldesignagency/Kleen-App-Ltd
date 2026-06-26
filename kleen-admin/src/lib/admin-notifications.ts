import { create } from "zustand";
import { playAdminAlertSound } from "@/lib/admin-alert-sound";

export interface AdminToast {
  id: string;
  type: "success" | "error" | "info" | "warning" | "alert";
  title: string;
  message?: string;
  /** Stays until dismissed (default true for type alert). */
  persistent?: boolean;
  href?: string;
  playSound?: boolean;
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
    const isAlert = toast.type === "alert";
    const persistent = toast.persistent ?? isAlert;
    const playSound = toast.playSound ?? isAlert;

    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    if (playSound) playAdminAlertSound();

    if (!persistent) {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 5000);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
