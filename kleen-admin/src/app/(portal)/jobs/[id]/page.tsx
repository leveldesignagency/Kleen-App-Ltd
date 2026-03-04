"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAdminStore, Contractor, QuoteRequest } from "@/lib/admin-store";
import { useAdminNotifications } from "@/lib/admin-notifications";
import {
  ArrowLeft,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  Eye,
  X,
  ChevronDown,
  BarChart3,
  AlertCircle,
  Check,
  Search,
  Plus,
  Forward,
  Banknote,
  UserCheck,
  ShieldCheck,
  XCircle,
  RefreshCw,
} from "lucide-react";

const SERVICE_FEE_RATE = 0.175; // 17.5%

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:              { label: "Pending",              cls: "bg-amber-500/20 text-amber-400" },
  awaiting_quotes:      { label: "Awaiting Quotes",      cls: "bg-blue-500/20 text-blue-400" },
  quoted:               { label: "Quotes Received",      cls: "bg-indigo-500/20 text-indigo-400" },
  quotes_received:      { label: "Quotes Received",      cls: "bg-indigo-500/20 text-indigo-400" },
  sent_to_customer:     { label: "Sent to Customer",     cls: "bg-violet-500/20 text-violet-400" },
  customer_accepted:    { label: "Customer Accepted",    cls: "bg-brand-500/20 text-brand-400" },
  accepted:             { label: "Customer Accepted",    cls: "bg-brand-500/20 text-brand-400" },
  awaiting_completion:  { label: "Awaiting Completion",  cls: "bg-cyan-500/20 text-cyan-400" },
  in_progress:          { label: "In Progress",          cls: "bg-cyan-500/20 text-cyan-400" },
  pending_confirmation: { label: "Confirming Complete",  cls: "bg-teal-500/20 text-teal-400" },
  completed:            { label: "Completed",            cls: "bg-emerald-500/20 text-emerald-400" },
  funds_released:       { label: "Funds Released",       cls: "bg-green-500/20 text-green-400" },
  disputed:             { label: "Disputed",             cls: "bg-red-500/20 text-red-400" },
  cancelled:            { label: "Cancelled",            cls: "bg-slate-500/20 text-slate-400" },
  scheduled:            { label: "Scheduled",            cls: "bg-indigo-500/20 text-indigo-400" },
};

const QR_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  sent:     { label: "Sent",     cls: "bg-blue-500/20 text-blue-400" },
  viewed:   { label: "Viewed",   cls: "bg-indigo-500/20 text-indigo-400" },
  quoted:   { label: "Quoted",   cls: "bg-emerald-500/20 text-emerald-400" },
  declined: { label: "Declined", cls: "bg-red-500/20 text-red-400" },
  expired:  { label: "Expired",  cls: "bg-slate-500/20 text-slate-400" },
};

const DEADLINE_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
  { label: "1 week", hours: 168 },
];

const WORKFLOW_STEPS = [
  { key: "pending", label: "Submitted" },
  { key: "awaiting_quotes", label: "Sent to Contractors" },
  { key: "quotes_received", label: "Quotes Received" },
  { key: "sent_to_customer", label: "Sent to Customer" },
  { key: "customer_accepted", label: "Customer Accepted" },
  { key: "awaiting_completion", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "funds_released", label: "Funds Released" },
];

function getStepIndex(status: string): number {
  const aliases: Record<string, string> = {
    quoted: "quotes_received",
    accepted: "customer_accepted",
    in_progress: "awaiting_completion",
    pending_confirmation: "completed",
  };
  const normalized = aliases[status] || status;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === normalized);
  return idx >= 0 ? idx : 0;
}

