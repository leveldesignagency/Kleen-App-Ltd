"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/lib/notifications";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  XCircle,
  X,
  Star,
  AlertTriangle,
  Banknote,
  Check,
} from "lucide-react";

/* ─── Status Config ───────────────────────────────────────────────────────── */

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
  completed:            { label: "Completed",          className: "bg-emerald-100 text-emerald-700" },
  funds_released:       { label: "Complete",           className: "bg-green-100 text-green-700" },
  disputed:             { label: "Disputed",           className: "bg-red-100 text-red-700" },
  cancelled:            { label: "Cancelled",          className: "bg-slate-100 text-slate-500" },
};

const CANCELLABLE = ["pending", "quoted", "awaiting_quotes", "sent_to_customer"];

const WORKFLOW_STEPS = [
  { key: "pending", label: "Submitted" },
  { key: "awaiting_quotes", label: "Getting Quotes" },
  { key: "sent_to_customer", label: "Quotes Available" },
  { key: "customer_accepted", label: "Accepted" },
  { key: "awaiting_completion", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

function getStepIndex(status: string): number {
  const aliases: Record<string, string> = {
    quoted: "awaiting_quotes",
    quotes_received: "awaiting_quotes",
    accepted: "customer_accepted",
    in_progress: "awaiting_completion",
    pending_confirmation: "awaiting_completion",
    funds_released: "completed",
  };
  const normalized = aliases[status] || status;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === normalized);
  return idx >= 0 ? idx : 0;
}

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface JobDetail {
  id: string;
  reference: string;
  service_name: string;
  cleaning_type: string;
  status: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postcode: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  created_at: string;
  min_price: number;
  max_price: number;
  operatives_required: number;
  rooms: number;
  complexity: string;
  accepted_quote_request_id: string | null;
  contractor_confirmed_complete_at: string | null;
  customer_confirmed_complete_at: string | null;
}

interface CustomerQuote {
  id: string;
  quote_request_id: string;
  customer_price_pence: number;
  estimated_hours: number;
  available_date: string | null;
  contractor_rating: number;
  contractor_label: string;
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function CustomerJobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useNotifications((s) => s.push);

  const [job, setJob] = useState<JobDetail | null>(null);
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [declineQuotesModal, setDeclineQuotesModal] = useState(false);
  const [confirmCompleteModal, setConfirmCompleteModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: j } = await supabase
        .from("jobs")
        .select(`
          *,
          job_details(quantity, complexity),
          services(name),
          quotes(min_price_pence, max_price_pence, operatives_required)
        `)
        .eq("id", id as string)
        .eq("user_id", user.id)
        .single();

      if (!j) { setLoading(false); return; }

      setJob({
        id: j.id,
        reference: j.reference || j.id.slice(0, 8).toUpperCase(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service_name: (j as any).services?.name || "Cleaning",
        cleaning_type: j.cleaning_type || "domestic",
        status: j.status,
        address_line_1: j.address_line_1 || "",
        address_line_2: j.address_line_2 || "",
        city: j.city || "",
        postcode: j.postcode || "",
        preferred_date: j.preferred_date || "",
        preferred_time: j.preferred_time || "",
        notes: j.notes || "",
        created_at: j.created_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        min_price: (j as any).quotes?.[0]?.min_price_pence || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        max_price: (j as any).quotes?.[0]?.max_price_pence || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        operatives_required: (j as any).quotes?.[0]?.operatives_required || 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rooms: (j as any).job_details?.[0]?.quantity || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        complexity: (j as any).job_details?.[0]?.complexity || "standard",
        accepted_quote_request_id: j.accepted_quote_request_id || null,
        contractor_confirmed_complete_at: j.contractor_confirmed_complete_at || null,
        customer_confirmed_complete_at: j.customer_confirmed_complete_at || null,
      });

      // Fetch customer-facing quotes (only those with a customer_price_pence set)
      const showQuotes = [
        "sent_to_customer", "customer_accepted", "accepted",
        "awaiting_completion", "in_progress", "pending_confirmation",
        "completed", "funds_released",
      ].includes(j.status);

      if (showQuotes) {
        const { data: qrData } = await supabase
          .from("quote_requests")
          .select("id, operative_id, quote_responses(id, quote_request_id, customer_price_pence, estimated_hours, available_date), operatives(avg_rating)")
          .eq("job_id", id as string)
          .eq("status", "quoted");

        if (qrData) {
          const mapped: CustomerQuote[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          qrData.forEach((qr: any, i: number) => {
            const resp = qr.quote_responses?.[0];
            if (resp?.customer_price_pence) {
              mapped.push({
                id: resp.id,
                quote_request_id: qr.id,
                customer_price_pence: resp.customer_price_pence,
                estimated_hours: resp.estimated_hours || 0,
                available_date: resp.available_date || null,
                contractor_rating: qr.operatives?.avg_rating || 0,
                contractor_label: `Contractor ${String.fromCharCode(65 + i)}`,
              });
            }
          });
          mapped.sort((a, b) => a.customer_price_pence - b.customer_price_pence);
          setQuotes(mapped);
        }
      }

      setLoading(false);
    };
    load();
  }, [id]);

  /* ─── Actions ─────────────────────────────────────────────────────── */

  const handleAcceptQuote = async (q: CustomerQuote) => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("jobs")
      .update({
        status: "customer_accepted",
        accepted_quote_request_id: q.quote_request_id,
        customer_accepted_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (error) {
      toast({ type: "error", title: "Error", message: "Failed to accept quote. Please try again." });
    } else {
      setJob({ ...job, status: "customer_accepted", accepted_quote_request_id: q.quote_request_id });
      toast({ type: "success", title: "Quote Accepted", message: "Your contractor will be notified and the job will begin shortly." });
    }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", job.id);

    if (error) {
      toast({ type: "error", title: "Error", message: "Failed to cancel job." });
    } else {
      setJob({ ...job, status: "cancelled" });
      toast({ type: "info", title: "Job Cancelled", message: `${job.reference} has been cancelled.` });
    }
    setActionLoading(false);
    setCancelModal(false);
  };

  const handleDeclineAllQuotes = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("jobs")
      .update({ status: "cancelled", cancelled_reason: "quotes_declined" })
      .eq("id", job.id);

    if (error) {
      toast({ type: "error", title: "Error", message: "Failed to decline quotes." });
    } else {
      setJob({ ...job, status: "cancelled" });
      toast({ type: "info", title: "Quotes Declined", message: "Quotes declined. You can submit a new job anytime." });
    }
    setActionLoading(false);
    setDeclineQuotesModal(false);
  };

  const handleConfirmComplete = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    const updates: Record<string, string> = {
      customer_confirmed_complete_at: new Date().toISOString(),
    };

    if (job.contractor_confirmed_complete_at) {
      updates.status = "completed";
    } else {
      updates.status = "pending_confirmation";
    }

    const { error } = await supabase.from("jobs").update(updates).eq("id", job.id);

    if (error) {
      toast({ type: "error", title: "Error", message: "Failed to confirm completion." });
    } else {
      setJob({
        ...job,
        status: updates.status,
        customer_confirmed_complete_at: updates.customer_confirmed_complete_at,
      });
      toast({
        type: "success",
        title: updates.status === "completed" ? "Job Complete" : "Confirmation Received",
        message: updates.status === "completed"
          ? "Both parties confirmed. Funds will be released shortly."
          : "Waiting for the contractor to confirm completion.",
      });
    }
    setActionLoading(false);
    setConfirmCompleteModal(false);
  };

  /* ─── Loading / Not Found ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-slate-300" />
        <p className="text-slate-500">Job not found</p>
        <Link href="/dashboard/jobs" className="text-sm font-medium text-brand-600 hover:underline">
          Back to My Jobs
        </Link>
      </div>
    );
  }

  /* ─── Derived State ───────────────────────────────────────────────── */

  const badge = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const canCancel = CANCELLABLE.includes(job.status);
  const isTerminal = ["cancelled", "disputed", "funds_released"].includes(job.status);
  const currentStep = getStepIndex(job.status);
  const showQuotesSection = ["sent_to_customer", "customer_accepted", "accepted", "awaiting_completion", "in_progress", "pending_confirmation", "completed", "funds_released"].includes(job.status);
  const canAcceptQuote = job.status === "sent_to_customer" && !job.accepted_quote_request_id;
  const canConfirmComplete = ["awaiting_completion", "in_progress", "pending_confirmation"].includes(job.status) && !job.customer_confirmed_complete_at;
  const addressParts = [job.address_line_1, job.address_line_2, job.city, job.postcode].filter(Boolean);

  const acceptedQuote = job.accepted_quote_request_id
    ? quotes.find((q) => q.quote_request_id === job.accepted_quote_request_id)
    : null;

  const formatPrice = (pence: number) => `£${(pence / 100).toFixed(2)}`;

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/jobs")}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Jobs
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{job.service_name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono text-xs">{job.reference}</span> &middot; Submitted{" "}
            {new Date(job.created_at).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>

        {canCancel && (
          <button
            onClick={() => setCancelModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            Cancel Job
          </button>
        )}
      </div>

      {/* Workflow Progress */}
      {!isTerminal && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {WORKFLOW_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={step.key} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`h-px w-4 sm:w-8 ${done ? "bg-brand-500" : "bg-slate-200"}`} />
                  )}
                  <div
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                        : done
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {done && !active && <Check className="h-3 w-3" />}
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {job.status === "cancelled" && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
          <XCircle className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-600">This job has been cancelled</p>
          <Link href="/job-flow" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
            Submit a new job
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Job Spec */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Job Details</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoField icon={Sparkles} label="Service" value={job.service_name} />
              <InfoField icon={Sparkles} label="Type" value={job.cleaning_type.replace("_", " ")} />
              <InfoField icon={Sparkles} label="Complexity" value={job.complexity} />
              <InfoField icon={Users} label="Rooms" value={String(job.rooms)} />
              <InfoField icon={Users} label="Operatives" value={String(job.operatives_required)} />
              <InfoField icon={Banknote} label="Estimate" value={job.min_price > 0 ? `${formatPrice(job.min_price)} – ${formatPrice(job.max_price)}` : "—"} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Schedule &amp; Location</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <InfoField
                icon={Calendar}
                label="Preferred Date"
                value={job.preferred_date
                  ? new Date(job.preferred_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : "Flexible"}
              />
              <InfoField icon={Clock} label="Preferred Time" value={job.preferred_time || "Flexible"} />
              <div className="col-span-2">
                <InfoField icon={MapPin} label="Address" value={addressParts.join(", ") || "Not provided"} />
              </div>
            </div>
          </div>

          {job.notes && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
              <p className="mt-2 text-sm text-slate-600">{job.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Quotes + Actions */}
        <div className="space-y-6">
          {/* Quotes Section */}
          {showQuotesSection && quotes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                {canAcceptQuote ? "Choose Your Quote" : "Your Quote"}
              </h2>
              {canAcceptQuote && (
                <p className="mt-1 text-xs text-slate-500">
                  {quotes.length} quote{quotes.length !== 1 ? "s" : ""} available. Select the one that works best for you.
                </p>
              )}

              <div className="mt-4 space-y-3">
                {quotes.map((q, i) => {
                  const isAccepted = job.accepted_quote_request_id === q.quote_request_id;
                  const isBestPrice = i === 0 && canAcceptQuote;

                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        isAccepted
                          ? "border-brand-300 bg-brand-50"
                          : isBestPrice
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{q.contractor_label}</p>
                            {isAccepted && (
                              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                                ACCEPTED
                              </span>
                            )}
                            {isBestPrice && !isAccepted && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                BEST PRICE
                              </span>
                            )}
                          </div>
                          {q.contractor_rating > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                              <Star className="h-3 w-3 fill-current" />
                              {q.contractor_rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <p className="text-xl font-bold text-slate-900">
                          {formatPrice(q.customer_price_pence)}
                        </p>
                      </div>

                      <div className="mt-3 flex gap-4 text-xs text-slate-500">
                        <span>Est. {q.estimated_hours}h</span>
                        {q.available_date && (
                          <span>
                            Available {new Date(q.available_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>

                      {canAcceptQuote && (
                        <button
                          onClick={() => handleAcceptQuote(q)}
                          disabled={actionLoading}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Accept Quote
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {canAcceptQuote && quotes.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <button
                    onClick={() => setDeclineQuotesModal(true)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Decline All Quotes
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Waiting for quotes banner */}
          {["pending", "awaiting_quotes", "quotes_received"].includes(job.status) && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
              <Clock className="mx-auto h-8 w-8 text-blue-500" />
              <p className="mt-2 text-sm font-medium text-blue-700">
                {job.status === "pending" ? "Your job is being reviewed" : "We're collecting quotes for you"}
              </p>
              <p className="mt-1 text-xs text-blue-500">
                You'll be notified as soon as quotes are available.
              </p>
            </div>
          )}

          {/* Confirm Completion */}
          {canConfirmComplete && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <h2 className="text-sm font-semibold text-teal-800">Job Finished?</h2>
              <p className="mt-1 text-xs text-teal-600">
                If the contractor has completed the work to your satisfaction, confirm below.
              </p>
              <button
                onClick={() => setConfirmCompleteModal(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Complete
              </button>
              <p className="mt-2 text-center text-[11px] text-teal-500">
                Not happy? You can <Link href="/dashboard/disputes" className="font-medium underline">raise a dispute</Link> instead.
              </p>
            </div>
          )}

          {/* Already confirmed by customer */}
          {job.customer_confirmed_complete_at && job.status === "pending_confirmation" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-emerald-700">You confirmed completion</p>
              <p className="mt-1 text-xs text-emerald-500">
                Waiting for the contractor to confirm. Funds will be released after both parties agree.
              </p>
            </div>
          )}

          {/* Completed */}
          {(job.status === "completed" || job.status === "funds_released") && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-emerald-700">
                {job.status === "funds_released" ? "Job Complete — Payment Processed" : "Job Complete"}
              </p>
              {acceptedQuote && (
                <p className="mt-1 text-xs text-emerald-500">
                  Final price: {formatPrice(acceptedQuote.customer_price_pence)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Cancel Confirmation Modal ───────────────────────────────── */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCancelModal(false)}>
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setCancelModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Cancel Job</h2>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to cancel <span className="font-medium text-slate-700">{job.reference}</span>?
              This cannot be undone. You can submit a new job anytime.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setCancelModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Keep Job
              </button>
              <button onClick={handleCancel} disabled={actionLoading} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Decline All Quotes Modal ─────────────────────────────────── */}
      {declineQuotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeclineQuotesModal(false)}>
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDeclineQuotesModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Decline All Quotes</h2>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure? You can request new quotes by contacting us. You can also submit a new job anytime.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setDeclineQuotesModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Keep Quotes
              </button>
              <button onClick={handleDeclineAllQuotes} disabled={actionLoading} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Decline All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Completion Modal ────────────────────────────────── */}
      {confirmCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCompleteModal(false)}>
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setConfirmCompleteModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Confirm Completion</h2>
            <p className="mt-2 text-sm text-slate-500">
              Confirm that the work has been completed to your satisfaction. Once both you and the contractor confirm,
              payment will be processed.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirmCompleteModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Not Yet
              </button>
              <button onClick={handleConfirmComplete} disabled={actionLoading} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helper Components ─────────────────────────────────────────────────── */

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div>
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700 capitalize">{value}</p>
      </div>
    </div>
  );
}
