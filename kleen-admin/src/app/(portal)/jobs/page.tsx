"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminStore, AdminJob } from "@/lib/admin-store";
import {
  AlertCircle,
  Briefcase,
  Search,
  Filter,
  Loader2,
  Eye,
  X,
  ExternalLink,
} from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

const STATUS_OPTIONS = [
  "all",
  "pending",
  "awaiting_quotes",
  "quotes_received",
  "sent_to_customer",
  "customer_accepted",
  "awaiting_completion",
  "pending_confirmation",
  "completed",
  "funds_released",
  "disputed",
  "cancelled",
] as const;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:              { label: "Pending",              cls: "bg-amber-500/20 text-amber-400" },
  awaiting_quotes:      { label: "Awaiting Quotes",      cls: "bg-blue-500/20 text-blue-400" },
  quotes_received:      { label: "Quotes Received",      cls: "bg-indigo-500/20 text-indigo-400" },
  quoted:               { label: "Quotes Received",      cls: "bg-indigo-500/20 text-indigo-400" },
  sent_to_customer:     { label: "Sent to Customer",     cls: "bg-violet-500/20 text-violet-400" },
  customer_accepted:    { label: "Customer Accepted",    cls: "bg-brand-500/20 text-brand-400" },
  accepted:             { label: "Customer Accepted",    cls: "bg-brand-500/20 text-brand-400" },
  awaiting_completion:  { label: "In Progress",          cls: "bg-cyan-500/20 text-cyan-400" },
  in_progress:          { label: "In Progress",          cls: "bg-cyan-500/20 text-cyan-400" },
  pending_confirmation: { label: "Confirming",           cls: "bg-teal-500/20 text-teal-400" },
  completed:            { label: "Completed",            cls: "bg-emerald-500/20 text-emerald-400" },
  funds_released:       { label: "Funds Released",       cls: "bg-green-500/20 text-green-400" },
  disputed:             { label: "Disputed",             cls: "bg-red-500/20 text-red-400" },
  cancelled:            { label: "Cancelled",            cls: "bg-slate-500/20 text-slate-400" },
  scheduled:            { label: "Scheduled",            cls: "bg-indigo-500/20 text-indigo-400" },
};

