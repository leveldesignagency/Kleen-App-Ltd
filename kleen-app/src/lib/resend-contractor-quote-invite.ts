import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";
import { contractorPortalOrigin } from "@/lib/contractor-portal-url";

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("sendContractorNewJobQuoteInviteEmail: RESEND_API_KEY not set, skipping");
    return { ok: false };
  }

  const base = contractorPortalOrigin();
  const jobsUrl = `${base}/contractor/jobs`;
  const dateLabel = params.preferredDate
    ? new Date(params.preferredDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "TBC";

  const resend = new Resend(apiKey);
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New job to quote — ${params.jobReference}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">New job available</h1>
  <p style="color: #64748b; margin-bottom: 16px;">Hi ${escapeHtml(params.contractorName)}, a customer has posted a job that matches your services. Log in to submit your quote.</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Reference</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.jobReference)}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Service</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.serviceName)}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Area</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.postcode)}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Preferred date</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${escapeHtml(dateLabel)}</td></tr>
  </table>
  <p style="margin-top: 24px;">
    <a href="${jobsUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">View jobs &amp; submit quote</a>
  </p>
  <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Quotes you submit are sent straight to the customer for review.</p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    const { error } = await resend.emails.send({
      from,
      to: params.toEmail.trim(),
      subject: `New job to quote — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendContractorNewJobQuoteInviteEmail:", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendContractorNewJobQuoteInviteEmail failed:", e);
    return { ok: false };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
