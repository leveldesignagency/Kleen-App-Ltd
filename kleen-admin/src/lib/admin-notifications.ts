import { create } from "zustand";
import { playAdminAlertSound } from "@/lib/admin-alert-sound";
import { DEFAULT_ADMIN_PREFERENCES, type AdminDisplayPreferences } from "@/lib/admin-staff";

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
  soundEnabled: boolean;
  alertsEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  setAlertsEnabled: (v: boolean) => void;
  push: (toast: Omit<AdminToast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useAdminNotifications = create<AdminNotificationStore>((set, get) => ({
  toasts: [],
  soundEnabled: DEFAULT_ADMIN_PREFERENCES.alertSounds,
  alertsEnabled: DEFAULT_ADMIN_PREFERENCES.showToastAlerts,
  setSoundEnabled: (v) => set({ soundEnabled: v }),
  setAlertsEnabled: (v) => set({ alertsEnabled: v }),
  push: (toast) => {
    const isAlert = toast.type === "alert";
    const persistent = toast.persistent ?? isAlert;
    const playSound = toast.playSound ?? isAlert;

    if (isAlert && !get().alertsEnabled) return;

    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    if (playSound && get().soundEnabled) playAdminAlertSound();

    if (!persistent) {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 5000);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
