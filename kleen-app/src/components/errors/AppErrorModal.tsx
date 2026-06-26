"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  WifiOff,
  X,
} from "lucide-react";
import type { AppErrorPresentation } from "@/lib/app-errors";
import { SUPPORT_EMAIL, supportMailtoLink } from "@/lib/support-contact";

type ReportState = "idle" | "sending" | "sent" | "failed";

export type AppErrorModalProps = {
  open: boolean;
  error: AppErrorPresentation | null;
  onClose: () => void;
  onRetry?: () => void;
  context?: Record<string, unknown>;
  userEmail?: string;
  page?: string;
};

export default function AppErrorModal({
  open,
  error,
  onClose,
  onRetry,
  context,
  userEmail,
  page,
}: AppErrorModalProps) {
  const [userMessage, setUserMessage] = useState("");
  const [reportState, setReportState] = useState<ReportState>("idle");
  const [reportError, setReportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setUserMessage("");
      setReportState("idle");
      setReportError(null);
      setCopied(false);
    }
  }, [open, error?.reportId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sendReport = useCallback(async () => {
    if (!error) return;
    setReportState("sending");
    setReportError(null);
    try {
      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportId: error.reportId,
          kind: error.kind,
          title: error.title,
          message: error.message,
          detail: error.detail,
          userMessage: userMessage.trim() || undefined,
          page,
          context,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportState("failed");
        setReportError(data.error || "Could not send report. Try emailing us instead.");
        return;
      }
      setReportState("sent");
    } catch {
      setReportState("failed");
      setReportError("Network error — try emailing us with your reference code.");
    }
  }, [error, userMessage, page, context]);

  const copyReference = useCallback(async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(error.reportId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [error]);

  if (!open || !error) return null;

  const isServiceDown = error.kind === "service_down" || error.kind === "network";
  const Icon = isServiceDown ? WifiOff : AlertTriangle;
  const iconWrap = isServiceDown
    ? "bg-amber-100 text-amber-600"
    : "bg-red-100 text-red-600";

  const mailBody = [
    `Reference: ${error.reportId}`,
    "",
    error.message,
    error.detail ? `\nTechnical detail: ${error.detail}` : "",
    userMessage.trim() ? `\nMy note: ${userMessage.trim()}` : "",
    userEmail ? `\nMy email: ${userEmail}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-error-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0">
        <div className="flex items-start gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="app-error-title" className="text-lg font-bold text-slate-900">
              {error.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{error.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Reference code
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="font-mono text-sm font-semibold text-slate-800">{error.reportId}</code>
              <button
                type="button"
                onClick={copyReference}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {error.showContact && (
            <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
              <p className="text-sm font-semibold text-slate-900">Contact the Kleen team</p>
              <p className="mt-1 text-xs text-slate-600">
                We&apos;re here to help — email us and include your reference code.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={supportMailtoLink(`Kleen support — ${error.reportId}`, mailBody)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-brand-200 transition hover:bg-brand-50"
                >
                  <Mail className="h-4 w-4" />
                  Email {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          )}

          {reportState === "sent" ? (
            <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">
              Report sent — our team will look into this. You can also email us if you need a faster reply.
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="error-user-message" className="text-xs font-semibold text-slate-700">
                  Add a note for our team (optional)
                </label>
                <textarea
                  id="error-user-message"
                  rows={3}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="What were you trying to do when this happened?"
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              {reportError && (
                <p className="text-xs text-red-600">{reportError}</p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
          {error.canRetry && onRetry && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          )}
          {reportState !== "sent" && (
            <button
              type="button"
              onClick={sendReport}
              disabled={reportState === "sending"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {reportState === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send report to Kleen
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
