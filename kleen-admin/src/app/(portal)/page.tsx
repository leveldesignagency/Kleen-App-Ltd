"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminStore, AdminJob } from "@/lib/admin-store";
import {
  AlertCircle,
  Briefcase,
  ClipboardList,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
  Plus,
  Loader2,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:              { label: "Pending",             cls: "bg-amber-500/20 text-amber-400" },
  awaiting_quotes:      { label: "Awaiting Quotes",     cls: "bg-blue-500/20 text-blue-400" },
  quotes_received:      { label: "Quotes Received",     cls: "bg-indigo-500/20 text-indigo-400" },
  quoted:               { label: "Quotes Received",     cls: "bg-indigo-500/20 text-indigo-400" },
  sent_to_customer:     { label: "Sent to Customer",    cls: "bg-violet-500/20 text-violet-400" },
  customer_accepted:    { label: "Customer Accepted",   cls: "bg-brand-500/20 text-brand-400" },
  accepted:             { label: "Customer Accepted",   cls: "bg-brand-500/20 text-brand-400" },
  awaiting_completion:  { label: "In Progress",         cls: "bg-cyan-500/20 text-cyan-400" },
  in_progress:          { label: "In Progress",         cls: "bg-cyan-500/20 text-cyan-400" },
  pending_confirmation: { label: "Confirming",          cls: "bg-teal-500/20 text-teal-400" },
  completed:            { label: "Completed",           cls: "bg-emerald-500/20 text-emerald-400" },
  funds_released:       { label: "Funds Released",      cls: "bg-green-500/20 text-green-400" },
  scheduled:            { label: "Scheduled",           cls: "bg-indigo-500/20 text-indigo-400" },
  disputed:             { label: "Disputed",            cls: "bg-red-500/20 text-red-400" },
  cancelled:            { label: "Cancelled",           cls: "bg-slate-500/20 text-slate-400" },
};

export default function AdminDashboardPage() {
  const { jobs, setJobs, contractors, setContractors } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      const supabase = createClient();

      const [jobsRes, contractorsRes] = await Promise.all([
        supabase.from("jobs").select("*, job_details(*), profiles!user_id(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)").order("created_at", { ascending: false }),
        supabase.from("operatives").select("*").order("created_at", { ascending: false }),
      ]);

      const err = jobsRes.error?.message || contractorsRes.error?.message;
      if (err) setLoadError(err);
      if (jobsRes.error) {
        setLoading(false);
        return;
      }
      if (jobsRes.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: AdminJob[] = jobsRes.data.map((j: any) => ({
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
        }));
        setJobs(mapped);
      }

      if (contractorsRes.data) {
        setContractors(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contractorsRes.data.map((c: any) => ({
            id: c.id,
            user_id: c.user_id,
            full_name: c.full_name || "Unknown",
            email: c.email || "",
            phone: c.phone || "",
            contractor_type: c.contractor_type || "sole_trader",
            company_name: c.company_name || "",
            specialisations: c.specialisations || [],
            service_areas: c.service_areas || [],
            rating: c.avg_rating || 0,
            total_jobs: c.total_jobs || 0,
            hourly_rate: c.hourly_rate,
            is_active: c.is_active ?? true,
            is_verified: c.is_verified ?? false,
            notes: c.notes || "",
            bank_account_name: c.bank_account_name || "",
            bank_sort_code: c.bank_sort_code || "",
            bank_account_number: c.bank_account_number || "",
            company_number: c.company_number || "",
            vat_number: c.vat_number || "",
            utr_number: c.utr_number || "",
            stripe_account_id: c.stripe_account_id || "",
            created_at: c.created_at,
          }))
        );
      }

      setLoading(false);
    };
    load();
  }, [setJobs, setContractors]);

  const pendingCount = jobs.filter((j) => j.status === "pending").length;
  const activeQuotes = jobs.filter((j) =>
    ["awaiting_quotes", "quotes_received", "quoted", "sent_to_customer"].includes(j.status)
  ).length;
  const revenue = jobs
    .filter((j) => j.status === "completed")
    .reduce((sum, j) => sum + j.price_estimate, 0);

  const stats = [
    { label: "Total Jobs",        value: String(jobs.length),           icon: Briefcase,     color: "text-brand-400  bg-brand-500/20" },
    { label: "Pending Review",    value: String(pendingCount),          icon: Clock,          color: "text-amber-400  bg-amber-500/20" },
    { label: "Active Quotes",     value: String(activeQuotes),          icon: ClipboardList,  color: "text-blue-400   bg-blue-500/20" },
    { label: "Contractors",       value: String(contractors.length),    icon: Users,          color: "text-violet-400 bg-violet-500/20" },
    { label: "Revenue",           value: `£${(revenue / 100).toFixed(0)}`, icon: TrendingUp,  color: "text-emerald-400 bg-emerald-500/20" },
  ];

  const recentJobs = jobs.slice(0, 10);

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
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">KLEEN operations overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            <ClipboardList className="h-4 w-4" />
            View Pending
          </Link>
          <Link
            href="/contractors"
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Add Contractor
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
            >
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="mt-3 text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Jobs */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>
          <Link
            href="/jobs"
            className="flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {recentJobs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">No jobs submitted yet</p>
              <p className="text-xs text-slate-500">
                Jobs will appear here when customers submit them
              </p>
            </div>
          ) : (
            recentJobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                      <Briefcase className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {job.service}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {job.reference}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {job.customer_name} &middot;{" "}
                        {new Date(job.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-sm font-medium text-slate-300 sm:block">
                      £{(job.price_estimate / 100).toFixed(0)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
