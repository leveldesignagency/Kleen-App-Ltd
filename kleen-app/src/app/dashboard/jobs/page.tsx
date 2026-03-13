"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/lib/notifications";
import {
  Briefcase,
  Plus,
  Search,
  Loader2,
  XCircle,
  X,
} from "lucide-react";

type JobStatus = "all" | "pending" | "awaiting_quotes" | "sent_to_customer" | "customer_accepted" | "awaiting_completion" | "quoted" | "accepted" | "in_progress" | "completed" | "funds_released" | "disputed" | "cancelled";

interface Job {
  id: string;
  reference: string;
  service_name: string;
  status: string;
  preferred_date: string;
  address_line_1: string;
  postcode: string;
  min_price: number;
  max_price: number;
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

const FILTER_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "all", label: "All Jobs" },
  { value: "pending", label: "Pending" },
  { value: "awaiting_quotes", label: "Getting Quotes" },
  { value: "sent_to_customer", label: "Quotes Available" },
  { value: "awaiting_completion", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const CANCELLABLE = ["pending", "quoted", "awaiting_quotes", "sent_to_customer"];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JobStatus>("all");
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Job | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const pushNotification = useNotifications((s) => s.push);

  useEffect(() => {
    const supabase = createClient();
    let channel: { unsubscribe: () => void } | null = null;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const fetchJobs = async () => {
        const { data } = await supabase
          .from("jobs")
          .select("id, reference, service_id, status, preferred_date, address_line_1, postcode, services(name), quotes(min_price_pence, max_price_pence)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setJobs(data.map((j: any) => ({
            id: j.id,
            reference: j.reference,
            service_name: j.services?.name || "Cleaning",
            status: j.status,
            preferred_date: j.preferred_date,
            address_line_1: j.address_line_1 || "",
            postcode: j.postcode || "",
            min_price: j.quotes?.[0]?.min_price_pence || 0,
            max_price: j.quotes?.[0]?.max_price_pence || 0,
          })));
        }
      };

      await fetchJobs();
      setLoading(false);

      channel = supabase
        .channel("jobs-list")
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

  const filtered = jobs.filter((job) => {
    if (filter !== "all" && job.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !job.service_name.toLowerCase().includes(q) &&
        !job.reference.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const formatPrice = (pence: number) => `£${(pence / 100).toFixed(0)}`;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Jobs</h1>
          <p className="mt-1 text-sm text-slate-500">View and manage all your cleaning jobs</p>
        </div>
        <Link href="/job-flow" className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filter === opt.value
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="card py-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No jobs found</p>
            <p className="text-xs text-slate-400">Book your first clean to get started</p>
          </div>
        ) : (
          filtered.map((job) => {
            const statusConf = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
            const canCancel = CANCELLABLE.includes(job.status);
            return (
              <div key={job.id} className="card p-0">
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                      <Briefcase className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{job.service_name}</p>
                      <p className="text-xs text-slate-400">
                        {job.reference} &middot; {job.address_line_1}, {job.postcode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-slate-700">
                        {job.min_price > 0
                          ? `${formatPrice(job.min_price)}–${formatPrice(job.max_price)}`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(job.preferred_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusConf.className}`}>
                      {statusConf.label}
                    </span>
                  </div>
                </Link>

                {canCancel && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                    <p className="text-xs text-slate-400">
                      Want to make changes? Cancel and submit a new job.
                    </p>
                    <button
                      onClick={() => setCancelTarget(job)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel Job
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
