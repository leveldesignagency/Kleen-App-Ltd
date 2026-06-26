"use client";

import { useCallback, useState } from "react";
import { Loader2, Mail, Phone, RefreshCw, WifiOff } from "lucide-react";
import { createReportId } from "@/lib/app-errors";
import { SUPPORT_EMAIL, supportMailtoLink } from "@/lib/support-contact";

type Props = {
  onRetry: () => void;
  checking?: boolean;
  errorDetail?: string;
};

export default function ServicesUnavailablePanel({ onRetry, checking, errorDetail }: Props) {
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [reportId] = useState(() => createReportId());

  const notifyTeam = useCallback(async () => {
    setReportState("sending");
    try {
      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportId,
          kind: "service_down",
          title: "Booking services unavailable",
          message: "Customer reached job flow while Kleen services were down.",
          detail: errorDetail,
          page: typeof window !== "undefined" ? window.location.pathname : "/dashboard/job-flow",
          context: { source: "services_unavailable_panel" },
        }),
      });
      setReportState(res.ok ? "sent" : "failed");
    } catch {
      setReportState("failed");
    }
  }, [reportId, errorDetail]);

  return (
    <div className="mx-auto max-w-lg py-8 text-center sm:py-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <WifiOff className="h-8 w-8" />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-slate-900">Booking is temporarily unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">
        Kleen&apos;s booking service isn&apos;t responding right now. This is usually brief — try again in a
        moment, or contact our team and we&apos;ll help you book manually.
      </p>

      <div className="mt-8 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6 text-left">
        <p className="text-sm font-semibold text-slate-900">Contact the Kleen team</p>
        <ul className="mt-4 space-y-3">
          <li>
            <a
              href={supportMailtoLink(
                "Help booking a clean",
                `Hi Kleen team,\n\nI tried to book on the dashboard but the service was unavailable.\nReference: ${reportId}\n\nPlease contact me to complete my booking.\n`,
              )}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-brand-200 hover:bg-brand-50/50"
            >
              <Mail className="h-5 w-5 flex-shrink-0 text-brand-600" />
              <span>
                <span className="font-medium text-slate-900">{SUPPORT_EMAIL}</span>
                <span className="mt-0.5 block text-xs text-slate-500">Email us — we typically reply within a few hours</span>
              </span>
            </a>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <Phone className="h-5 w-5 flex-shrink-0 text-brand-600" />
            <span>
              <span className="font-medium text-slate-900">Prefer a call?</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Email us with your number and we&apos;ll call you back
              </span>
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onRetry}
          disabled={checking}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Try again
            </>
          )}
        </button>
        {reportState === "sent" ? (
          <p className="self-center text-sm text-accent-700">Team notified — thank you.</p>
        ) : (
          <button
            type="button"
            onClick={notifyTeam}
            disabled={reportState === "sending"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {reportState === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Notifying…
              </>
            ) : reportState === "failed" ? (
              "Couldn't notify — please email us"
            ) : (
              "Notify Kleen team"
            )}
          </button>
        )}
      </div>

      <p className="mt-6 font-mono text-xs text-slate-400">Ref: {reportId}</p>
    </div>
  );
}
