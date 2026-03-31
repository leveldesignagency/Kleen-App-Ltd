"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/lib/notifications";
import {
  Briefcase,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  XCircle,
  Loader2,
  X,
} from "lucide-react";
import BookAgainSection from "@/components/dashboard/BookAgainSection";
import { fetchCustomerJobsList, fetchQuotePricesByJobId } from "@/lib/dashboard-jobs-fetch";

interface DashboardJob {
  id: string;
  reference: string;
  service_name: string;
  status: string;
  preferred_date: string;
  min_price: number;
  max_price: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:              { label: "Pending",            className: "bg-slate-100 text-slate-600" },
  awaiting_quotes:      { label: "Getting Quotes",     className: "bg-blue-100 text-blue-700" },
  quotes_received:      { label: "Quotes Ready",       className: "bg-indigo-100 text-indigo-700" },
  quoted:               { label: "Quoted",             className: "bg-blue-100 text-blue-700" },
  sent_to_customer:     { label: "Quotes Available",   className: "bg-violet-100 text-violet-700" },
  customer_accepted:    { label: "Accepted",           className: "bg-brand-100 text-brand-700" },
  accepted:             { label: "Accepted",           className: "bg-brand-100 text-brand-700" },
  awaiting_completion:  { label: "In Progress",        className: "bg-amber-100 text-amber-700" },
  in_progress:          { label: "In Progress",        className: "bg-amber-100 text-amber-700" },
  pending_confirmation: { label: "Confirming",         className: "bg-teal-100 text-teal-700" },
  completed:            { label: "Completed",          className: "bg-accent-100 text-accent-700" },
  funds_released:       { label: "Complete",           className: "bg-green-100 text-green-700" },
  disputed:             { label: "Disputed",           className: "bg-red-100 text-red-700" },
  cancelled:            { label: "Cancelled",          className: "bg-slate-100 text-slate-500" },
};

const CANCELLABLE = ["pending", "quoted", "awaiting_quotes", "sent_to_customer"];

export default function DashboardOverview() {
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DashboardJob | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const pushNotification = useNotifications((s) => s.push);

  useEffect(() => {
    const supabase = createClient();
    let channel: { unsubscribe: () => void } | null = null;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const fetchJobs = async () => {
        setLoadError(null);
        const { rows, error } = await fetchCustomerJobsList(supabase, user.id, { limit: 30 });
        if (error) {
          console.error("dashboard jobs:", error);
          setLoadError(error.message);
          setJobs([]);
          return;
        }
        if (rows.length) {
          const priceMap = await fetchQuotePricesByJobId(
            supabase,
            rows.map((j) => j.id)
          );
          setJobs(
            rows.map((j) => {
              const p = priceMap.get(j.id);
              return {
                id: j.id,
                reference: j.reference,
                service_name: j.service_name,
                status: j.status,
                preferred_date: j.preferred_date,
                min_price: p?.min ?? 0,
                max_price: p?.max ?? 0,
                created_at: j.created_at,
              };
            })
          );
        } else {
          setJobs([]);
        }
      };

      await fetchJobs();
      setLoading(false);

      // Real-time: when admin updates a job, refresh the list
      channel = supabase
        .channel("dashboard-jobs")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${user.id}` },
          () => { fetchJobs(); }
        )
        .subscribe();
    };

    load();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", cancelTarget.id);

    if (!error) {
      setJobs((prev) =>
        prev.map((j) => j.id === cancelTarget.id ? { ...j, status: "cancelled" } : j)
      );
      pushNotification({
        type: "info",
        title: "Job Cancelled",
        message: `${cancelTarget.reference} has been cancelled.`,
      });
    }

    setCancelling(false);
    setCancelTarget(null);
  };

  const activeCount = jobs.filter(
    (j) => !["completed", "funds_released", "cancelled", "disputed"].includes(j.status)
  ).length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const disputeCount = jobs.filter((j) => j.status === "disputed").length;
  const totalSpent = jobs
    .filter((j) => j.status === "completed")
    .reduce((sum, j) => sum + j.max_price, 0);

  const STATS = [
    { label: "Active Jobs", value: String(activeCount), icon: Clock, color: "text-brand-600 bg-brand-50" },
    { label: "Completed", value: String(completedCount), icon: CheckCircle2, color: "text-accent-600 bg-accent-50" },
    { label: "Disputes", value: String(disputeCount), icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
    { label: "Total Spent", value: totalSpent > 0 ? `£${(totalSpent / 100).toFixed(0)}` : "£0", icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
  ];

  const formatPrice = (min: number, max: number) =>
    min > 0 ? `£${(min / 100).toFixed(0)}–£${(max / 100).toFixed(0)}` : "—";

  const recentJobs = jobs.filter((j) => j.status !== "cancelled").slice(0, 10);
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled").slice(0, 10);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div>
      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Could not load your jobs</p>
          <p className="mt-1 text-red-800/90">{loadError}</p>
          <p className="mt-2 text-xs text-red-800/80">
            If this persists, Kleen may need to restore database access policies. Try signing out and back in.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back. Here&apos;s your overview.</p>
        </div>
        <Link href="/job-flow" className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Jobs</h2>
          <Link
            href="/dashboard/jobs"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {recentJobs.length === 0 ? (
            <div className="card py-12 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No jobs yet</p>
              <p className="text-xs text-slate-400">Book your first clean to get started</p>
            </div>
          ) : (
            recentJobs.map((job) => {
              const statusConf = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
              const isRecent = Date.now() - new Date(job.created_at).getTime() < 60 * 60 * 1000;
              const canCancel = CANCELLABLE.includes(job.status);
              return (
                <div
                  key={job.id}
                  className={`card p-0 transition-all ${isRecent ? "ring-2 ring-accent-300/50" : ""}`}
                >
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isRecent ? "bg-accent-100" : "bg-slate-100"}`}>
                        {isRecent ? (
                          <Sparkles className="h-4.5 w-4.5 text-accent-600" />
                        ) : (
                          <Briefcase className="h-4.5 w-4.5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {job.service_name}
                          {isRecent && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700">
                              New
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {job.reference} &middot;{" "}
                          {new Date(job.preferred_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden text-sm font-medium text-slate-700 sm:block">
                        {formatPrice(job.min_price, job.max_price)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusConf.className}`}>
                        {statusConf.label}
                      </span>
                    </div>
                  </Link>

                  {canCancel && (
                    <div className="flex items-center justify-end border-t border-slate-100 px-4 py-2">
                      <button
                        onClick={() => setCancelTarget(job)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {cancelledJobs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Cancelled Jobs</h2>
          <p className="mt-0.5 text-sm text-slate-500">Jobs you or we have cancelled</p>
          <div className="mt-4 space-y-3">
            {cancelledJobs.map((job) => {
              const isRecent = Date.now() - new Date(job.created_at).getTime() < 60 * 60 * 1000;
              return (
                <div
                  key={job.id}
                  className={`card border-red-200 p-0 transition-all opacity-90 ${isRecent ? "ring-1 ring-red-200" : ""}`}
                >
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                        <Briefcase className="h-4.5 w-4.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{job.service_name}</p>
                        <p className="text-xs text-slate-400">
                          {job.reference} &middot;{" "}
                          {new Date(job.preferred_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden text-sm text-slate-500 sm:block">
                        {formatPrice(job.min_price, job.max_price)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        Cancelled
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BookAgainSection />

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setCancelTarget(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCancelTarget(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-900">Cancel Job</h2>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to cancel <span className="font-medium text-slate-700">{cancelTarget.reference}</span>?
              This cannot be undone. You can submit a new job anytime.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Keep Job
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
