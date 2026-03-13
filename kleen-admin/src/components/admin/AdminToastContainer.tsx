"use client";

import { useAdminNotifications, AdminToast } from "@/lib/admin-notifications";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ICON_MAP: Record<AdminToast["type"], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP: Record<AdminToast["type"], string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  info: "border-brand-500/30 bg-brand-500/10 text-brand-400",
};

export default function AdminToastContainer() {
  const { toasts, dismiss } = useAdminNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-0 top-0 z-[60] flex flex-col gap-2 p-4 sm:p-6">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm ${COLOR_MAP[toast.type]} animate-in slide-in-from-right`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-xs opacity-80">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-slate-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
