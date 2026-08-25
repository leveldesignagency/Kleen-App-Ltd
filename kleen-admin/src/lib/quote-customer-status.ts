import type { QuoteRequest } from "@/lib/admin-store";

export type QuoteCustomerBadge = { label: string; cls: string };

/** Per-quote status from the customer's accept / decline actions. */
export function quoteCustomerStatusBadge(
  qr: Pick<QuoteRequest, "id" | "customer_declined_at" | "quote_response">,
  job: { accepted_quote_request_id?: string | null; status: string },
): QuoteCustomerBadge | null {
  if (job.accepted_quote_request_id && job.accepted_quote_request_id === qr.id) {
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