export default function AdminJobsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);
  const { jobs, setJobs } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: { unsubscribe: () => void } | null = null;

    const load = async () => {
      setLoadError(null);
      const { data, error } = await supabase
        .from("jobs")
        .select("*, job_details(*), profiles!user_id(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)")
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message || "Failed to load jobs");
        setLoading(false);
        return;
      }
      if (data) {
        setJobs(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((j: any) => ({
            id: j.id,
            reference: j.reference || j.id.slice(0, 8).toUpperCase(),
            service: j.services?.name || "Cleaning",
            cleaning_type: j.cleaning_type || "domestic",
            status: j.status,
            customer_name: j.profiles?.full_name || "Unknown",
            customer_email: j.profiles?.email || "",
            address: [j.address_line_1, j.address_line_2, j.city].filter(Boolean).join(", "),
            postcode: j.postcode || "",
            date: j.preferred_date || j.created_at,
            time: j.preferred_time || "",
            price_estimate: j.quotes?.[0] ? Math.round((j.quotes[0].min_price_pence + j.quotes[0].max_price_pence) / 2) : 0,
            rooms: j.job_details?.[0]?.quantity || 0,
            operatives: j.quotes?.[0]?.operatives_required || 1,
            complexity: j.job_details?.[0]?.complexity || "standard",
            notes: j.notes || "",
            created_at: j.created_at,
            is_blocked: j.profiles?.is_blocked || false,
          }))
        );
      }
      setLoading(false);
    };

    load().then(() => {
      channel = supabase
        .channel("admin-jobs-list")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "jobs" },
          () => load()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "jobs" },
          () => load()
        )
        .subscribe();
    });

    const onFocus = () => load();
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") load();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      if (channel) channel.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [setJobs]);

  // Refetch when navigating back to the jobs list from a child page (e.g. after sending quotes) so status is up to date
  useEffect(() => {
    const prev = prevPathname.current;
    prevPathname.current = pathname;
    if (pathname !== "/jobs") return;
    const cameFromChild = prev != null && prev !== "/jobs";
    if (!cameFromChild) return;
    const supabase = createClient();
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*, job_details(*), profiles!user_id(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)")
        .order("created_at", { ascending: false });
      if (cancelled || !data) return;
      setJobs(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((j: any) => ({
          id: j.id,
          reference: j.reference || j.id.slice(0, 8).toUpperCase(),
          service: j.services?.name || "Cleaning",
          cleaning_type: j.cleaning_type || "domestic",
          status: j.status,
          customer_name: j.profiles?.full_name || "Unknown",
          customer_email: j.profiles?.email || "",
          address: [j.address_line_1, j.address_line_2, j.city].filter(Boolean).join(", "),
          postcode: j.postcode || "",
          date: j.preferred_date || j.created_at,
          time: j.preferred_time || "",
          price_estimate: j.quotes?.[0] ? Math.round((j.quotes[0].min_price_pence + j.quotes[0].max_price_pence) / 2) : 0,
          rooms: j.job_details?.[0]?.quantity || 0,
          operatives: j.quotes?.[0]?.operatives_required || 1,
          complexity: j.job_details?.[0]?.complexity || "standard",
          notes: j.notes || "",
          created_at: j.created_at,
          is_blocked: j.profiles?.is_blocked || false,
        }))
      );
    };
    load();
    return () => { cancelled = true; };
  }, [pathname, setJobs]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (statusFilter !== "all") {
      list = list.filter((j) => j.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.reference.toLowerCase().includes(q) ||
          j.service.toLowerCase().includes(q) ||
          j.customer_name.toLowerCase().includes(q) ||
          j.customer_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="mt-1 text-sm text-slate-400">
            {jobs.length} total &middot; {jobs.filter((j) => j.status === "pending").length} pending
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, service, customer…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
          />
        </div>
        <CustomDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: s === "all" ? "All Statuses" : STATUS_BADGE[s]?.label || s,
          }))}
          icon={Filter}
          className="w-52"
        />
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 font-medium text-slate-400">Reference</th>
                <th className="px-4 py-3 font-medium text-slate-400">Service</th>
                <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">Customer</th>
                <th className="hidden px-4 py-3 font-medium text-slate-400 lg:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Briefcase className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2">No jobs found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((job) => {
                  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-white/[0.06]"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {job.reference}
                      </td>
                      <td className="px-4 py-3 font-medium">{job.service}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div>
                          <p className="text-sm">{job.customer_name}</p>
                          <p className="text-xs text-slate-500">{job.customer_email}</p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-400 lg:table-cell">
                        {new Date(job.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {job.is_blocked && (
                          <span className="ml-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                            BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                            title="Quick view"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="rounded-lg p-1.5 text-brand-400 transition-colors hover:bg-brand-500/20"
                            title="Open job"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick View Modal */}
      {selectedJob && (
        <JobQuickView job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

function JobQuickView({ job, onClose }: { job: AdminJob; onClose: () => void }) {
  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold">Job Details</h2>
        <p className="text-xs text-slate-500 font-mono">{job.reference}</p>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Service" value={job.service} />
          <Field label="Type" value={job.cleaning_type} />
          <Field label="Customer" value={job.customer_name} />
          <Field label="Email" value={job.customer_email} />
          <Field label="Scheduled" value={`${new Date(job.date).toLocaleDateString("en-GB")} ${job.time}`} />
          <Field label="Complexity" value={job.complexity} />
          <Field label="Rooms" value={String(job.rooms)} />
          <Field label="Operatives" value={String(job.operatives)} />
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <span className={`mt-0.5 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>

        {job.notes && (
          <div className="mt-4 rounded-xl bg-white/5 p-3">
            <p className="text-xs text-slate-500">Notes</p>
            <p className="mt-1 text-sm text-slate-300">{job.notes}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Link
            href={`/jobs/${job.id}`}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            <ExternalLink className="h-4 w-4" />
            Open Full View
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
