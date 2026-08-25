/** Statuses where live field activity applies (after customer paid). */
export const POST_PAYMENT_JOB_STATUSES = [
  "customer_accepted",
  "accepted",
  "awaiting_completion",
  "in_progress",
  "pending_confirmation",
  "completed",
  "funds_released",
] as const;

/** True when the customer paid / accepted via the dashboard — not admin pre-assign. */
export function isCustomerAcceptedJob(job: {
  accepted_quote_request_id: string | null;
  payment_authorized_at?: string | null;
  payment_captured_at?: string | null;
}): boolean {
  if (!job.accepted_quote_request_id) return false;
  return Boolean(job.payment_authorized_at || job.payment_captured_at);
}
