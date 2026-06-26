"use client";

import Link from "next/link";
import { useAdminNotifications, AdminToast } from "@/lib/admin-notifications";
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Bell } from "lucide-react";

const ICON_MAP: Record<AdminToast["type"], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  alert: Bell,
};

const COLOR_MAP: Record<AdminToast["type"], string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  info: "border-brand-500/30 bg-brand-500/10 text-brand-400",
  alert: "border-cyan-400/40 bg-cyan-500/15 text-cyan-300 shadow-cyan-500/10 shadow-lg ring-1 ring-cyan-400/20",
};

export default function AdminToastContainer() {
  const { toasts, dismiss } = useAdminNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-0 top-0 z-[200] flex w-full max-w-sm flex-col gap-2 p-4 sm:p-6">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type];
        const isAlert = toast.type === "alert";
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-4 backdrop-blur-md animate-in slide-in-from-right ${COLOR_MAP[toast.type]}`}
          >
            <Icon className={`mt-0.5 shrink-0 ${isAlert ? "h-5 w-5 animate-pulse" : "h-4 w-4"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-xs leading-relaxed opacity-85">{toast.message}</p>
              )}
              {toast.href && (
                <Link
                  href={toast.href}
                  onClick={() => dismiss(toast.id)}
                  className="mt-2 inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:text-white hover:underline"
                >
                  View →
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
