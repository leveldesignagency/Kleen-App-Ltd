import type { QuoteRequest } from "@/lib/admin-store";

export type QuoteCustomerBadge = { label: string; cls: string };

type JobAcceptContext = {
  accepted_quote_request_id?: string | null;
  customer_accepted_at?: string | null;
  status: string;
};

/** True only when the customer chose this quote after it was sent — not admin pre-assign. */
export function isCustomerAcceptedQuote(
  qr: Pick<QuoteRequest, "id" | "quote_response">,
  job: JobAcceptContext,
): boolean {
  if (!job.accepted_quote_request_id || job.accepted_quote_request_id !== qr.id) return false;
  if (!job.customer_accepted_at) return false;
  if (!qr.quote_response?.sent_to_customer_at) return false;
  return true;
}

/** Per-quote status from the customer's accept / decline actions. */
export function quoteCustomerStatusBadge(
  qr: Pick<QuoteRequest, "id" | "customer_declined_at" | "quote_response">,
  job: JobAcceptContext,
): QuoteCustomerBadge | null {
  if (isCustomerAcceptedQuote(qr, job)) {
    return { label: "Accepted by customer", cls: "bg-brand-500/20 text-brand-300" };
  }
  if (qr.customer_declined_at) {
    return { label: "Declined by customer", cls: "bg-red-500/20 text-red-400" };
  }
  if (qr.quote_response?.sent_to_customer_at) {
    return { label: "With customer", cls: "bg-violet-500/20 text-violet-400" };
  }
  return null;
}

/** Job-level banner: customer accepted a quote (not admin-only assignment). */
export function findCustomerAcceptedQuote<T extends Pick<QuoteRequest, "id" | "quote_response">>(
  quotes: T[],
  job: JobAcceptContext,
): T | null {
  if (!job.accepted_quote_request_id) return null;
  const qr = quotes.find((q) => q.id === job.accepted_quote_request_id);
  if (!qr || !isCustomerAcceptedQuote(qr, job)) return null;
  return qr;
}
