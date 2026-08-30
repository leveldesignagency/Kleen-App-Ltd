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

/** Contractor: customer rebooked after a could-not-start visit. */
export async function sendContractorJobRebookedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  jobId: string;
  preferredDate: string;
  preferredTime?: string | null;
}): Promise<{ ok: boolean }> {
  const name = params.contractorName.trim() || "there";
  const when = params.preferredTime
    ? `${params.preferredDate} · ${params.preferredTime.slice(0, 5)}`
    : params.preferredDate;
  const html = emailLayout({
    title: `Job rebooked — ${params.jobReference}`,
    heading: "Customer picked a new date",
    introHtml: `<p>Hi ${escapeHtml(name)}, the customer has rebooked job <strong>${escapeHtml(params.jobReference)}</strong> with you after the previous visit could not start.</p>`,
    rows: [
      { label: "Reference", value: escapeHtml(params.jobReference) },
      { label: "New schedule", value: escapeHtml(when) },
    ],
    cta: {
      href: contractorPortalUrl(`/contractor/jobs/${params.jobId}`),
      label: "Open job in your dashboard",
    },
  });

  return sendKleenEmail({
    to: params.toEmail,
    subject: `Job rebooked — ${params.jobReference}`,
    html,
  });
}

/** Contractor: customer opened a dispute on an assigned job. */
export async function sendContractorDisputeOpenedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  jobId: string;
  reason?: string;
}): Promise<{ ok: boolean }> {
  const name = params.contractorName.trim() || "there";
  const html = emailLayout({
    title: `Dispute — ${params.jobReference}`,
    heading: "A customer opened a dispute",
    introHtml: `<p>Hi ${escapeHtml(name)}, a customer raised a dispute on job <strong>${escapeHtml(params.jobReference)}</strong>. Kleen mediates — reply in your disputes inbox. Funds stay held until the case is resolved.</p>`,
    rows: params.reason ? [{ label: "Reason", value: escapeHtml(params.reason) }] : undefined,
    cta: {
      href: contractorPortalUrl(`/contractor/disputes`),
      label: "Open disputes",
    },
  });

  return sendKleenEmail({
    to: params.toEmail,
    subject: `Dispute — ${params.jobReference}`,
    html,
  });
}

/** Contractor: dispute resolved / closed. */
export async function sendContractorDisputeResolvedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  resolution?: string | null;
  status?: string;
}): Promise<{ ok: boolean }> {
  const name = params.contractorName.trim() || "there";
  const closed = params.status === "closed";
  const html = emailLayout({
    title: `Dispute ${closed ? "closed" : "resolved"} — ${params.jobReference}`,
    heading: closed ? "Dispute closed" : "Dispute resolved",
    introHtml: `<p>Hi ${escapeHtml(name)}, Kleen has ${closed ? "closed" : "resolved"} the dispute on job <strong>${escapeHtml(params.jobReference)}</strong>.</p>`,
    rows: params.resolution
      ? [{ label: "Resolution", value: escapeHtml(params.resolution) }]
      : undefined,
    cta: {
      href: contractorPortalUrl(`/contractor/disputes`),
      label: "View disputes",
    },
  });

  return sendKleenEmail({
    to: params.toEmail,
    subject: `Dispute ${closed ? "closed" : "resolved"} — ${params.jobReference}`,
    html,
  });
}
