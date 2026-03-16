"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAdminStore, Contractor, QuoteRequest, QuoteResponse } from "@/lib/admin-store";
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
import CustomDropdown from "@/components/ui/CustomDropdown";

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

const DEADLINE_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
  { label: "1 week", hours: 168 },
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

/** Format time string "09:00" or "09:00:00" for display (e.g. "9:00 am") */
function formatTimeForDisplay(t: string): string {
  if (!t) return "—";
  const parts = String(t).trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (h === 12) return `12:${m.toString().padStart(2, "0")} pm`;
  if (h === 0) return `12:${m.toString().padStart(2, "0")} am`;
  if (h > 12) return `${h - 12}:${m.toString().padStart(2, "0")} pm`;
  return `${h}:${m.toString().padStart(2, "0")} am`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: i.toString().padStart(2, "0"), label: i.toString().padStart(2, "0") }));
const MINUTE_OPTIONS = ["00", "15", "30", "45"].map((m) => ({ value: m, label: m }));

function TimePicker({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const parts = value ? value.split(":") : [];
  const h = parts[0]?.padStart(2, "0") ?? "";
  const m = parts[1]?.padStart(2, "0") ?? "";
  const hourOpts = [{ value: "", label: "Not set" }, ...HOUR_OPTIONS];
  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="flex-1">
        <CustomDropdown
          value={h}
          onChange={(hour) => {
            if (!hour) onChange("");
            else onChange(`${hour}:${m || "00"}`);
          }}
          options={hourOpts}
          placeholder="Hour"
        />
      </div>
      <div className="flex-1">
        <CustomDropdown
          value={m}
          onChange={(min) => {
            if (!h) return;
            onChange(`${h}:${min || "00"}`);
          }}
          options={h ? [{ value: "", label: "—" }, ...MINUTE_OPTIONS] : MINUTE_OPTIONS}
          placeholder="Min"
        />
      </div>
      {!value && placeholder && (
        <span className="self-center text-xs text-slate-500">{placeholder}</span>
      )}
    </div>
  );
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
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [addQuoteForm, setAddQuoteForm] = useState({ contractorId: "", pricePounds: "", hours: "", arrivalTime: "", notes: "" });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [blockCustomer, setBlockCustomer] = useState(false);
  const toast = useAdminNotifications((s) => s.push);

  const CANCEL_REASONS = [
    { value: "customer_request", label: "Customer request" },
    { value: "no_contractor_available", label: "No contractor available" },
    { value: "duplicate", label: "Duplicate job" },
    { value: "payment_issue", label: "Payment issue" },
    { value: "quotes_declined", label: "Customer declined all quotes" },
    { value: "other", label: "Other" },
  ] as const;

  const job = jobs.find((j) => j.id === id);
  const quoteRequestsList = Array.isArray(quoteRequests) ? quoteRequests : [];
  const jobQuotes = useMemo(
    () => quoteRequestsList.filter((qr) => qr.job_id === id),
    [quoteRequestsList, id]
  );
  const activeContractors = contractors.filter((c) => c.is_active);
  const addQuoteContractors = useMemo(
    () => activeContractors.filter((c) => !jobQuotes.some((q) => q.operative_id === c.id)),
    [activeContractors, jobQuotes]
  );

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      if (jobs.length === 0) {
        const { data: jobsData } = await supabase
          .from("jobs")
          .select("*, job_details(*), profiles!user_id(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)")
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
              user_id: j.user_id,
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
              payment_captured_at: j.payment_captured_at ?? null,
              funds_released_at: j.funds_released_at ?? null,
              accepted_quote_request_id: j.accepted_quote_request_id ?? null,
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
        const mapped: QuoteRequest[] = qrData.map((qr: { id: string; job_id: string; operative_id: string; operatives?: { full_name?: string } | { full_name?: string }[]; status: string; deadline: string; message?: string; sent_at: string; viewed_at?: string; responded_at?: string; quote_responses?: Array<{ price_pence: number }> }) => {
          const op = Array.isArray(qr.operatives) ? qr.operatives[0] : qr.operatives;
          return {
            id: qr.id,
            job_id: qr.job_id,
            operative_id: qr.operative_id,
            operative_name: op?.full_name || "Unknown",
            status: qr.status as QuoteRequest["status"],
            deadline: qr.deadline,
            message: qr.message,
            sent_at: qr.sent_at,
            viewed_at: qr.viewed_at,
            responded_at: qr.responded_at,
            quote_response: (qr.quote_responses?.[0] as QuoteResponse | undefined) || undefined,
          };
        });
        const prev = useAdminStore.getState().quoteRequests;
        const next = (Array.isArray(prev) ? prev : []).filter((q: QuoteRequest) => q.job_id !== id).concat(mapped);
        setQuoteRequests(next);
        const quotedPrices = qrData.map((qr: { quote_responses?: Array<{ price_pence: number }> }) => qr.quote_responses?.[0]?.price_pence).filter((p: number | undefined): p is number => p != null && p > 0);
        if (quotedPrices.length > 0) {
          const price_estimate = Math.round(quotedPrices.reduce((a, b) => a + b, 0) / quotedPrices.length);
          updateJob(id as string, { price_estimate });
        }
      }

      setLoading(false);
    };
    load();
  }, [id, jobs.length, contractors.length, setJobs, setContractors, setQuoteRequests, updateJob]);

  const refreshJobData = useCallback(async () => {
    const supabase = createClient();
    const { data: qrData } = await supabase
      .from("quote_requests")
      .select("*, quote_responses(*), operatives(full_name)")
      .eq("job_id", id as string)
      .order("created_at", { ascending: false });

    const { data: j } = await supabase
      .from("jobs")
      .select("*, job_details(*), profiles!user_id(full_name, email, is_blocked), services(name), quotes(min_price_pence, max_price_pence, operatives_required)")
      .eq("id", id as string)
      .single();

    if (j) {
      const quotedPrices = (qrData || [])
        .map((qr: { quote_responses?: Array<{ price_pence: number }> }) => qr.quote_responses?.[0]?.price_pence)
        .filter((p: number | undefined): p is number => p != null && p > 0);
      const fromQuotes = (j as { quotes?: Array<{ min_price_pence: number; max_price_pence: number }> }).quotes?.[0];
      const price_estimate =
        quotedPrices.length > 0
          ? Math.round(quotedPrices.reduce((a, b) => a + b, 0) / quotedPrices.length)
          : fromQuotes
            ? Math.round((fromQuotes.min_price_pence + fromQuotes.max_price_pence) / 2)
            : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: any = {
        id: j.id,
        reference: j.reference || j.id.slice(0, 8).toUpperCase(),
        service: (j as any).services?.name || "Cleaning",
        cleaning_type: j.cleaning_type || "domestic",
        status: j.status,
        cancelled_reason: (j as any).cancelled_reason,
        user_id: (j as any).user_id,
        customer_name: (j as any).profiles?.full_name || "Unknown",
        customer_email: (j as any).profiles?.email || "",
        address: [j.address_line_1, j.address_line_2, j.city].filter(Boolean).join(", "),
        postcode: j.postcode || "",
        date: j.preferred_date || j.created_at,
        time: j.preferred_time || "",
        price_estimate,
        rooms: (j as any).job_details?.[0]?.quantity || 0,
        operatives: (j as any).quotes?.[0]?.operatives_required || 1,
        complexity: (j as any).job_details?.[0]?.complexity || "standard",
        notes: j.notes || "",
        created_at: j.created_at,
        is_blocked: (j as any).profiles?.is_blocked || false,
        payment_captured_at: (j as any).payment_captured_at ?? null,
        funds_released_at: (j as any).funds_released_at ?? null,
        accepted_quote_request_id: (j as any).accepted_quote_request_id ?? null,
      };
      updateJob(j.id, mapped);
    }

    if (qrData) {
      const mapped: QuoteRequest[] = qrData.map((qr: { id: string; job_id: string; operative_id: string; operatives?: { full_name?: string } | { full_name?: string }[]; status: string; deadline: string; message?: string; sent_at: string; viewed_at?: string; responded_at?: string; quote_responses?: Array<{ id: string; quote_request_id: string; price_pence: number; customer_price_pence?: number; estimated_hours: number; available_date?: string; notes?: string; created_at: string }> }) => {
        const op = Array.isArray(qr.operatives) ? qr.operatives[0] : qr.operatives;
        return {
          id: qr.id,
          job_id: qr.job_id,
          operative_id: qr.operative_id,
          operative_name: op?.full_name || "Unknown",
          status: qr.status as QuoteRequest["status"],
          deadline: qr.deadline,
          message: qr.message,
          sent_at: qr.sent_at,
          viewed_at: qr.viewed_at,
          responded_at: qr.responded_at,
          quote_response: (qr.quote_responses?.[0] as QuoteResponse | undefined) || undefined,
        };
      });
      const prev = useAdminStore.getState().quoteRequests;
      const next = (Array.isArray(prev) ? prev : []).filter((q: QuoteRequest) => q.job_id !== id).concat(mapped);
      setQuoteRequests(next);
    }
  }, [id, updateJob, setQuoteRequests]);

  useEffect(() => {
    if (!id || loading) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-job-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` },
        () => refreshJobData()
      )
      .subscribe();
    const interval = setInterval(refreshJobData, 30000);
    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
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

    // Sync customer-facing quote so dashboard shows price (public.quotes)
    const prices = quotedResponses
      .map((qr) => qr.quote_response?.customer_price_pence ?? Math.round((qr.quote_response?.price_pence ?? 0) * (1 + SERVICE_FEE_RATE)))
      .filter((p): p is number => p != null && p > 0);
    if (prices.length > 0) {
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const first = quotedResponses[0]?.quote_response;
      const durationMin = first?.estimated_hours ? Math.round(Number(first.estimated_hours) * 60) : 60;
      const { data: existing } = await supabase.from("quotes").select("id").eq("job_id", job.id).limit(1).maybeSingle();
      if (existing) {
        await supabase.from("quotes").update({
          min_price_pence: minP,
          max_price_pence: maxP,
          estimated_duration_min: durationMin,
          operatives_required: 1,
        }).eq("id", existing.id);
      } else {
        await supabase.from("quotes").insert({
          job_id: job.id,
          min_price_pence: minP,
          max_price_pence: maxP,
          estimated_duration_min: durationMin,
          operatives_required: 1,
        });
      }
    }

    updateJob(job.id, { status: "sent_to_customer" });
    toast({ type: "success", title: "Quotes Sent to Customer", message: "Customer will be notified to choose a quote" });
    setActionLoading(false);
  };

  const handleForwardToContractor = async (qr: QuoteRequest) => {
    if (!job || !qr.quote_response) return;
    setActionLoading(true);
    const supabase = createClient();
    const now = new Date().toISOString();

    // Send job details to contractor by email (if Resend is configured)
    try {
      const emailRes = await fetch("/api/jobs/send-contractor-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const emailData = await emailRes.json().catch(() => ({}));
      if (!emailRes.ok) {
        toast({ type: "warning", title: "Email not sent", message: emailData.error || "Could not send email. Add RESEND_API_KEY to enable." });
      }
    } catch {
      toast({ type: "warning", title: "Email not sent", message: "Could not send email to contractor." });
    }

    await supabase
      .from("jobs")
      .update({
        status: "awaiting_completion",
        accepted_quote_request_id: qr.id,
        customer_accepted_at: new Date().toISOString(),
        actual_start: now, // Job considered "commenced" — customer can no longer cancel
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
    toast({ type: "success", title: "Forwarded to Contractor", message: `Job updated. ${qr.operative_name} has been emailed the job details.` });
    setActionLoading(false);
  };

  const handleAddQuote = async () => {
    const operativeId = addQuoteForm.contractorId;
    const pricePence = Math.round(parseFloat(addQuoteForm.pricePounds || "0") * 100);
    if (!operativeId || pricePence <= 0 || !job) {
      toast({ type: "error", title: "Invalid", message: "Select a contractor and enter a valid price." });
      return;
    }
    const existing = jobQuotes.find((q) => q.operative_id === operativeId);
    if (existing) {
      toast({ type: "error", title: "Already added", message: "This contractor already has a quote for this job." });
      return;
    }
    setActionLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const deadline = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const respondedAt = new Date().toISOString();

    // Link only the contract for THIS job's service (not any other contracts on the contractor's profile)
    const { data: jobRow } = await supabase.from("jobs").select("service_id").eq("id", job.id).single();
    const serviceId = (jobRow as { service_id?: string } | null)?.service_id ?? null;
    let operativeServiceId: string | null = null;
    if (serviceId) {
      const { data: os } = await supabase
        .from("operative_services")
        .select("id")
        .eq("operative_id", operativeId)
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .maybeSingle();
      operativeServiceId = (os as { id: string } | null)?.id ?? null;
      if (!operativeServiceId) {
        toast({ type: "warning", title: "No contract", message: "This contractor has no service contract for this job type. Add one in Contractors → Edit → Services & contracts. Quote will still be added." });
      }
    }

    const { data: qr, error: qrError } = await supabase
      .from("quote_requests")
      .insert({
        job_id: job.id,
        operative_id: operativeId,
        sent_by: user?.id,
        deadline,
        status: "quoted",
        responded_at: respondedAt,
      })
      .select("*, operatives(full_name)")
      .single();

    if (qrError || !qr) {
      toast({ type: "error", title: "Failed", message: qrError?.message || "Could not create quote request." });
      setActionLoading(false);
      return;
    }

    const jobDate = job?.date ? String(job.date).slice(0, 10) : null;
    const { data: resp, error: respError } = await supabase
      .from("quote_responses")
      .insert({
        quote_request_id: qr.id,
        price_pence: pricePence,
        estimated_hours: addQuoteForm.hours ? parseFloat(addQuoteForm.hours) : null,
        available_date: jobDate || null,
        arrival_time: addQuoteForm.arrivalTime ? `${addQuoteForm.arrivalTime}:00` : null,
        notes: addQuoteForm.notes || null,
        operative_service_id: operativeServiceId,
      })
      .select()
      .single();

    if (respError || !resp) {
      toast({ type: "error", title: "Failed", message: respError?.message || "Could not save quote." });
      setActionLoading(false);
      return;
    }

    const operativeName = (qr as { operatives?: { full_name?: string } }).operatives?.full_name || "Unknown";
    addQuoteRequest({
      id: qr.id,
      job_id: qr.job_id,
      operative_id: qr.operative_id,
      operative_name: operativeName,
      status: "quoted",
      deadline: qr.deadline,
      message: qr.message,
      sent_at: qr.sent_at,
      responded_at: respondedAt,
      quote_response: {
        id: resp.id,
        quote_request_id: qr.id,
        price_pence: pricePence,
        estimated_hours: addQuoteForm.hours ? parseFloat(addQuoteForm.hours) : 0,
        available_date: jobDate || undefined,
        arrival_time: addQuoteForm.arrivalTime || undefined,
        notes: addQuoteForm.notes || undefined,
        created_at: resp.created_at,
      },
    });

    const newStatus = job.status === "pending" ? "quotes_received" : job.status;
    if (newStatus !== job.status) {
      await supabase.from("jobs").update({ status: newStatus }).eq("id", job.id);
      updateJob(job.id, { status: newStatus });
    }

    setShowAddQuoteModal(false);
    setAddQuoteForm({ contractorId: "", pricePounds: "", hours: "", arrivalTime: "", notes: "" });
    toast({ type: "success", title: "Quote added", message: `${operativeName}'s quote has been added.` });
    setActionLoading(false);
  };

  const handleSendOneQuoteToCustomer = async (qr: QuoteRequest) => {
    if (!job || !qr.quote_response) return;
    setActionLoading(true);
    const supabase = createClient();
    const customerPrice = Math.round(qr.quote_response.price_pence * (1 + SERVICE_FEE_RATE));
    await supabase
      .from("quote_responses")
      .update({ customer_price_pence: customerPrice })
      .eq("id", qr.quote_response.id);
    await supabase
      .from("jobs")
      .update({ status: "sent_to_customer", quotes_sent_to_customer_at: new Date().toISOString() })
      .eq("id", job.id);
    // Sync customer-facing quote (public.quotes) so dashboard shows price
    const durationMin = qr.quote_response.estimated_hours ? Math.round(Number(qr.quote_response.estimated_hours) * 60) : 60;
    const { data: existing } = await supabase.from("quotes").select("id").eq("job_id", job.id).limit(1).maybeSingle();
    if (existing) {
      await supabase.from("quotes").update({
        min_price_pence: customerPrice,
        max_price_pence: customerPrice,
        estimated_duration_min: durationMin,
        operatives_required: 1,
      }).eq("id", existing.id);
    } else {
      await supabase.from("quotes").insert({
        job_id: job.id,
        min_price_pence: customerPrice,
        max_price_pence: customerPrice,
        estimated_duration_min: durationMin,
        operatives_required: 1,
      });
    }
    updateJob(job.id, { status: "sent_to_customer" });
    updateQuoteRequest(qr.id, { quote_response: { ...qr.quote_response, customer_price_pence: customerPrice } });
    toast({ type: "success", title: "Sent to customer", message: `Quote from ${qr.operative_name} sent to customer.` });
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
    try {
      const res = await fetch("/api/stripe/release-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          type: "error",
          title: "Release failed",
          message: data.error || "Could not release funds.",
        });
        setActionLoading(false);
        return;
      }

      updateJob(job.id, { status: "funds_released" });
      toast({
        type: "success",
        title: "Funds Released",
        message: data.transferred
          ? "Payment has been sent to the contractor's Stripe account."
          : "Job marked as paid. Pay the contractor manually (no Stripe Connect account).",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!job || !cancelReason.trim()) return;
    const reasonText = cancelReason === "other" && cancelReasonOther.trim()
      ? `other: ${cancelReasonOther.trim()}`
      : cancelReason;
    setActionLoading(true);
    const supabase = createClient();
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error: jobError } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        cancelled_reason: reasonText,
        cancelled_at: now,
        cancelled_by: adminUser?.id ?? null,
      })
      .eq("id", job.id);
    if (jobError) {
      toast({ type: "error", title: "Error", message: jobError.message });
      setActionLoading(false);
      return;
    }
    updateJob(job.id, { status: "cancelled", cancelled_reason: reasonText });
    if (blockCustomer && job.user_id) {
      await supabase.from("profiles").update({ is_blocked: true }).eq("id", job.user_id);
      toast({ type: "info", title: "Job Cancelled", message: `${job.reference} has been cancelled. Customer has been blocked.` });
    } else {
      toast({ type: "info", title: "Job Cancelled", message: `${job.reference} has been cancelled.` });
    }
    setShowCancelModal(false);
    setCancelReason("");
    setCancelReasonOther("");
    setBlockCustomer(false);
    setActionLoading(false);
  };

  const handleReinstateJob = async () => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({
        status: "pending",
        cancelled_reason: null,
        cancelled_at: null,
        cancelled_by: null,
      })
      .eq("id", job.id);
    if (error) {
      toast({ type: "error", title: "Error", message: error.message });
      setActionLoading(false);
      return;
    }
    updateJob(job.id, { status: "pending", cancelled_reason: undefined });
    toast({ type: "success", title: "Job reinstated", message: `${job.reference} is active again. You can add quotes and send to customer.` });
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
          {!isTerminal && (
            <Link
              href={`/jobs/${job.id}/quotes`}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              View quotes
            </Link>
          )}
          {!isTerminal && job.status !== "completed" && (
            <button
              onClick={() => setShowCancelModal(true)}
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
          {!isTerminal && !["completed", "funds_released"].includes(job.status) && (
            <button
              onClick={() => setShowAddQuoteModal(true)}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" />
              Add Quote
            </button>
          )}
        </div>
      </div>

      {/* Job status (admin view: single status) */}
      {!isTerminal && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
          <p className="text-xs text-slate-500">Status</p>
          <p className="mt-0.5 text-sm font-medium text-slate-200">{badge.label}</p>
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
              <Field label="Estimate" value={job.price_estimate > 0 ? `£${(job.price_estimate / 100).toFixed(2)}` : "—"} />
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
              <MiniField label="Estimate" value={job.price_estimate > 0 ? `£${(job.price_estimate / 100).toFixed(2)}` : "—"} />
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
            onAddQuote={() => setShowAddQuoteModal(true)}
            onSendToCustomer={handleSendToCustomer}
            onForwardToContractor={handleForwardToContractor}
            onConfirmCompletion={handleConfirmCompletion}
            onReleaseFunds={handleReleaseFunds}
            onReinstateJob={handleReinstateJob}
          />

          {/* Quote Counter — always show when not terminal; empty state when no quotes */}
          {!isTerminal && (
            <>
              {sentCount > 0 ? (
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
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="text-sm font-semibold text-slate-300">Quote Tracking</h2>
                  <p className="mt-2 text-sm text-slate-400">No quotes yet.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowAddQuoteModal(true)}
                      className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                    >
                      <Plus className="h-4 w-4" />
                      Add Quote
                    </button>
                    <Link
                      href={`/jobs/${job.id}/quotes`}
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                    >
                      View quotes
                    </Link>
                  </div>
                </div>
              )}

          {/* Individual Quote Requests — display only; click card goes to View quotes page */}
              {sentCount > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-semibold text-slate-300">Contractor Quotes</h2>
              <p className="mt-1 text-xs text-slate-400">Click a quote to open it on the View quotes page.</p>
              <div className="mt-3 space-y-2">
                {jobQuotes.map((qr) => {
                  const qrBadge = QR_STATUS_BADGE[qr.status] ?? QR_STATUS_BADGE.sent;
                  return (
                    <Link
                      key={qr.id}
                      href={`/jobs/${job.id}/quotes/${qr.id}`}
                      className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.06]"
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
                            <span className="text-slate-500">customer (inc. 17.5% fee)</span>
                          </div>
                          {qr.quote_response.notes && (
                            <p className="mt-1 text-xs text-slate-400">{qr.quote_response.notes}</p>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="text-sm font-semibold text-slate-300">Contractor Quotes</h2>
                  <p className="mt-2 text-sm text-slate-400">No quotes yet. Add a quote above or from the job header.</p>
                  <Link
                    href={`/jobs/${job.id}/quotes`}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-400 hover:text-brand-300"
                  >
                    View quotes
                  </Link>
                </div>
              )}
            </>
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

      {showAddQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddQuoteModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Add Quote</h2>
            <p className="mt-1 text-sm text-slate-400">Add a contractor quote manually. They will appear in the list and can be sent to the customer individually or all at once.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400">Contractor</label>
                <CustomDropdown
                  value={addQuoteForm.contractorId}
                  onChange={(v) => setAddQuoteForm((f) => ({ ...f, contractorId: v }))}
                  options={addQuoteContractors.map((c) => ({
                    value: c.id,
                    label: c.full_name || c.email || c.id.slice(0, 8),
                  }))}
                  placeholder="Select contractor"
                  className="mt-0.5"
                />
                {addQuoteContractors.length === 0 && (
                  <p className="mt-1 text-xs text-amber-400">All active contractors already have a quote for this job.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400">Price (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addQuoteForm.pricePounds}
                    onChange={(e) => setAddQuoteForm((f) => ({ ...f, pricePounds: e.target.value }))}
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
                    value={addQuoteForm.hours}
                    onChange={(e) => setAddQuoteForm((f) => ({ ...f, hours: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                    placeholder="e.g. 3"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400">Available date</label>
                  <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-slate-400">
                    {job?.date
                      ? new Date(String(job.date).slice(0, 10)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">Customer&apos;s choice (locked)</p>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400">Customer requested time</label>
                  <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-slate-300">
                    {job?.time ? formatTimeForDisplay(job.time) : "Flexible"}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400">Time of arrival (optional)</label>
                <TimePicker
                  value={addQuoteForm.arrivalTime}
                  onChange={(v) => setAddQuoteForm((f) => ({ ...f, arrivalTime: v }))}
                  placeholder="e.g. 09:30"
                  className="mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400">Notes (optional)</label>
                <textarea
                  value={addQuoteForm.notes}
                  onChange={(e) => setAddQuoteForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                  placeholder="Contractor notes…"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={handleAddQuote}
                disabled={actionLoading || addQuoteContractors.length === 0 || !addQuoteForm.contractorId || !addQuoteForm.pricePounds}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Quote
              </button>
              <button
                onClick={() => { setShowAddQuoteModal(false); setAddQuoteForm({ contractorId: "", pricePounds: "", hours: "", arrivalTime: "", notes: "" }); }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel job modal — reason required, optional block customer */}
      {showCancelModal && job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !actionLoading && setShowCancelModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Cancel job</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose a reason and optionally block this customer from booking again.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400">Reason for cancellation *</label>
                <CustomDropdown
                  value={cancelReason}
                  onChange={setCancelReason}
                  options={CANCEL_REASONS.map((r) => ({ value: r.value, label: r.label }))}
                  placeholder="Select reason"
                  className="mt-1"
                />
              </div>
              {cancelReason === "other" && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-400">Details (optional)</label>
                  <textarea
                    value={cancelReasonOther}
                    onChange={(e) => setCancelReasonOther(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-red-500/50"
                    placeholder="Brief explanation…"
                  />
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06]">
                <input
                  type="checkbox"
                  checked={blockCustomer}
                  onChange={(e) => setBlockCustomer(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 text-red-500 focus:ring-red-500/30"
                />
                <span className="text-sm text-slate-300">Block this customer from booking again</span>
              </label>
              {job.is_blocked && (
                <p className="text-xs text-amber-400">This customer is already blocked.</p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(""); setCancelReasonOther(""); setBlockCustomer(false); }}
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCancelJob}
                disabled={actionLoading || !cancelReason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Confirm cancellation
              </button>
            </div>
          </div>
        </div>
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
  onAddQuote,
  onSendToCustomer,
  onForwardToContractor,
  onConfirmCompletion,
  onReleaseFunds,
  onReinstateJob,
}: {
  job: { status: string; reference: string; cancelled_reason?: string };
  quotedResponses: QuoteRequest[];
  actionLoading: boolean;
  onSendForQuotes: () => void;
  onAddQuote: () => void;
  onSendToCustomer: () => void;
  onForwardToContractor: (qr: QuoteRequest) => void;
  onConfirmCompletion: (by: "contractor" | "customer") => void;
  onReleaseFunds: () => void;
  onReinstateJob?: () => void;
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
    const quotesDeclined = (job as { cancelled_reason?: string }).cancelled_reason === "quotes_declined";
    return (
      <div className="rounded-2xl border border-slate-500/20 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 text-slate-400">
          <XCircle className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Job Cancelled</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {quotesDeclined ? "Customer declined all quotes." : "This job is no longer active."}
          {onReinstateJob && " You can reinstate it to add quotes and send to customer again."}
        </p>
        {onReinstateJob && (
          <button
            onClick={onReinstateJob}
            disabled={actionLoading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reinstate job
          </button>
        )}
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-xs text-slate-500">Semi-automated &quot;Send for quotes&quot; flow (request quotes from contractors) coming later.</p>
        <button
          disabled
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-500"
          title="Coming soon"
        >
          <Send className="h-4 w-4" />
          Send for quotes
          <span className="rounded bg-slate-600/50 px-1.5 py-0.5 text-[10px]">Coming soon</span>
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
            {hasQuotes ? "Quotes Ready" : "Add Quotes"}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {hasQuotes
            ? `${quotedResponses.length} quote(s). Send all to customer with 17.5% fee, or send individually from each quote below.`
            : "Add quotes from your contractors using the Add Quote button."}
        </p>
        {hasQuotes && (
          <button
            onClick={onSendToCustomer}
            disabled={actionLoading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
            Send All to Customer
          </button>
        )}
        <div className="mt-2">
          <button
            onClick={onAddQuote}
            className="flex w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Add Quote
          </button>
        </div>
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
          Quotes have been sent. The customer will choose their preferred quote in their dashboard. Refresh the page to see if they have accepted. You can still add more quotes and send them to the customer.
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
        <div className="mt-3">
          <button
            onClick={onAddQuote}
            className="flex w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Add Quote
          </button>
        </div>
      </div>
    );
  }

  if (status === "customer_accepted" || status === "accepted") {
    const jobWithPayment = job as { payment_captured_at?: string | null; funds_released_at?: string | null };
    const paymentHeld = !!jobWithPayment.payment_captured_at && !jobWithPayment.funds_released_at;
    return (
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5">
        <div className="flex items-center gap-2 text-brand-400">
          <UserCheck className="h-5 w-5" />
          <h2 className="text-sm font-semibold">Customer Accepted a Quote</h2>
        </div>
        {paymentHeld && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-sm font-medium text-emerald-300">Payment held in your Stripe account</p>
            <p className="mt-1 text-xs text-slate-400">
              Funds are in escrow. When the job is complete, use &quot;Release Funds&quot; to send the contractor share (82.5%) to the contractor; Kleen retains 17.5% commission.
            </p>
          </div>
        )}
        <p className="mt-2 text-sm text-slate-400">
          Forward the full job spec to the chosen contractor so they can begin work.
        </p>
        {quotedResponses.length > 0 && (() => {
          const acceptedId = (job as { accepted_quote_request_id?: string | null }).accepted_quote_request_id;
          const toShow = acceptedId
            ? quotedResponses.filter((qr) => qr.id === acceptedId)
            : quotedResponses;
          return toShow.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-400">Forward to chosen contractor:</p>
            {toShow.map((qr) => (
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
          ) : null;
        })()}
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
