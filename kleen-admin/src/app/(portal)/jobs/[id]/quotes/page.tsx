"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import type { QuoteRequest } from "@/lib/admin-store";
import CustomDropdown from "@/components/ui/CustomDropdown";
import {
  ArrowLeft,
  Loader2,
  Banknote,
  FileText,
  Trash2,
  Send,
  X,
  Forward,
  Pencil,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SERVICE_FEE_RATE = 0.175;

const QR_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  sent:     { label: "Sent",     cls: "bg-slate-500/20 text-slate-400" },
  viewed:   { label: "Viewed",   cls: "bg-blue-500/20 text-blue-400" },
  quoted:   { label: "Quoted",   cls: "bg-emerald-500/20 text-emerald-400" },
  declined: { label: "Declined", cls: "bg-red-500/20 text-red-400" },
  expired:  { label: "Expired", cls: "bg-amber-500/20 text-amber-400" },
  rejected_by_customer: { label: "Rejected by customer", cls: "bg-red-500/20 text-red-400" },
};

type JobInfo = {
  id: string;
  reference: string;
  service: string;
  status: string;
  cancelled_reason?: string;
  customer_name: string;
  customer_email: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  notes?: string;
};

type ContractorOption = { id: string; full_name: string; email?: string };

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: i.toString().padStart(2, "0"), label: i.toString().padStart(2, "0") }));
const MINUTE_OPTIONS = ["00", "15", "30", "45"].map((m) => ({ value: m, label: m }));

function TimePicker({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const parts = value ? value.split(":") : [];
  const h = parts[0]?.padStart(2, "0") ?? "";
  const m = parts[1]?.padStart(2, "0") ?? "";
  const hourOpts = [{ value: "", label: "Not set" }, ...HOUR_OPTIONS];
  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="flex-1">
        <CustomDropdown
          value={h}
          onChange={(hour) => (hour ? onChange(`${hour}:${m || "00"}`) : onChange(""))}
          options={hourOpts}
          placeholder="Hour"
        />
      </div>
      <div className="flex-1">
        <CustomDropdown
          value={m}
          onChange={(min) => (h ? onChange(`${h}:${min || "00"}`) : undefined)}
          options={h ? [{ value: "", label: "—" }, ...MINUTE_OPTIONS] : MINUTE_OPTIONS}
          placeholder="Min"
        />
      </div>
    </div>
  );
}

