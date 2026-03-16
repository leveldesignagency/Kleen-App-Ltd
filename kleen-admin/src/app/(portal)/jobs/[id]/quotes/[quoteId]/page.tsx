"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import type { QuoteRequest } from "@/lib/admin-store";
import {
  ArrowLeft,
  Loader2,
  Forward,
  Banknote,
  FileText,
  Check,
  XCircle,
} from "lucide-react";

const SERVICE_FEE_RATE = 0.175;

function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return "";
  const s = typeof date === "string" ? date : new Date(date).toISOString();
  return s.slice(0, 10);
}

const QR_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  sent:     { label: "Sent",     cls: "bg-slate-500/20 text-slate-400" },
  viewed:   { label: "Viewed",   cls: "bg-blue-500/20 text-blue-400" },
  quoted:   { label: "Quoted",   cls: "bg-emerald-500/20 text-emerald-400" },
  declined: { label: "Declined", cls: "bg-red-500/20 text-red-400" },
  expired:  { label: "Expired", cls: "bg-amber-500/20 text-amber-400" },
};

export default function QuoteEditPage() {
  const params = useParams();
  const jobId = (Array.isArray(params.id) ? params.id[0] : params.id) as string;
  const quoteId = (Array.isArray(params.quoteId) ? params.quoteId[0] : params.quoteId) as string;
  const toast = useAdminNotifications((s) => s.push);

  const [job, setJob] = useState<{ id: string; reference: string; service: string; status: string } | null>(null);
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pricePounds: "", hours: "", availableDate: "", notes: "" });

  useEffect(() => {
    if (!jobId || !quoteId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();

    const load = async () => {
      const [jobRes, quoteRequestRes, quoteResponseRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, reference, status, services(name)")
          .eq("id", jobId)
          .single(),
        supabase
          .from("quote_requests")
          .select("*, operatives(full_name)")
          .eq("id", quoteId)
          .eq("job_id", jobId)
          .single(),
        supabase
          .from("quote_responses")
          .select("*")
          .eq("quote_request_id", quoteId)
          .maybeSingle(),
      ]);

      if (jobRes.data) {
        const j = jobRes.data as { id: string; reference: string; status: string; services?: { name?: string } };
        setJob({
          id: j.id,
          reference: j.reference || j.id?.slice(0, 8).toUpperCase(),
          service: j.services?.name || "Cleaning",
          status: j.status || "pending",
        });
      }

      if (quoteRequestRes.data) {
        const qr = quoteRequestRes.data as {
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
        };
        const resp = quoteResponseRes.data as {
          id: string;
          quote_request_id: string;
          price_pence: number;
          customer_price_pence?: number;
          estimated_hours: number;
          available_date?: string;
          notes?: string;
          created_at: string;
          sent_to_customer_at?: string | null;
        } | null;
        const mapped: QuoteRequest = {
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
                sent_to_customer_at: resp.sent_to_customer_at,
                quote_request_id: resp.quote_request_id,
                price_pence: Number(resp.price_pence),
                customer_price_pence: resp.customer_price_pence != null ? Number(resp.customer_price_pence) : undefined,
                estimated_hours: Number(resp.estimated_hours) || 0,
                available_date: resp.available_date ?? undefined,
                notes: resp.notes ?? undefined,
                created_at: resp.created_at,
              }
            : undefined,
        };
        setQuote(mapped);
        if (resp) {
          const pricePence = Number(resp.price_pence);
          const hours = resp.estimated_hours != null ? Number(resp.estimated_hours) : null;
          setForm({
            pricePounds: pricePence > 0 ? (pricePence / 100).toFixed(2) : "",
            hours: hours != null ? String(hours) : "",
            availableDate: toDateInputValue(resp.available_date),
            notes: resp.notes ?? "",
          });
        } else {
          setForm({ pricePounds: "", hours: "", availableDate: "", notes: "" });
        }
      } else {
        setQuote(null);
      }
      setLoading(false);
    };

    load();
  }, [jobId, quoteId]);

  // No effect that overwrites form from quote — form is set once when data loads above.

  const handleSave = async () => {
    if (!quote) return;
    const pricePence = Math.round(parseFloat(form.pricePounds || "0") * 100);
    if (pricePence <= 0) {
      toast({ type: "error", title: "Invalid price", message: "Enter a valid price in pounds." });
      return;
    }
    setSaving(true);
    const supabase = createClient();

    if (quote.quote_response) {
      await supabase
        .from("quote_responses")
        .update({
          price_pence: pricePence,
          estimated_hours: form.hours ? parseFloat(form.hours) : null,
          available_date: form.availableDate || null,
          notes: form.notes || null,
          sent_to_customer_at: null, // edited → allow "Send to customer" again
        })
        .eq("id", quote.quote_response.id);
      setQuote((prev) =>
        prev && prev.quote_response
          ? {
              ...prev,
              quote_response: {
                ...prev.quote_response,
                price_pence: pricePence,
                estimated_hours: form.hours ? parseFloat(form.hours) : 0,
                available_date: form.availableDate || undefined,
                notes: form.notes || undefined,
                sent_to_customer_at: null,
              },
            }
          : prev
      );
      toast({ type: "success", title: "Quote updated", message: "Changes saved. You can send to customer again." });
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("quote_responses")
        .insert({
          quote_request_id: quote.id,
          price_pence: pricePence,
          estimated_hours: form.hours ? parseFloat(form.hours) : null,
          available_date: form.availableDate || null,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (insertError) {
        toast({ type: "error", title: "Failed to save quote", message: insertError.message });
        setSaving(false);
        return;
      }
      const respondedAt = new Date().toISOString();
      await supabase
        .from("quote_requests")
        .update({ status: "quoted", responded_at: respondedAt })
        .eq("id", quote.id);
      setQuote((prev) =>
        prev
          ? {
              ...prev,
              status: "quoted",
              responded_at: respondedAt,
              quote_response: {
                id: inserted.id,
                quote_request_id: quote.id,
                price_pence: pricePence,
                estimated_hours: form.hours ? parseFloat(form.hours) : 0,
                available_date: form.availableDate || undefined,
                notes: form.notes || undefined,
                created_at: inserted.created_at,
              },
            }
          : null
      );
      if (job) {
        const { data: other } = await supabase
          .from("quote_requests")
          .select("id, status")
          .eq("job_id", job.id);
        const terminal = ["quoted", "declined", "expired"];
        if (other?.every((q: { status: string }) => terminal.includes(q.status))) {
          await supabase.from("jobs").update({ status: "quotes_received" }).eq("id", job.id);
          setJob((p) => (p ? { ...p, status: "quotes_received" } : null));
        }
      }
      toast({ type: "success", title: "Quote recorded", message: "Contractor quote has been saved." });
    }
    setSaving(false);
  };

  const handleSendToCustomer = async () => {
    if (!job || !quote?.quote_response) return;
    setSaving(true);
    const supabase = createClient();
    const customerPrice = Math.round(quote.quote_response.price_pence * (1 + SERVICE_FEE_RATE));
    await supabase
      .from("quote_responses")
      .update({ customer_price_pence: customerPrice, sent_to_customer_at: new Date().toISOString() })
      .eq("id", quote.quote_response.id);
    await supabase
      .from("jobs")
      .update({ status: "sent_to_customer", quotes_sent_to_customer_at: new Date().toISOString() })
      .eq("id", job.id);
    const durationMin = quote.quote_response.estimated_hours ? Math.round(Number(quote.quote_response.estimated_hours) * 60) : 60;
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
    setJob((p) => (p ? { ...p, status: "sent_to_customer" } : null));
    setQuote((p) =>
      p?.quote_response ? { ...p, quote_response: { ...p.quote_response, sent_to_customer_at: new Date().toISOString() } } : p
    );
    try {
      const res = await fetch("/api/jobs/notify-customer-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, quoteCount: 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ type: "warning", title: "Email not sent", message: data.error || "Customer notification email could not be sent." });
      }
    } catch {
      toast({ type: "warning", title: "Email not sent", message: "Customer notification email could not be sent." });
    }
    toast({ type: "success", title: "Sent to customer", message: `Quote from ${quote.operative_name} sent to customer.` });
    setSaving(false);
  };

  const handleMarkDeclined = async () => {
    if (!quote || !job) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("quote_requests").update({ status: "declined" }).eq("id", quote.id);
    const { data: other } = await supabase.from("quote_requests").select("id, status").eq("job_id", job.id);
    const terminal = ["quoted", "declined", "expired"];
    if (other?.every((q: { status: string }) => terminal.includes(q.status))) {
      await supabase.from("jobs").update({ status: "quotes_received" }).eq("id", job.id);
      setJob((p) => (p ? { ...p, status: "quotes_received" } : null));
    }
    setQuote((p) => (p ? { ...p, status: "declined" as const } : null));
    toast({ type: "info", title: "Marked declined", message: "Contractor has been marked as declined." });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!job || !quote) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-400">
        Quote or job not found.
        <Link href={jobId ? `/jobs/${jobId}/quotes` : "/jobs"} className="ml-2 underline">
          Back to quotes
        </Link>
      </div>
    );
  }

  const badge = QR_STATUS_BADGE[quote.status] ?? QR_STATUS_BADGE.sent;
  const terminalStatuses = ["customer_accepted", "accepted", "completed", "funds_released"];
  const canSend = quote.quote_response && !terminalStatuses.includes(job.status) && quote.quote_response.sent_to_customer_at == null;
  const canAddResponse = (quote.status === "sent" || quote.status === "viewed") && !quote.quote_response;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/jobs/${job.id}/quotes`}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          All quotes for this job
        </Link>
        <span className="text-slate-600">|</span>
        <span className="text-sm font-medium text-slate-300">
          {job.service} · {job.reference}
        </span>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <FileText className="h-7 w-7 text-slate-400" />
        <h1 className="text-2xl font-bold">Edit quote</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4">
          <p className="font-semibold text-slate-200">{quote.operative_name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Sent {new Date(quote.sent_at).toLocaleDateString("en-GB")} · Deadline {new Date(quote.deadline).toLocaleDateString("en-GB")}
          </p>
          {quote.quote_response && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-emerald-400">£{(quote.quote_response.price_pence / 100).toFixed(2)}</span>
              <span className="text-slate-500">{quote.quote_response.estimated_hours}h est.</span>
              <span className="flex items-center gap-1 text-violet-400">
                <Banknote className="h-3.5 w-3.5" />
                £{(Math.round(quote.quote_response.price_pence * (1 + SERVICE_FEE_RATE)) / 100).toFixed(2)} customer (inc. fee)
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 border-t border-white/10 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400">Price (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.pricePounds}
                onChange={(e) => setForm((f) => ({ ...f, pricePounds: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                placeholder="e.g. 150"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Est. hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                placeholder="e.g. 3"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Available date (optional)</label>
            <input
              type="date"
              value={form.availableDate}
              onChange={(e) => setForm((f) => ({ ...f, availableDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="Contractor notes…"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {quote.quote_response ? "Save changes" : "Save quote"}
            </button>
            {canSend && (
              <button
                onClick={handleSendToCustomer}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                <Forward className="h-4 w-4" />
                Send to customer
              </button>
            )}
            {canAddResponse && (
              <button
                onClick={handleMarkDeclined}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Mark declined
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
