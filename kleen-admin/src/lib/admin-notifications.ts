import { create } from "zustand";
import { playAdminAlertSound } from "@/lib/admin-alert-sound";
import { DEFAULT_ADMIN_PREFERENCES } from "@/lib/admin-staff";

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
  /** Realtime/job alerts + bell inbox (not action success/error toasts). */
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

    const id = crypto.randomUUID();

    // Action feedback (save, error) always lands in the store for corner toasts.
    // Realtime/job alerts respect the notifications preference for sound + inbox.
    if (isAlert && !get().alertsEnabled) return;

    set((s) => {
      if (isAlert && toast.href) {
        const dup = s.toasts.some((t) => t.type === "alert" && t.href === toast.href && t.title === toast.title);
        if (dup) return s;
      }
      return { toasts: [...s.toasts, { ...toast, id }] };
    });

    if (playSound && get().soundEnabled) playAdminAlertSound();

    if (!persistent) {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 5000);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
