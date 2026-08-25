import { contractorPortalUrl, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendKleenEmail } from "@/lib/email/send";

/**
 * Email the contractor when a customer accepts their quote (job booked).
 * Shows their payout (quoted price), not the customer total incl. platform fee.
 */
export async function sendContractorJobBookedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  jobId: string;
  /** Contractor quote / payout in pence (`quote_responses.price_pence`) */
  payoutPence: number;
}): Promise<{ ok: boolean }> {
  const payout = `£${(params.payoutPence / 100).toFixed(2)}`;
  const html = emailLayout({
    title: `Job booked — ${params.jobReference}`,
    heading: "You've got the job",
    introHtml: `<p>Hi ${escapeHtml(params.contractorName)}, a customer has accepted your quote and authorised payment (held in escrow until the job is completed).</p>`,
    rows: [
      { label: "Reference", value: escapeHtml(params.jobReference) },
      { label: "Your payout", value: payout },
    ],
    cta: {
      href: contractorPortalUrl(`/contractor/jobs/${params.jobId}`),
      label: "Open job in your dashboard",
    },
    footerNote: "Your payout is the amount you quoted. Use On my way when you head to the job so the customer is notified.",
  });

  return sendKleenEmail({
    to: params.toEmail,
    subject: `Job booked — ${params.jobReference}`,
    html,
  });
}