export default function JobQuotesPage() {
  const { id } = useParams();
  const jobId = (Array.isArray(id) ? id[0] : id) as string | undefined;
  const searchParams = useSearchParams();
  const toast = useAdminNotifications((s) => s.push);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingOne, setSendingOne] = useState<string | null>(null);
  const [removeAllModal, setRemoveAllModal] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);
  const [sendAllModal, setSendAllModal] = useState(false);
  const [sendAllListExpanded, setSendAllListExpanded] = useState(false);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [addQuoteLoading, setAddQuoteLoading] = useState(false);
  const [addQuoteForm, setAddQuoteForm] = useState({ contractorId: "", pricePounds: "", hours: "", arrivalTime: "", notes: "" });
  const quoteRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadJobAndQuotes = useCallback(async () => {
    if (!jobId) return;
    const supabase = createClient();
    const { data: j } = await supabase
      .from("jobs")
      .select("id, reference, status, cancelled_reason, address_line_1, address_line_2, city, postcode, preferred_date, preferred_time, notes, job_details(*), profiles!user_id(full_name, email), services(name)")
      .eq("id", jobId)
      .single();

    if (j) {
      const jj = j as {
        id: string;
        reference?: string;
        status: string;
        address_line_1?: string;
        address_line_2?: string;
        city?: string;
        postcode?: string;
        preferred_date?: string;
        preferred_time?: string;
        notes?: string;
        job_details?: Array<{ quantity?: number; complexity?: string }>;
        profiles?: { full_name?: string; email?: string };
        services?: { name?: string };
      };
      setJob({
        id: jj.id,
        reference: jj.reference || jj.id?.slice(0, 8).toUpperCase(),
        service: jj.services?.name || "Cleaning",
        status: jj.status || "pending",
        cancelled_reason: (jj as { cancelled_reason?: string }).cancelled_reason,
        customer_name: jj.profiles?.full_name || "Unknown",
        customer_email: jj.profiles?.email || "",
        address: [jj.address_line_1, jj.address_line_2, jj.city].filter(Boolean).join(", ") || "—",
        postcode: jj.postcode || "—",
        date: jj.preferred_date ? String(jj.preferred_date).slice(0, 10) : "—",
        time: jj.preferred_time || "—",
        notes: jj.notes || undefined,
      });
    } else {
      setJob(null);
    }

    const { data: qrData, error: qrError } = await supabase
      .from("quote_requests")
      .select("*, quote_responses(*), operatives(full_name)")
      .eq("job_id", jobId)
      .order("sent_at", { ascending: false });

    if (qrError) {
      setQuotes([]);
    } else if (qrData?.length) {
      const quoteRequestIds = (qrData as { id: string }[]).map((r) => r.id);
      const { data: respData } = await supabase
        .from("quote_responses")
        .select("*")
        .in("quote_request_id", quoteRequestIds);
      const responsesByRequestId = (respData || []).reduce((acc, r) => {
        acc[r.quote_request_id] = r;
        return acc;
      }, {} as Record<string, { id: string; quote_request_id: string; price_pence: number; customer_price_pence?: number; estimated_hours: number; available_date?: string; notes?: string; created_at: string }>);

      const mapped: QuoteRequest[] = qrData.map((qr: {
        id: string;
        job_id: string;
        operative_id: string;
        operatives?: { full_name?: string };
        status: string;
        deadline: string;
        message?: string;
        sent_at: string;
        viewed_at?: string;
        responded_at?: string;
      }) => {
        const resp = responsesByRequestId[qr.id];
        return {
          id: qr.id,
          job_id: qr.job_id,
          operative_id: qr.operative_id,
          operative_name: qr.operatives?.full_name || "Unknown",
          status: qr.status as QuoteRequest["status"],
          deadline: qr.deadline,
          message: qr.message,
          sent_at: qr.sent_at,
          viewed_at: qr.viewed_at,
          responded_at: qr.responded_at,
          quote_response: resp
            ? {
                id: resp.id,
                quote_request_id: resp.quote_request_id,
                price_pence: resp.price_pence,
                customer_price_pence: resp.customer_price_pence,
                estimated_hours: resp.estimated_hours,
                available_date: resp.available_date,
                notes: resp.notes,
                created_at: resp.created_at,
              }
            : undefined,
        };
      });
      setQuotes(mapped);
    } else {
      setQuotes([]);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    const run = async () => {
      await loadJobAndQuotes();
      setLoading(false);
    };
    run();
  }, [jobId, loadJobAndQuotes]);

  useEffect(() => {
    if (showAddQuoteModal && contractors.length === 0) {
      const supabase = createClient();
      supabase
        .from("operatives")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name")
        .then(({ data }) => {
          setContractors((data || []).map((c: { id: string; full_name?: string; email?: string }) => ({
            id: c.id,
            full_name: c.full_name || "",
            email: c.email || "",
          })));
        });
    }
  }, [showAddQuoteModal, contractors.length]);

  const highlightQuoteId = searchParams.get("quote");
  useEffect(() => {
    if (!highlightQuoteId || quotes.length === 0) return;
    const el = quoteRefs.current[highlightQuoteId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      el.classList.add("ring-2", "ring-brand-500/50");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-brand-500/50"), 2000);
      return () => clearTimeout(t);
    }
  }, [highlightQuoteId, quotes.length]);

  const addQuoteContractors = contractors.filter((c) => !quotes.some((q) => q.operative_id === c.id));

  const handleAddQuote = async () => {
    const operativeId = addQuoteForm.contractorId;
    const pricePence = Math.round(parseFloat(addQuoteForm.pricePounds || "0") * 100);
    if (!operativeId || pricePence <= 0 || !jobId || !job) {
      toast({ type: "error", title: "Invalid", message: "Select a contractor and enter a valid price." });
      return;
    }
    if (quotes.some((q) => q.operative_id === operativeId)) {
      toast({ type: "error", title: "Already added", message: "This contractor already has a quote for this job." });
      return;
    }
    setAddQuoteLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const deadline = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const respondedAt = new Date().toISOString();

    // Link only the contract for THIS job's service (not any other contracts on the contractor's profile)
    const { data: jobRow } = await supabase.from("jobs").select("service_id").eq("id", jobId).single();
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
    }

    const { data: qr, error: qrError } = await supabase
      .from("quote_requests")
      .insert({
        job_id: jobId,
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
      setAddQuoteLoading(false);
      return;
    }

    const jobDate = job.date && job.date !== "—" ? job.date.slice(0, 10) : null;
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
      setAddQuoteLoading(false);
      return;
    }

    const operativeName = (qr as { operatives?: { full_name?: string } }).operatives?.full_name || "Unknown";
    setQuotes((prev) => [
      {
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
          notes: addQuoteForm.notes || undefined,
          created_at: resp.created_at,
        },
      },
      ...prev,
    ]);
    if (job.status === "pending") {
      await supabase.from("jobs").update({ status: "quotes_received" }).eq("id", jobId);
      setJob((p) => (p ? { ...p, status: "quotes_received" } : null));
    }
    setShowAddQuoteModal(false);
    setAddQuoteForm({ contractorId: "", pricePounds: "", hours: "", arrivalTime: "", notes: "" });
    toast({ type: "success", title: "Quote added", message: `${operativeName}'s quote has been added.` });
    setAddQuoteLoading(false);
  };

  const handleRemoveAllQuotes = async () => {
    if (!jobId || !job) return;
    setRemovingAll(true);
    const supabase = createClient();
    const { error: delErr } = await supabase.from("quote_requests").delete().eq("job_id", jobId);
    if (delErr) {
      toast({ type: "error", title: "Error", message: delErr.message });
      setRemovingAll(false);
      setRemoveAllModal(false);
      return;
    }
    await supabase.from("jobs").update({ status: "pending" }).eq("id", jobId);
    setQuotes([]);
    setJob((prev) => prev ? { ...prev, status: "pending" } : null);
    toast({ type: "success", title: "Quotes removed", message: "All quotes for this job have been removed." });
    setRemovingAll(false);
    setRemoveAllModal(false);
  };

  const handleSendAllToCustomer = async () => {
    if (!job) return;
    const withResponse = quotes.filter((q) => q.quote_response);
    if (withResponse.length === 0) {
      toast({ type: "error", title: "No quotes to send", message: "No quote responses to send to the customer." });
      return;
    }
    setSendingAll(true);
    const supabase = createClient();
    for (const qr of withResponse) {
      const customerPrice = Math.round(qr.quote_response!.price_pence * (1 + SERVICE_FEE_RATE));
      await supabase.from("quote_responses").update({ customer_price_pence: customerPrice }).eq("id", qr.quote_response!.id);
    }
    await supabase
      .from("jobs")
      .update({ status: "sent_to_customer", quotes_sent_to_customer_at: new Date().toISOString() })
      .eq("id", job.id);
    const first = withResponse[0];
    const customerPrice = Math.round(first.quote_response!.price_pence * (1 + SERVICE_FEE_RATE));
    const durationMin = first.quote_response!.estimated_hours ? Math.round(Number(first.quote_response!.estimated_hours) * 60) : 60;
    const { data: existing } = await supabase.from("quotes").select("id").eq("job_id", job.id).limit(1).maybeSingle();
    if (existing) {
      await supabase.from("quotes").update({ min_price_pence: customerPrice, max_price_pence: customerPrice, estimated_duration_min: durationMin, operatives_required: 1 }).eq("id", existing.id);
    } else {
      await supabase.from("quotes").insert({ job_id: job.id, min_price_pence: customerPrice, max_price_pence: customerPrice, estimated_duration_min: durationMin, operatives_required: 1 });
    }
    setJob((prev) => prev ? { ...prev, status: "sent_to_customer" } : null);
    toast({ type: "success", title: "Sent to customer", message: `${withResponse.length} quote(s) sent to customer.` });
    setSendingAll(false);
  };

  const handleSendOneToCustomer = async (qr: QuoteRequest) => {
    if (!job || !qr.quote_response) return;
    setSendingOne(qr.id);
    const supabase = createClient();
    const customerPrice = Math.round(qr.quote_response.price_pence * (1 + SERVICE_FEE_RATE));
    await supabase.from("quote_responses").update({ customer_price_pence: customerPrice }).eq("id", qr.quote_response.id);
    await supabase
      .from("jobs")
      .update({ status: "sent_to_customer", quotes_sent_to_customer_at: new Date().toISOString() })
      .eq("id", job.id);
    const durationMin = qr.quote_response.estimated_hours ? Math.round(Number(qr.quote_response.estimated_hours) * 60) : 60;
    const { data: existing } = await supabase.from("quotes").select("id").eq("job_id", job.id).limit(1).maybeSingle();
    if (existing) {
      await supabase.from("quotes").update({ min_price_pence: customerPrice, max_price_pence: customerPrice, estimated_duration_min: durationMin, operatives_required: 1 }).eq("id", existing.id);
    } else {
      await supabase.from("quotes").insert({ job_id: job.id, min_price_pence: customerPrice, max_price_pence: customerPrice, estimated_duration_min: durationMin, operatives_required: 1 });
    }
    setJob((prev) => prev ? { ...prev, status: "sent_to_customer" } : null);
    setQuotes((prev) =>
      prev.map((q) =>
        q.id === qr.id && q.quote_response
          ? { ...q, quote_response: { ...q.quote_response, customer_price_pence: customerPrice } }
          : q
      )
    );
    toast({ type: "success", title: "Sent to customer", message: `Quote from ${qr.operative_name} sent. Customer dashboard updated.` });
    setSendingOne(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-400">
        Job not found.
        <Link href="/jobs" className="ml-2 underline">Back to Jobs</Link>
      </div>
    );
  }

  const terminalOrAccepted = ["customer_accepted", "accepted", "completed", "funds_released"];
  const canSend = !terminalOrAccepted.includes(job.status) && quotes.some((q) => q.quote_response);
  const hasQuotesToSend = quotes.some(
    (q) => q.quote_response && (job.status !== "sent_to_customer" || (q.quote_response as { customer_price_pence?: number }).customer_price_pence == null)
  );
  const showSendAllButton = quotes.length > 0 && !terminalOrAccepted.includes(job.status) && hasQuotesToSend;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/jobs/${job.id}`} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Job
        </Link>
        <span className="text-slate-600">|</span>
        <span className="text-sm font-medium text-slate-300">
          {job.service} · {job.reference}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Customer job info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <FileText className="h-4 w-4 text-slate-500" />
              Customer&apos;s job
            </h2>
            <div className="mt-4 space-y-3">
              <Field label="Service" value={job.service} />
              <Field label="Reference" value={job.reference} />
              <Field label="Status" value={job.status} />
              <Field label="Customer" value={job.customer_name} />
              <Field label="Email" value={job.customer_email || "—"} />
              <Field label="Address" value={job.address} />
              <Field label="Postcode" value={job.postcode} />
              <Field label="Preferred date" value={job.date !== "—" ? new Date(job.date).toLocaleDateString("en-GB") : "—"} />
              <Field label="Preferred time" value={job.time} />
              {job.notes && (
                <div>
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="mt-0.5 text-sm text-slate-300">{job.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Create quote, send, and quote tracking */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddQuoteModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" />
              Create quote
            </button>
            {showSendAllButton && (
              <button
                onClick={() => { setSendAllModal(true); setSendAllListExpanded(false); }}
                disabled={sendingAll || sendingOne !== null}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send all
              </button>
            )}
            {quotes.length > 0 && (
              <button
                onClick={() => setRemoveAllModal(true)}
                disabled={removingAll || sendingAll}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                {removingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove all
              </button>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Quote tracking</h2>
            {job.status === "cancelled" && job.cancelled_reason === "quotes_declined" && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                Customer declined all quotes. All quotes below show as rejected.
              </div>
            )}
            {quotes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="text-slate-400">No quotes for this job yet.</p>
                <button
                  onClick={() => setShowAddQuoteModal(true)}
                  className="mt-3 inline-flex items-center gap-2 text-brand-400 hover:text-brand-300"
                >
                  <Plus className="h-4 w-4" />
                  Create quote
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {quotes.map((qr) => {
                  const customerRejected = job.status === "cancelled" && job.cancelled_reason === "quotes_declined";
                  const badge = customerRejected ? QR_STATUS_BADGE.rejected_by_customer : (QR_STATUS_BADGE[qr.status] ?? QR_STATUS_BADGE.sent);
                  const notYetSent = (qr.quote_response as { customer_price_pence?: number } | undefined)?.customer_price_pence == null;
const canSendOne = qr.quote_response && !terminalOrAccepted.includes(job.status) && (job.status !== "sent_to_customer" || notYetSent);
                  return (
                    <div
                      key={qr.id}
                      ref={(el) => { quoteRefs.current[qr.id] = el; }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-[box-shadow] hover:border-white/20"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-200">{qr.operative_name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Sent {new Date(qr.sent_at).toLocaleDateString("en-GB")} · Deadline {new Date(qr.deadline).toLocaleDateString("en-GB")}
                          </p>
                          {qr.quote_response && (
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                              <span className="font-semibold text-emerald-400">£{(qr.quote_response.price_pence / 100).toFixed(2)}</span>
                              <span className="text-slate-500">{qr.quote_response.estimated_hours}h est.</span>
                              <span className="flex items-center gap-1 text-violet-400">
                                <Banknote className="h-3.5 w-3.5" />
                                £{(Math.round(qr.quote_response.price_pence * (1 + SERVICE_FEE_RATE)) / 100).toFixed(2)}
                                <span className="text-slate-500">customer (inc. fee)</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/jobs/${job.id}/quotes/${qr.id}`}
                            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                          {canSendOne && (
                            <button
                              onClick={() => handleSendOneToCustomer(qr)}
                              disabled={sendingAll || sendingOne !== null}
                              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                            >
                              {sendingOne === qr.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
                              Send to customer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Send all — bottom right */}
          {showSendAllButton && (
            <div className="flex justify-end pt-4">
              <button
                onClick={() => { setSendAllModal(true); setSendAllListExpanded(false); }}
                disabled={sendingAll || sendingOne !== null}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send all
              </button>
            </div>
          )}
        </div>
      </div>

        {/* Create quote modal */}
      {showAddQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddQuoteModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Create quote</h2>
            <p className="mt-1 text-sm text-slate-400">Add a contractor quote. You can edit and send to the customer from the list.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400">Contractor</label>
                <CustomDropdown
                  value={addQuoteForm.contractorId}
                  onChange={(v) => setAddQuoteForm((f) => ({ ...f, contractorId: v }))}
                  options={addQuoteContractors.map((c) => ({ value: c.id, label: c.full_name || c.email || c.id.slice(0, 8) }))}
                  placeholder="Select contractor"
                  className="mt-0.5"
                />
                {addQuoteContractors.length === 0 && contractors.length > 0 && (
                  <p className="mt-1 text-xs text-amber-400">All selected contractors already have a quote for this job.</p>
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
              <div>
                <label className="block text-[11px] text-slate-400">Time of arrival (optional)</label>
                <TimePicker value={addQuoteForm.arrivalTime} onChange={(v) => setAddQuoteForm((f) => ({ ...f, arrivalTime: v }))} className="mt-0.5" />
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
                disabled={addQuoteLoading || addQuoteContractors.length === 0 || !addQuoteForm.contractorId || !addQuoteForm.pricePounds}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {addQuoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create quote
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

      {removeAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-200">Remove all quotes?</h3>
              <button onClick={() => !removingAll && setRemoveAllModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              This will delete all quote requests and responses for this job. The job status will be set back to Pending. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => !removingAll && setRemoveAllModal(false)} disabled={removingAll} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleRemoveAllQuotes}
                disabled={removingAll}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {removingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send all confirmation modal */}
      {sendAllModal && showSendAllButton && (() => {
        const contractorsToSend = quotes.filter((q) => q.quote_response).map((q) => q.operative_name);
        const hasAnyToSend = contractorsToSend.length > 0;
        const VISIBLE_COUNT = 3;
        const hasMore = contractorsToSend.length > VISIBLE_COUNT;
        const visible = sendAllListExpanded ? contractorsToSend : contractorsToSend.slice(0, VISIBLE_COUNT);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !sendingAll && setSendAllModal(false)}>
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-200">Send all to customer?</h3>
                <button onClick={() => !sendingAll && setSendAllModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {hasAnyToSend
                  ? "The customer will see these quotes in their dashboard and can choose one. Send now?"
                  : "No quotes have price details yet. Use Edit on each quote to add price and details, then you can send all."}
              </p>
              <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {hasAnyToSend ? (
                  <>
                    <ul className="space-y-1.5 text-sm text-slate-200">
                      {visible.map((name, i) => (
                        <li key={i} className="list-disc pl-4">{name}</li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setSendAllListExpanded((e) => !e)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                      >
                        {sendAllListExpanded ? (
                          <> <ChevronUp className="h-3.5 w-3.5" /> Show less</>
                        ) : (
                          <> <ChevronDown className="h-3.5 w-3.5" /> Show more ({contractorsToSend.length - VISIBLE_COUNT} more)</>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Add price and details via Edit on each quote card.</p>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => !sendingAll && setSendAllModal(false)}
                  disabled={sendingAll}
                  className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleSendAllToCustomer();
                    setSendAllModal(false);
                  }}
                  disabled={sendingAll || sendingOne !== null || !hasAnyToSend}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send all
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}
