import { contractorPortalUrl, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendKleenEmail } from "@/lib/email/send";

/**
 * Email a contractor when a new job matching their services is available to quote.
 */
export async function sendContractorNewJobQuoteInviteEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  jobId: string;
  serviceName: string;
  postcode: string;
  preferredDate: string;
}): Promise<{ ok: boolean }> {
  const dateLabel = params.preferredDate
    ? new Date(params.preferredDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "TBC";

  const html = emailLayout({
    title: `New job to quote — ${params.jobReference}`,
    heading: "New job available",
    introHtml: `<p>Hi ${escapeHtml(params.contractorName)}, a customer has posted a job that matches your services. Log in to submit your quote.</p>`,
    rows: [
      { label: "Reference", value: escapeHtml(params.jobReference) },
      { label: "Service", value: escapeHtml(params.serviceName) },
      { label: "Area", value: escapeHtml(params.postcode) },
      { label: "Preferred date", value: escapeHtml(dateLabel) },
    ],
    cta: { href: contractorPortalUrl("/contractor/jobs"), label: "View jobs & submit quote" },
    footerNote: "Quotes you submit are sent straight to the customer for review.",
  });

  return sendKleenEmail({
    to: params.toEmail,
    subject: `New job to quote — ${params.jobReference}`,
    html,
  });
}
