"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Navigation, MapPin, PartyPopper, AlertTriangle } from "lucide-react";

type JobState = {
  reference: string;
  status: string;
  serviceName: string;
  operative_en_route_at: string | null;
  operative_arrived_at: string | null;
  operative_marked_complete_at: string | null;
  operative_marked_incomplete_at: string | null;
  operative_incomplete_reason: string | null;
};

export default function ContractorFieldPortalPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const [data, setData] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contractor/portal/${token}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load job");
        setData(null);
      } else {
        setData(json as JobState);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (action: "en_route" | "arrived" | "complete" | "incomplete") => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contractor/portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "incomplete" ? incompleteReason : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Update failed");
      } else {
        await load();
        if (action === "incomplete") setIncompleteReason("");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-center text-slate-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const done =
    !!data.operative_marked_complete_at ||
    !!data.operative_marked_incomplete_at ||
    ["completed", "funds_released", "cancelled"].includes(data.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">Kleen · Contractor</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-slate-900">{data.serviceName}</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Job {data.reference}</p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {data.operative_marked_incomplete_at && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">Marked incomplete</p>
                <p className="mt-1 text-sm text-amber-800">{data.operative_incomplete_reason || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {data.operative_marked_complete_at && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 font-semibold text-emerald-900">Job marked complete</p>
            <p className="mt-1 text-sm text-emerald-700">Thank you — the customer will be asked to confirm.</p>
          </div>
        )}

        {!done && (
          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium text-slate-700">Update your status</p>

            <button
              type="button"
              disabled={submitting || !!data.operative_en_route_at}
              onClick={() => post("en_route")}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 disabled:opacity-50"
            >
              <Navigation className="h-6 w-6 text-brand-600" />
              <div>
                <p className="font-semibold text-slate-900">On my way</p>
                <p className="text-xs text-slate-500">Heading to the job address</p>
              </div>
              {data.operative_en_route_at && <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" />}
            </button>

            <button
              type="button"
              disabled={submitting || !data.operative_en_route_at || !!data.operative_arrived_at}
              onClick={() => post("arrived")}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 disabled:opacity-50"
            >
              <MapPin className="h-6 w-6 text-brand-600" />
              <div>
                <p className="font-semibold text-slate-900">Arrived</p>
                <p className="text-xs text-slate-500">You are on site</p>
              </div>
              {data.operative_arrived_at && <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" />}
            </button>

            <button
              type="button"
              disabled={submitting || !data.operative_arrived_at}
              onClick={() => post("complete")}
              className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <PartyPopper className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">Job completed</p>
                <p className="text-xs text-emerald-700">Work finished to specification</p>
              </div>
            </button>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-sm font-medium text-amber-900">Could not complete the job?</p>
              <textarea
                value={incompleteReason}
                onChange={(e) => setIncompleteReason(e.target.value)}
                placeholder="Brief reason (e.g. access refused, unsafe conditions)"
                className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                rows={3}
              />
              <button
                type="button"
                disabled={submitting || incompleteReason.trim().length < 3}
                onClick={() => post("incomplete")}
                className="mt-2 w-full rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Submit incomplete + reason
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
