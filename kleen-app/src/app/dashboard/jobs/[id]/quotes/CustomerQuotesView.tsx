"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/lib/notifications";
import { usePaymentMethodStore } from "@/lib/payment-methods";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { AcceptQuoteFlowModal } from "@/components/dashboard/AcceptQuoteFlowModal";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Star,
  AlertTriangle,
  Undo2,
  XCircle,
} from "lucide-react";

const UNDO_SECONDS = 10;

interface JobBasic {
  id: string;
  reference: string;
  status: string;
  accepted_quote_request_id: string | null;
}

interface CustomerQuote {
  id: string;
  quote_request_id: string;
  customer_price_pence: number;
  estimated_hours: number;
  available_date: string | null;
  contractor_rating: number;
  contractor_label: string;
  customer_declined_at: string | null;
  operative_service_id?: string | null;
}

type UndoState =
  | { type: "accepted"; quote_request_id: string }
  | { type: "declined"; quote_request_id: string }
  | null;

export default function CustomerQuotesView({
  stripePublishableKey,
}: {
  stripePublishableKey: string;
}) {
  const { id } = useParams();
  const toast = useNotifications((s) => s.push);

  const stripePromise = useMemo(
    () =>
      typeof window !== "undefined" && stripePublishableKey
        ? loadStripe(stripePublishableKey, { locale: "en-GB" })
        : null,
    [stripePublishableKey]
  );
  const elementsStripePromise = stripePromise ?? Promise.resolve(null);

  const [job, setJob] = useState<JobBasic | null>(null);
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [undoState, setUndoState] = useState<UndoState>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pmStore = usePaymentMethodStore();
  const [payModalQuote, setPayModalQuote] = useState<CustomerQuote | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: j } = await supabase
      .from("jobs")
      .select("id, reference, status, accepted_quote_request_id")
      .eq("id", id as string)
      .eq("user_id", user.id)
      .single();

    if (!j) {
      setJob(null);
      setQuotes([]);
      setLoading(false);
      return;
    }

    setJob({
      id: j.id,
      reference: j.reference || j.id.slice(0, 8).toUpperCase(),
      status: j.status,
      accepted_quote_request_id: j.accepted_quote_request_id || null,
    });

    const showQuotes = [
      "sent_to_customer", "customer_accepted", "accepted",
      "awaiting_completion", "in_progress", "pending_confirmation",
      "completed", "funds_released",
    ].includes(j.status);

    if (showQuotes) {
      const { data: qrData } = await supabase
        .from("quote_requests")
        .select("id, operative_id, customer_declined_at, operatives(avg_rating)")
        .eq("job_id", id as string)
        .eq("status", "quoted");
      if (qrData?.length) {
        const qrIds = (qrData as { id: string }[]).map((r) => r.id);
        const { data: respData } = await supabase
          .from("quote_responses")
          .select("id, quote_request_id, customer_price_pence, estimated_hours, available_date, operative_service_id")
          .in("quote_request_id", qrIds);
        const byRequestId = (respData || []).reduce((acc, r) => {
          acc[r.quote_request_id] = r;
          return acc;
        }, {} as Record<string, { id: string; quote_request_id: string; customer_price_pence: number; estimated_hours?: number; available_date?: string | null; operative_service_id?: string | null }>);
        const mapped: CustomerQuote[] = [];
        qrData.forEach((qr: { id: string; operative_id: string; customer_declined_at?: string | null; operatives?: { avg_rating?: number } }, i: number) => {
          const resp = byRequestId[qr.id];
          if (resp?.customer_price_pence) {
            mapped.push({
              id: resp.id,
              quote_request_id: qr.id,
              customer_price_pence: resp.customer_price_pence,
              estimated_hours: resp.estimated_hours || 0,
              available_date: resp.available_date || null,
              contractor_rating: qr.operatives?.avg_rating || 0,
              contractor_label: `Contractor ${String.fromCharCode(65 + i)}`,
              customer_declined_at: qr.customer_declined_at || null,
              operative_service_id: resp.operative_service_id ?? null,
            });
          }
        });
        mapped.sort((a, b) => a.customer_price_pence - b.customer_price_pence);
        setQuotes(mapped);
      } else {
        setQuotes([]);
      }
    } else {
      setQuotes([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    pmStore.syncFromSupabase(supabase);
  }, [id]);

  useEffect(() => {
    if (undoState === null) {
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      return;
    }
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((c) => {
        if (c <= 1) {
          if (undoTimerRef.current) {
            clearInterval(undoTimerRef.current);
            undoTimerRef.current = null;
          }
          setUndoState(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [undoState]);

  const handleAccept = (q: CustomerQuote) => {
    if (!job) return;
    setPayModalQuote(q);
  };

  const handlePayModalClose = () => {
    setPayModalQuote(null);
    setPayLoading(false);
  };

  const handlePaySuccess = useCallback(() => {
    handlePayModalClose();
    load();
    toast({ type: "success", title: "Quote accepted", message: "Payment received. Your job is confirmed." });
  }, [load, toast]);

  const handleDecline = async (q: CustomerQuote) => {
    if (!job) return;
    setActionLoading(true);
    const supabase = createClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("quote_requests")
      .update({ customer_declined_at: now })
      .eq("id", q.quote_request_id);

    if (error) {
      toast({ type: "error", title: "Error", message: "Failed to decline quote." });
      setActionLoading(false);
      return;
    }

    setQuotes((prev) =>
      prev.map((o) => (o.quote_request_id === q.quote_request_id ? { ...o, customer_declined_at: now } : o))
    );
    toast({ type: "info", title: "Quote declined", message: "You can undo within 10 seconds." });
    setActionLoading(false);
    setUndoState({ type: "declined", quote_request_id: q.quote_request_id });
    setUndoCountdown(UNDO_SECONDS);
  };

  const handleUndo = async () => {
    if (!job || !undoState) return;
    setActionLoading(true);
    const supabase = createClient();

    if (undoState.type === "accepted") {
      const now = new Date().toISOString();
      await supabase
        .from("jobs")
        .update({
          status: "sent_to_customer",
          accepted_quote_request_id: null,
          customer_accepted_at: null,
        })
        .eq("id", job.id);
      const allQuoteRequestIds = quotes.map((q) => q.quote_request_id);
      if (allQuoteRequestIds.length > 0) {
        await supabase
          .from("quote_requests")
          .update({ customer_declined_at: null })
          .in("id", allQuoteRequestIds);
      }
      setJob({ ...job, status: "sent_to_customer", accepted_quote_request_id: null });
      setQuotes((prev) => prev.map((q) => ({ ...q, customer_declined_at: null })));
      toast({ type: "info", title: "Undone", message: "Quote acceptance reversed." });
    } else {
      await supabase
        .from("quote_requests")
        .update({ customer_declined_at: null })
        .eq("id", undoState.quote_request_id);
      setQuotes((prev) =>
        prev.map((q) =>
          q.quote_request_id === undoState.quote_request_id ? { ...q, customer_declined_at: null } : q
        )
      );
      toast({ type: "info", title: "Undone", message: "Decline reversed." });
    }

    setUndoState(null);
    setUndoCountdown(0);
    if (undoTimerRef.current) {
      clearInterval(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <AlertTriangle className="h-10 w-10 text-slate-300" />
        <p className="text-slate-500">Job not found</p>
        <Link href="/dashboard/jobs" className="text-sm font-medium text-brand-600 hover:underline">
          Back to My Jobs
        </Link>
      </div>
    );
  }

  const canChoose = job.status === "sent_to_customer" && !job.accepted_quote_request_id;
  const acceptedQuote = job.accepted_quote_request_id
    ? quotes.find((q) => q.quote_request_id === job.accepted_quote_request_id)
    : null;
  // When one quote is accepted, all others are effectively declined (webhook sets customer_declined_at)
  const declinedQuotes = acceptedQuote
    ? quotes.filter((q) => q.quote_request_id !== job.accepted_quote_request_id)
    : quotes.filter((q) => q.customer_declined_at);
  const availableQuotes = acceptedQuote ? [] : quotes.filter((q) => !q.customer_declined_at);
  const formatPrice = (pence: number) => `£${(pence / 100).toFixed(2)}`;

  const quoteCard = (q: CustomerQuote, options: { isAccepted?: boolean; isDeclined?: boolean; isBestPrice?: boolean; showActions?: boolean }) => (
    <div
      key={q.id}
      className={`rounded-2xl border p-5 transition-colors ${
        options.isAccepted
          ? "border-brand-300 bg-brand-50"
          : options.isDeclined
          ? "border-slate-200 bg-slate-100"
          : options.isBestPrice
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-slate-900">{q.contractor_label}</p>
            {options.isAccepted && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                ACCEPTED
              </span>
            )}
            {options.isDeclined && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                DECLINED
              </span>
            )}
            {options.isBestPrice && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
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
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span>Est. {q.estimated_hours}h</span>
            {q.available_date && (
              <span>
                Available {new Date(q.available_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-2xl font-bold text-slate-900">{formatPrice(q.customer_price_pence)}</p>
          {options.showActions && (
            <>
              <button
                type="button"
                onClick={() => handleDecline(q)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleAccept(q)}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                View full quote
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Link
        href={`/dashboard/jobs/${job.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">
        {acceptedQuote ? "Your quote" : "Choose Your Quote"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {job.reference}
        {acceptedQuote
          ? " · Job confirmed and in progress"
          : ` · ${availableQuotes.length} quote${availableQuotes.length !== 1 ? "s" : ""} to choose from`}
      </p>

      {/* Success / in-progress banner when a quote has been accepted */}
      {acceptedQuote && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-900">Quote accepted</p>
            <p className="text-sm text-emerald-700">
              Payment received. Your job is confirmed with {acceptedQuote.contractor_label} — {formatPrice(acceptedQuote.customer_price_pence)}.
            </p>
          </div>
          <Link
            href={`/dashboard/jobs/${job.id}`}
            className="ml-auto shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            View job
          </Link>
        </div>
      )}

      {undoState && undoCountdown > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            {undoState.type === "accepted"
              ? "Quote accepted."
              : "Quote declined."}{" "}
            Undo within {undoCountdown}s?
          </p>
          <button
            onClick={handleUndo}
            disabled={actionLoading}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-2 text-sm font-medium text-amber-800">No quotes to show</p>
          <p className="mt-1 text-xs text-amber-700">
            Quotes may still be on the way. Check back on the job page or refresh.
          </p>
          <Link
            href={`/dashboard/jobs/${job.id}`}
            className="mt-3 inline-block rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Back to job
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Your chosen quote / in progress — shown first when accepted */}
          {acceptedQuote && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your chosen quote · Job in progress
              </h2>
              {quoteCard(acceptedQuote, { isAccepted: true })}
            </section>
          )}

          {/* Available quotes to choose from (only when none accepted yet) */}
          {availableQuotes.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Choose a quote
              </h2>
              <div className="space-y-4">
                {availableQuotes.map((q, i) =>
                  quoteCard(q, {
                    isBestPrice: i === 0,
                    showActions: canChoose && !undoState,
                  })
                )}
              </div>
            </section>
          )}

          {/* Declined quotes — own section below */}
          {declinedQuotes.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Declined
              </h2>
              <div className="space-y-4">
                {declinedQuotes.map((q) => quoteCard(q, { isDeclined: true }))}
              </div>
            </section>
          )}
        </div>
      )}

      {payModalQuote && job && (
        <Elements stripe={elementsStripePromise} options={{ locale: "en-GB" }}>
          <AcceptQuoteFlowModal
            jobId={job.id}
            jobReference={job.reference}
            quote={{
              quote_request_id: payModalQuote.quote_request_id,
              customer_price_pence: payModalQuote.customer_price_pence,
              operative_service_id: payModalQuote.operative_service_id ?? undefined,
            }}
            onSuccess={handlePaySuccess}
            onClose={handlePayModalClose}
            setPayLoading={setPayLoading}
            payLoading={payLoading}
            toast={toast}
          />
        </Elements>
      )}
    </div>
  );
}
