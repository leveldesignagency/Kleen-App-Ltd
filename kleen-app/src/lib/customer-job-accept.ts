/** True when the customer paid / accepted via the dashboard — not admin pre-assign. */
export function isCustomerAcceptedJob(job: {
  status: string;
  accepted_quote_request_id: string | null;
  payment_authorized_at?: string | null;
  payment_captured_at?: string | null;
}): boolean {
  if (!job.accepted_quote_request_id) return false;
  if (job.payment_authorized_at || job.payment_captured_at) return true;
  return false;
}