export default function AdminJobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const {
    jobs,
    contractors,
    quoteRequests,
    setJobs,
    setContractors,
    setQuoteRequests,
    updateJob,
    updateQuoteRequest,
    addQuoteRequest,
  } = useAdminStore();

  const [loading, setLoading] = useState(true);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [selectedContractors, setSelectedContractors] = useState<string[]>([]);
  const [deadlineHours, setDeadlineHours] = useState(48);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [enteringResponseFor, setEnteringResponseFor] = useState<string | null>(null);
  const [responseForm, setResponseForm] = useState({ pricePounds: "", hours: "", availableDate: "", notes: "" });
  const toast = useAdminNotifications((s) => s.push);

  const job = jobs.find((j) => j.id === id);
  const quoteRequestsList = Array.isArray(quoteRequests) ? quoteRequests : [];
  const jobQuotes = useMemo(
    () => quoteRequestsList.filter((qr) => qr.job_id === id),
    [quoteRequestsList, id]
  );
  const activeContractors = contractors.filter((c) => c.is_active);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      if (jobs.length === 0) {
        const { data: jobsData } = await supabase
          .from("jobs")
          .select("*, job_details(*), profiles(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)")
          .order("created_at", { ascending: false });

        if (jobsData) {
          setJobs(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jobsData.map((j: any) => ({
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
      }

      if (contractors.length === 0) {
        const { data: opsData } = await supabase
          .from("operatives")
          .select("*")
          .order("created_at", { ascending: false });

        if (opsData) {
          setContractors(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            opsData.map((c: any) => ({
              id: c.id,
              user_id: c.user_id,
              full_name: c.full_name || "",
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
              created_at: c.created_at,
            }))
          );
        }
      }

      const { data: qrData } = await supabase
        .from("quote_requests")
        .select("*, quote_responses(*), operatives(full_name)")
        .eq("job_id", id as string)
        .order("created_at", { ascending: false });

      if (qrData) {
        setQuoteRequests(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          qrData.map((qr: any) => ({
            id: qr.id,
            job_id: qr.job_id,
            operative_id: qr.operative_id,
            operative_name: qr.operatives?.full_name || "Unknown",
            status: qr.status,
            deadline: qr.deadline,
            message: qr.message,
            sent_at: qr.sent_at,
            viewed_at: qr.viewed_at,
            responded_at: qr.responded_at,
            quote_response: qr.quote_responses?.[0] || undefined,
          }))
        );
      }

      setLoading(false);
    };
    load();
  }, [id, jobs.length, contractors.length, setJobs, setContractors, setQuoteRequests]);

  const refreshJobData = useCallback(async () => {
    const supabase = createClient();
    const { data: j } = await supabase
      .from("jobs")
      .select("*, job_details(*), profiles(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)")
      .eq("id", id as string)
      .single();
    if (j) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: any = {
        id: j.id,
        reference: j.reference || j.id.slice(0, 8).toUpperCase(),
        service: (j as any).services?.name || "Cleaning",
        cleaning_type: j.cleaning_type || "domestic",
        status: j.status,
        customer_name: (j as any).profiles?.full_name || "Unknown",
        customer_email: (j as any).profiles?.email || "",
        address: [j.address_line_1, j.address_line_2, j.city].filter(Boolean).join(", "),
        postcode: j.postcode || "",
        date: j.preferred_date || j.created_at,
        time: j.preferred_time || "",
        price_estimate: (j as any).quotes?.[0] ? Math.round(((j as any).quotes[0].min_price_pence + (j as any).quotes[0].max_price_pence) / 2) : 0,
        rooms: (j as any).job_details?.[0]?.quantity || 0,
        operatives: (j as any).quotes?.[0]?.operatives_required || 1,
        complexity: (j as any).job_details?.[0]?.complexity || "standard",
        notes: j.notes || "",
        created_at: j.created_at,
        is_blocked: (j as any).profiles?.is_blocked || false,
      };
      updateJob(j.id, mapped);
    }
    const { data: qrData } = await supabase
      .from("quote_requests")
      .select("*, quote_responses(*), operatives(full_name)")
      .eq("job_id", id as string)
      .order("created_at", { ascending: false });
    if (qrData) {
      const mapped = qrData.map((qr: { id: string; job_id: string; operative_id: string; operatives?: { full_name?: string }; status: string; deadline: string; message?: string; sent_at: string; viewed_at?: string; responded_at?: string; quote_responses?: Array<{ id: string; quote_request_id: string; price_pence: number; customer_price_pence?: number; estimated_hours: number; available_date?: string; notes?: string; created_at: string }> }) => ({
        id: qr.id,
        job_id: qr.job_id,
        operative_id: qr.operative_id,
        operative_name: qr.operatives?.full_name || "Unknown",
        status: qr.status,
        deadline: qr.deadline,
        message: qr.message,
        sent_at: qr.sent_at,
        viewed_at: qr.viewed_at,
        responded_at: qr.responded_at,
        quote_response: qr.quote_responses?.[0] || undefined,
      }));
      setQuoteRequests((prev) => (Array.isArray(prev) ? prev : []).filter((q) => q.job_id !== id).concat(mapped));
    }
  }, [id, updateJob, setQuoteRequests]);

  useEffect(() => {
    if (!id || loading) return;
    const interval = setInterval(refreshJobData, 30000);
    return () => clearInterval(interval);
  }, [id, loading, refreshJobData]);

  const handleSendQuotes = async () => {
    if (selectedContractors.length === 0 || !job) return;
    setSending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const deadline = new Date(Date.now() + deadlineHours * 3600 * 1000).toISOString();

    for (const opId of selectedContractors) {
      const existing = jobQuotes.find((qr) => qr.operative_id === opId);
      if (existing) continue;

      const { data: inserted } = await supabase
        .from("quote_requests")
        .insert({
          job_id: job.id,
          operative_id: opId,
          sent_by: user?.id,
          deadline,
          message: quoteMessage || null,
        })
        .select("*, operatives(full_name)")
        .single();

      if (inserted) {
        addQuoteRequest({
          id: inserted.id,
          job_id: inserted.job_id,
          operative_id: inserted.operative_id,
          operative_name: inserted.operatives?.full_name || "Unknown",
          status: "sent",
          deadline: inserted.deadline,
          message: inserted.message,
          sent_at: inserted.sent_at,
        });
      }
    }

    const newStatus = job.status === "pending" ? "awaiting_quotes" : job.status;
    if (newStatus !== job.status) {
      await supabase.from("jobs").update({ status: newStatus }).eq("id", job.id);
      updateJob(job.id, { status: newStatus });
    }

    toast({
      type: "success",
      title: "Quote Requests Sent",
      message: `Sent to ${selectedContractors.length} contractor(s)`,
    });

    setSending(false);
    setShowSendPanel(false);
    setSelectedContractors([]);
    setQuoteMessage("");
  };

  const handleSendToCustomer = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    // Calculate customer prices (contractor price + 17.5%) for each quoted response
    for (const qr of quotedResponses) {
      if (qr.quote_response && !qr.quote_response.customer_price_pence) {
        const customerPrice = Math.round(qr.quote_response.price_pence * (1 + SERVICE_FEE_RATE));
        await supabase
          .from("quote_responses")
          .update({ customer_price_pence: customerPrice })
          .eq("id", qr.quote_response.id);
      }
    }

    await supabase
      .from("jobs")
      .update({ status: "sent_to_customer", quotes_sent_to_customer_at: new Date().toISOString() })
      .eq("id", job.id);

    updateJob(job.id, { status: "sent_to_customer" });
    toast({ type: "success", title: "Quotes Sent to Customer", message: "Customer will be notified to choose a quote" });
    setActionLoading(false);
  };

  const handleForwardToContractor = async (qr: QuoteRequest) => {
    if (!job || !qr.quote_response) return;
    setActionLoading(true);
    const supabase = createClient();

    await supabase
      .from("jobs")
      .update({
        status: "awaiting_completion",
        accepted_quote_request_id: qr.id,
        customer_accepted_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await supabase
      .from("job_assignments")
      .upsert({
        job_id: job.id,
        operative_id: qr.operative_id,
        assigned_at: new Date().toISOString(),
      }, { onConflict: "job_id,operative_id" });

    updateJob(job.id, { status: "awaiting_completion" });
    toast({ type: "success", title: "Forwarded to Contractor", message: `${qr.operative_name} has been notified to begin work` });
    setActionLoading(false);
  };

  const handleEnterQuoteResponse = async (quoteRequestId: string) => {
    const pricePence = Math.round(parseFloat(responseForm.pricePounds || "0") * 100);
    if (pricePence <= 0) {
      toast({ type: "error", title: "Invalid price", message: "Enter a valid price in pounds." });
      return;
    }
    setActionLoading(true);
    const supabase = createClient();

    const { data: inserted, error: insertError } = await supabase
      .from("quote_responses")
      .insert({
        quote_request_id: quoteRequestId,
        price_pence: pricePence,
        estimated_hours: responseForm.hours ? parseFloat(responseForm.hours) : null,
        available_date: responseForm.availableDate || null,
        notes: responseForm.notes || null,
      })
      .select()
      .single();

    if (insertError) {
      toast({ type: "error", title: "Failed to save quote", message: insertError.message });
      setActionLoading(false);
      return;
    }

    const respondedAt = new Date().toISOString();
    await supabase
      .from("quote_requests")
      .update({ status: "quoted", responded_at: respondedAt })
      .eq("id", quoteRequestId);

    const qr = jobQuotes.find((x) => x.id === quoteRequestId);
    if (qr) {
      updateQuoteRequest(quoteRequestId, {
        status: "quoted",
        responded_at: respondedAt,
        quote_response: {
          id: inserted.id,
          quote_request_id: quoteRequestId,
          price_pence: pricePence,
          estimated_hours: responseForm.hours ? parseFloat(responseForm.hours) : 0,
          available_date: responseForm.availableDate || undefined,
          notes: responseForm.notes || undefined,
          created_at: inserted.created_at,
        },
      });
    }

    const allForJob = quoteRequestsList.filter((x) => x.job_id === id);
    const updatedAll = allForJob.map((x) =>
      x.id === quoteRequestId ? { ...x, status: "quoted" as const, responded_at: respondedAt, quote_response: inserted } : x
    );
    const terminalStatuses = ["quoted", "declined", "expired"];
    const allResponded = updatedAll.every((x) => terminalStatuses.includes(x.status));
    if (allResponded && job) {
      await supabase.from("jobs").update({ status: "quotes_received" }).eq("id", job.id);
      updateJob(job.id, { status: "quotes_received" });
    }

    setEnteringResponseFor(null);
    setResponseForm({ pricePounds: "", hours: "", availableDate: "", notes: "" });
    toast({ type: "success", title: "Quote recorded", message: "Contractor quote has been saved." });
    setActionLoading(false);
  };

  const handleMarkDeclined = async (quoteRequestId: string) => {
    setActionLoading(true);
    const supabase = createClient();
    await supabase.from("quote_requests").update({ status: "declined" }).eq("id", quoteRequestId);
    const qr = jobQuotes.find((x) => x.id === quoteRequestId);
    if (qr) updateQuoteRequest(quoteRequestId, { status: "declined" });

    const allForJob = quoteRequestsList.filter((x) => x.job_id === id);
    const updatedAll = allForJob.map((x) => (x.id === quoteRequestId ? { ...x, status: "declined" as const } : x));
    const terminalStatuses = ["quoted", "declined", "expired"];
    const allResponded = updatedAll.every((x) => terminalStatuses.includes(x.status));
    if (allResponded && job) {
      await supabase.from("jobs").update({ status: "quotes_received" }).eq("id", job.id);
      updateJob(job.id, { status: "quotes_received" });
    }
    toast({ type: "info", title: "Marked declined", message: "Contractor has been marked as declined." });
    setActionLoading(false);
  };

  const handleConfirmCompletion = async (confirmedBy: "contractor" | "customer") => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    const updates: Record<string, string> = {};
    if (confirmedBy === "contractor") {
      updates.contractor_confirmed_complete_at = new Date().toISOString();
    } else {
      updates.customer_confirmed_complete_at = new Date().toISOString();
    }

    const { data: current } = await supabase
      .from("jobs")
      .select("contractor_confirmed_complete_at, customer_confirmed_complete_at")
      .eq("id", job.id)
      .single();

    const bothConfirmed =
      (confirmedBy === "contractor" && current?.customer_confirmed_complete_at) ||
      (confirmedBy === "customer" && current?.contractor_confirmed_complete_at);

    if (bothConfirmed) {
      updates.status = "completed";
    } else {
      updates.status = "pending_confirmation";
    }

    await supabase.from("jobs").update(updates).eq("id", job.id);
    updateJob(job.id, { status: updates.status });
    toast({
      type: bothConfirmed ? "success" : "info",
      title: bothConfirmed ? "Job Completed" : "Confirmation Received",
      message: bothConfirmed ? "Both parties confirmed. Ready to release funds." : `${confirmedBy === "contractor" ? "Contractor" : "Customer"} confirmed completion. Waiting for the other party.`,
    });
    setActionLoading(false);
  };

  const handleReleaseFunds = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();

    // TODO: Integrate Stripe payout here
    await supabase
      .from("jobs")
      .update({ status: "funds_released", funds_released_at: new Date().toISOString() })
      .eq("id", job.id);

    updateJob(job.id, { status: "funds_released" });
    toast({ type: "success", title: "Funds Released", message: "Payment has been sent to the contractor" });
    setActionLoading(false);
  };

  const handleCancelJob = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", job.id);
    updateJob(job.id, { status: "cancelled" });
    toast({ type: "info", title: "Job Cancelled", message: `${job.reference} has been cancelled` });
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-slate-600" />
        <p className="text-slate-400">Job not found</p>
        <Link href="/jobs" className="text-sm text-brand-400 hover:underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
  const sentCount = jobQuotes.length;
  const respondedCount = jobQuotes.filter((q) => q.status === "quoted").length;
  const pendingCount = jobQuotes.filter((q) => q.status === "sent" || q.status === "viewed").length;
  const quotedResponses = jobQuotes.filter((q) => q.quote_response);
  const postcodeArea = job.postcode ? job.postcode.split(" ")[0] : "N/A";
  const currentStep = getStepIndex(job.status);
  const isTerminal = ["cancelled", "disputed", "funds_released"].includes(job.status);

  return (
    <div>
      <button
        onClick={() => router.push("/jobs")}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{job.service}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            <span className="font-mono">{job.reference}</span> &middot; Submitted{" "}
            {new Date(job.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && job.status !== "completed" && (
            <button
              onClick={handleCancelJob}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
          <button
            onClick={() => refreshJobData()}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
            title="Refresh job and quote data"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {job.status === "pending" && (
            <button
              onClick={() => setShowSendPanel(true)}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
              <Send className="h-4 w-4" />
              Send for Quotes
            </button>
          )}
        </div>
      </div>

      {/* Workflow Progress */}
      {!isTerminal && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {WORKFLOW_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={step.key} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`h-px w-4 sm:w-8 ${done ? "bg-brand-500" : "bg-white/10"}`} />
                  )}
                  <div
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/40"
                        : done
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-slate-500"
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

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Spec */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-slate-300">Job Specification</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Service" value={job.service} />
              <Field label="Type" value={job.cleaning_type} />
              <Field label="Complexity" value={job.complexity} />
              <Field label="Rooms" value={String(job.rooms)} />
              <Field label="Operatives" value={String(job.operatives)} />
              <Field label="Estimate" value={`£${(job.price_estimate / 100).toFixed(2)}`} />
              <Field label="Scheduled Date" value={new Date(job.date).toLocaleDateString("en-GB")} />
              <Field label="Time" value={job.time || "Flexible"} />
              <Field label="Postcode Area" value={postcodeArea} />
            </div>
            {job.notes && (
              <div className="mt-4 rounded-xl bg-white/5 p-3">
                <p className="text-xs text-slate-500">Notes</p>
                <p className="mt-1 text-sm text-slate-300">{job.notes}</p>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-slate-300">Customer</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Name" value={job.customer_name} />
              <Field label="Email" value={job.customer_email} />
              <Field label="Address" value={job.address || "Not provided"} />
              <Field label="Postcode" value={job.postcode || "—"} />
            </div>
          </div>

          {/* Anonymised Preview */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-300">Contractor Preview (Anonymised)</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              This is what contractors see — no customer name, address, or business details.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <MiniField label="Service" value={job.service} />
              <MiniField label="Type" value={job.cleaning_type} />
              <MiniField label="Complexity" value={job.complexity} />
              <MiniField label="Rooms" value={String(job.rooms)} />
              <MiniField label="Operatives" value={String(job.operatives)} />
              <MiniField label="Area" value={postcodeArea} />
              <MiniField label="Estimate" value={`£${(job.price_estimate / 100).toFixed(2)}`} />
            </div>
          </div>
        </div>

        {/* Right column: Actions & Quote Tracking */}
        <div className="space-y-6">
          {/* Context-sensitive Action Card */}
          <WorkflowActions
            job={job}
            quotedResponses={quotedResponses}
            actionLoading={actionLoading}
            onSendForQuotes={() => setShowSendPanel(true)}
            onSendToCustomer={handleSendToCustomer}
            onForwardToContractor={handleForwardToContractor}
            onConfirmCompletion={handleConfirmCompletion}
            onReleaseFunds={handleReleaseFunds}
          />

          {/* Quote Counter */}
          {sentCount > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-semibold text-slate-300">Quote Tracking</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Requests sent</span>
                  <span className="font-semibold">{sentCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Responses received</span>
                  <span className="font-semibold text-emerald-400">{respondedCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Awaiting response</span>
                  <span className="font-semibold text-amber-400">{pendingCount}</span>
                </div>

                {sentCount > 0 && (
                  <div className="mt-2">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all"
                        style={{
                          width: `${(respondedCount / sentCount) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{respondedCount}/{sentCount} responded</p>
                  </div>
                )}
              </div>

              {quotedResponses.length >= 2 && (
                <button
                  onClick={() => setShowComparison(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-500/20"
                >
                  <BarChart3 className="h-4 w-4" />
                  Compare Quotes
                </button>
              )}
            </div>
          )}

          {/* Individual Quote Requests */}
          {sentCount > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-semibold text-slate-300">Contractor Quotes</h2>
              <div className="mt-3 space-y-2">
                {jobQuotes.map((qr) => {
                  const qrBadge = QR_STATUS_BADGE[qr.status] ?? QR_STATUS_BADGE.sent;
                  const canEnterResponse = (qr.status === "sent" || qr.status === "viewed") && !qr.quote_response;
                  const showForm = enteringResponseFor === qr.id;
                  return (
                    <div
                      key={qr.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{qr.operative_name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${qrBadge.cls}`}>
                          {qrBadge.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Sent {new Date(qr.sent_at).toLocaleDateString("en-GB")}
                        {" · Deadline "}
                        {new Date(qr.deadline).toLocaleDateString("en-GB")}
                      </p>

                      {showForm && (
                        <div className="mt-3 space-y-3 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-400">Price (£)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={responseForm.pricePounds}
                                onChange={(e) => setResponseForm((f) => ({ ...f, pricePounds: e.target.value }))}
                                className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                                placeholder="e.g. 150"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400">Est. hours</label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={responseForm.hours}
                                onChange={(e) => setResponseForm((f) => ({ ...f, hours: e.target.value }))}
                                className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                                placeholder="e.g. 3"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400">Available date (optional)</label>
                            <input
                              type="date"
                              value={responseForm.availableDate}
                              onChange={(e) => setResponseForm((f) => ({ ...f, availableDate: e.target.value }))}
                              className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400">Notes (optional)</label>
                            <textarea
                              value={responseForm.notes}
                              onChange={(e) => setResponseForm((f) => ({ ...f, notes: e.target.value }))}
                              rows={2}
                              className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                              placeholder="Contractor notes…"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEnterQuoteResponse(qr.id)}
                              disabled={actionLoading}
                              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                            >
                              {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Save Quote
                            </button>
                            <button
                              onClick={() => { setEnteringResponseFor(null); setResponseForm({ pricePounds: "", hours: "", availableDate: "", notes: "" }); }}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {canEnterResponse && !showForm && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setEnteringResponseFor(qr.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
                          >
                            <Plus className="h-3 w-3" />
                            Enter Response
                          </button>
                          <button
                            onClick={() => handleMarkDeclined(qr.id)}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Mark Declined
                          </button>
                        </div>
                      )}

                      {qr.quote_response && (
                        <div className="mt-2 rounded-lg bg-emerald-500/10 p-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-semibold text-emerald-400">
                                £{(qr.quote_response.price_pence / 100).toFixed(2)}
                              </span>
                              <span className="ml-2 text-[11px] text-slate-500">contractor</span>
                            </div>
                            <span className="text-xs text-slate-400">
                              {qr.quote_response.estimated_hours}h est.
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-violet-400">
                            <Banknote className="h-3 w-3" />
                            £{(Math.round(qr.quote_response.price_pence * (1 + SERVICE_FEE_RATE)) / 100).toFixed(2)}
                            <span className="text-slate-500">customer price (inc. 17.5% fee)</span>
                          </div>
                          {qr.quote_response.notes && (
                            <p className="mt-1 text-xs text-slate-400">{qr.quote_response.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showSendPanel && (
        <SendQuotesModal
          contractors={activeContractors}
          alreadySent={jobQuotes.map((q) => q.operative_id)}
          selected={selectedContractors}
          onToggle={(cId) =>
            setSelectedContractors((prev) =>
              prev.includes(cId) ? prev.filter((x) => x !== cId) : [...prev, cId]
            )
          }
          deadlineHours={deadlineHours}
          setDeadlineHours={setDeadlineHours}
          message={quoteMessage}
          setMessage={setQuoteMessage}
          sending={sending}
          onSend={handleSendQuotes}
          onClose={() => setShowSendPanel(false)}
        />
      )}

      {showComparison && (
        <QuoteComparisonModal
          quotes={quotedResponses}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}

/* ─── Workflow Actions Card ─────────────────────────────────────────────── */

function WorkflowActions({
  job,
  quotedResponses,
  actionLoading,
  onSendForQuotes,
  onSendToCustomer,
  onForwardToContractor,
  onConfirmCompletion,
  onReleaseFunds,
}: {
  job: { status: string; reference: string };
  quotedResponses: QuoteRequest[];
  actionLoading: boolean;
  onSendForQuotes: () => void;
  onSendToCustomer: () => void;
  onForwardToContractor: (qr: QuoteRequest) => void;
  onConfirmCompletion: (by: "contractor" | "customer") => void;
  onReleaseFunds: () => void;
}) {
  const status = job.status;

  if (status === "funds_released") {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
        <div className="flex items-center gap-2 text-green-400">
          <Banknote className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Funds Released</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">Payment has been sent to the contractor. Job complete.</p>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-2xl border border-slate-500/20 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 text-slate-400">
          <XCircle className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Job Cancelled</h2>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-center gap-2 text-amber-400">
          <Clock className="h-5 w-5" />
          <h2 className="text-sm font-semibold">New Job Submitted</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Send this job spec to contractors to collect quotes.
        </p>
        <button
          onClick={onSendForQuotes}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
        >
          <Send className="h-4 w-4" />
          Send for Quotes
        </button>
      </div>
    );
  }

  if (status === "awaiting_quotes" || status === "quoted" || status === "quotes_received") {
    const hasQuotes = quotedResponses.length > 0;
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div className="flex items-center gap-2 text-blue-400">
          <Clock className="h-5 w-5" />
          <h2 className="text-sm font-semibold">
            {hasQuotes ? "Quotes Ready" : "Awaiting Contractor Quotes"}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {hasQuotes
            ? `${quotedResponses.length} quote(s) received. Send to the customer with your 17.5% service fee applied.`
            : "Waiting for contractors to respond with their quotes."}
        </p>
        {hasQuotes && (
          <button
            onClick={onSendToCustomer}
            disabled={actionLoading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
            Send Quotes to Customer
          </button>
        )}
        <button
          onClick={onSendForQuotes}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          Request More Quotes
        </button>
      </div>
    );
  }

  if (status === "sent_to_customer") {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
        <div className="flex items-center gap-2 text-violet-400">
          <Send className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Waiting for Customer</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Quotes have been sent. The customer will choose their preferred quote in their dashboard. Refresh the page to see if they have accepted.
        </p>
        {quotedResponses.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-400">Quotes sent to customer:</p>
            {quotedResponses.map((qr) => (
              <div
                key={qr.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <p className="text-sm font-medium">{qr.operative_name}</p>
                <p className="text-xs text-slate-500">
                  £{(Math.round((qr.quote_response?.price_pence || 0) * (1 + SERVICE_FEE_RATE)) / 100).toFixed(2)} customer price
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (status === "customer_accepted" || status === "accepted") {
    return (
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5">
        <div className="flex items-center gap-2 text-brand-400">
          <UserCheck className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Customer Accepted a Quote</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Forward the full job spec to the chosen contractor so they can begin work.
        </p>
        {quotedResponses.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-400">Forward to chosen contractor:</p>
            {quotedResponses.map((qr) => (
              <button
                key={qr.id}
                onClick={() => onForwardToContractor(qr)}
                disabled={actionLoading}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium">{qr.operative_name}</p>
                  <p className="text-xs text-slate-500">
                    £{(qr.quote_response?.customer_price_pence != null
                      ? (qr.quote_response.customer_price_pence / 100).toFixed(2)
                      : (Math.round((qr.quote_response?.price_pence || 0) * (1 + SERVICE_FEE_RATE)) / 100).toFixed(2))} customer price
                    {qr.quote_response && (
                      <span className="ml-1 text-slate-500">
                        (£{(qr.quote_response.price_pence / 100).toFixed(2)} contractor)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-brand-400">
                  <Forward className="h-4 w-4" />
                  <span className="text-xs font-medium">Forward Full Spec</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (status === "customer_accepted" || status === "accepted" || status === "awaiting_completion" || status === "in_progress") {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
        <div className="flex items-center gap-2 text-cyan-400">
          <Clock className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Job in Progress</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Contractor is completing the work. Record completion confirmations when they come in.
        </p>
        <div className="mt-3 space-y-2">
          <button
            onClick={() => onConfirmCompletion("contractor")}
            disabled={actionLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Contractor Confirmed Complete
          </button>
          <button
            onClick={() => onConfirmCompletion("customer")}
            disabled={actionLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Customer Confirmed Complete
          </button>
        </div>
      </div>
    );
  }

  if (status === "pending_confirmation") {
    return (
      <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-5">
        <div className="flex items-center gap-2 text-teal-400">
          <Clock className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Awaiting Second Confirmation</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          One party has confirmed. Waiting for the other to confirm completion.
        </p>
        <div className="mt-3 space-y-2">
          <button
            onClick={() => onConfirmCompletion("contractor")}
            disabled={actionLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            Contractor Confirmed
          </button>
          <button
            onClick={() => onConfirmCompletion("customer")}
            disabled={actionLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            Customer Confirmed
          </button>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Job Complete — Release Funds</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Both the customer and contractor have confirmed completion. Release payment to the contractor.
        </p>
        <button
          onClick={onReleaseFunds}
          disabled={actionLoading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
          Release Funds to Contractor
        </button>
      </div>
    );
  }

  return null;
}

/* ─── Helper Components ─────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-medium text-amber-200">{value}</p>
    </div>
  );
}

/* ─── Send Quotes Modal ─────────────────────────────────────────────────── */

function SendQuotesModal({
  contractors,
  alreadySent,
  selected,
  onToggle,
  deadlineHours,
  setDeadlineHours,
  message,
  setMessage,
  sending,
  onSend,
  onClose,
}: {
  contractors: Contractor[];
  alreadySent: string[];
  selected: string[];
  onToggle: (id: string) => void;
  deadlineHours: number;
  setDeadlineHours: (h: number) => void;
  message: string;
  setMessage: (m: string) => void;
  sending: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  const available = contractors.filter((c) => !alreadySent.includes(c.id));
  const [contractorSearch, setContractorSearch] = useState("");

  const filteredContractors = available.filter((c) => {
    if (!contractorSearch) return true;
    const q = contractorSearch.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      c.specialisations.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-brand-400" />
          <h2 className="text-lg font-bold">Send for Quotes</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Select contractors and set a deadline. They&apos;ll receive an anonymised job spec.
        </p>

        <DeadlineDropdown value={deadlineHours} onChange={setDeadlineHours} />

        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-400">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            rows={2}
            placeholder="Any additional instructions for contractors…"
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-400">
            Select Contractors ({selected.length} selected)
          </label>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={contractorSearch}
              onChange={(e) => setContractorSearch(e.target.value)}
              placeholder="Search by name, company, or skill…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-brand-500"
            />
          </div>

          <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto">
            {available.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                {alreadySent.length > 0
                  ? "All active contractors have already been sent this job"
                  : "No active contractors available"}
              </p>
            ) : filteredContractors.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                No contractors match &ldquo;{contractorSearch}&rdquo;
              </p>
            ) : (
              filteredContractors.map((c) => {
                const isSelected = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggle(c.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-brand-500/50 bg-brand-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        isSelected
                          ? "border-brand-500 bg-brand-600"
                          : "border-white/20 bg-white/5"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">{c.full_name}</p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            c.contractor_type === "business"
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-teal-500/20 text-teal-400"
                          }`}
                        >
                          {c.contractor_type === "business" ? "Business" : "Sole Trader"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {c.company_name || c.email}
                        {c.specialisations.length > 0 && ` · ${c.specialisations[0]}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {c.rating > 0 ? `★ ${c.rating.toFixed(1)}` : "No rating"}
                      </p>
                      {c.hourly_rate && (
                        <p className="text-[11px] text-slate-500">£{c.hourly_rate}/hr</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={selected.length === 0 || sending}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send to {selected.length} Contractor{selected.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Deadline Dropdown ─────────────────────────────────────────────────── */

function DeadlineDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (h: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = DEADLINE_OPTIONS.find((o) => o.hours === value) ?? DEADLINE_OPTIONS[1];

  return (
    <div className="mt-5" ref={ref}>
      <label className="block text-xs font-medium text-slate-400">Quote Deadline</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative mt-1 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3 pr-3 text-left text-sm text-white outline-none transition-colors hover:bg-white/[0.08] focus:border-brand-500"
      >
        <Clock className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="flex-1">{selected.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-[calc(100%-3rem)] rounded-xl border border-white/10 bg-slate-800 py-1 shadow-xl shadow-black/30">
          {DEADLINE_OPTIONS.map((opt) => {
            const isActive = opt.hours === value;
            return (
              <button
                key={opt.hours}
                onClick={() => {
                  onChange(opt.hours);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-500/15 text-brand-400"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className={`h-3.5 w-3.5 ${isActive ? "text-brand-400" : "text-slate-500"}`} />
                  {opt.label}
                </div>
                {isActive && <Check className="h-4 w-4 text-brand-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Quote Comparison Modal ────────────────────────────────────────────── */

function QuoteComparisonModal({
  quotes,
  onClose,
}: {
  quotes: QuoteRequest[];
  onClose: () => void;
}) {
  const sorted = [...quotes].sort(
    (a, b) => (a.quote_response?.price_pence || 0) - (b.quote_response?.price_pence || 0)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-400" />
          <h2 className="text-lg font-bold">Compare Quotes</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {sorted.length} contractor quotes — customer prices include 17.5% service fee
        </p>

        <div className="mt-5 space-y-3">
          {sorted.map((qr, i) => {
            const resp = qr.quote_response!;
            const isCheapest = i === 0;
            const customerPrice = Math.round(resp.price_pence * (1 + SERVICE_FEE_RATE));
            return (
              <div
                key={qr.id}
                className={`rounded-xl border p-4 ${
                  isCheapest
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{qr.operative_name}</p>
                      {isCheapest && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          BEST PRICE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Responded {new Date(qr.responded_at || resp.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-400">
                      £{(customerPrice / 100).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      £{(resp.price_pence / 100).toFixed(2)} contractor
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Duration</p>
                    <p>{resp.estimated_hours}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Available</p>
                    <p>
                      {resp.available_date
                        ? new Date(resp.available_date).toLocaleDateString("en-GB")
                        : "Flexible"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fee Earned</p>
                    <p className="text-violet-400">
                      £{((customerPrice - resp.price_pence) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
                {resp.notes && (
                  <p className="mt-2 text-xs text-slate-400">{resp.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
