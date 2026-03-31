import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";

function dashboardBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://dashboard.kleenapp.co.uk";
}

/**
 * Email the contractor when a customer accepts their quote (job booked).
 */
export async function sendContractorJobBookedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  jobId: string;
  amountPence: number;
}): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("sendContractorJobBookedEmail: RESEND_API_KEY not set, skipping");
    return { ok: false };
  }

  const base = dashboardBaseUrl();
  const jobUrl = `${base}/contractor/jobs/${params.jobId}`;
  const amount = `£${(params.amountPence / 100).toFixed(2)}`;

  const resend = new Resend(apiKey);
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Job booked — ${params.jobReference}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">You&apos;ve got the job</h1>
  <p style="color: #64748b; margin-bottom: 16px;">Hi ${escapeHtml(params.contractorName)}, a customer has accepted your quote and authorised payment (held in escrow until the job is completed).</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Reference</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.jobReference)}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Customer price (incl. fee)</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
  </table>
  <p style="margin-top: 24px;">
    <a href="${jobUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Open job in your dashboard</a>
  </p>
  <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Use <strong>On my way</strong> when you head to the job so the customer is notified.</p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    const { error } = await resend.emails.send({
      from,
      to: params.toEmail.trim(),
      subject: `Job booked — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendContractorJobBookedEmail:", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendContractorJobBookedEmail failed:", e);
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
