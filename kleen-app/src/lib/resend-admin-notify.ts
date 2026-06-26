import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";
import { getAdminAppUrl, getAdminNotifyEmail } from "@/lib/admin-notify-email";

export type AdminEmailResult = { ok: boolean; error?: string };

/**
 * Email admin when a new customer job is submitted.
 */
export async function sendAdminNewJobEmail(params: {
  jobId: string;
  jobReference: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  postcode: string;
  preferredDate: string;
}): Promise<AdminEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = "RESEND_API_KEY not set";
    console.warn("sendAdminNewJobEmail:", error);
    return { ok: false, error };
  }

  const resend = new Resend(apiKey);
  const adminNotifyEmail = getAdminNotifyEmail();
  const adminJobUrl = `${getAdminAppUrl()}/jobs/${params.jobId}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New job — ${params.jobReference}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">New job submitted</h1>
  <p style="color: #64748b; margin-bottom: 16px;">A customer has created a job on Kleen.</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Reference</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.jobReference}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Service</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.serviceName}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Customer</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.customerName} (${params.customerEmail})</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Postcode</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.postcode}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Preferred date</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.preferredDate}</td></tr>
  </table>
  <p style="margin-top: 24px;">
    <a href="${adminJobUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Open in admin</a>
  </p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    const { error, data } = await resend.emails.send({
      from,
      to: adminNotifyEmail,
      subject: `New job — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendAdminNewJobEmail Resend error:", JSON.stringify(error), { from, to: adminNotifyEmail });
      return { ok: false, error: error.message || JSON.stringify(error) };
    }
    if (data?.id) {
      console.log("sendAdminNewJobEmail sent id:", data.id, "from:", from, "to:", adminNotifyEmail);
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    console.error("sendAdminNewJobEmail failed:", e);
    return { ok: false, error: message };
  }
}

/**
 * Email admin when a customer accepts a quote and payment is authorized (held in escrow until capture).
 * No-op if RESEND_API_KEY is missing (logs once).
 */
export async function sendAdminQuoteAcceptedEmail(params: {
  jobId: string;
  jobReference: string;
  customerName: string;
  customerEmail: string;
  amountPence: number;
}): Promise<AdminEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = "RESEND_API_KEY not set";
    console.warn("sendAdminQuoteAcceptedEmail:", error);
    return { ok: false, error };
  }

  const resend = new Resend(apiKey);
  const adminNotifyEmail = getAdminNotifyEmail();
  const amount = `£${(params.amountPence / 100).toFixed(2)}`;
  const adminJobUrl = `${getAdminAppUrl()}/jobs/${params.jobId}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote accepted — ${params.jobReference}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">Customer accepted a quote</h1>
  <p style="color: #64748b; margin-bottom: 16px;">A customer has authorized payment (held in escrow until the job is completed and funds are released).</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Job</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.jobReference}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Customer</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.customerName} (${params.customerEmail})</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Amount (authorized)</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
  </table>
  <p style="margin-top: 24px;">
    <a href="${adminJobUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Open job in admin</a>
  </p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    const { error, data } = await resend.emails.send({
      from,
      to: adminNotifyEmail,
      subject: `Quote accepted — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendAdminQuoteAcceptedEmail Resend error:", JSON.stringify(error), { from, to: adminNotifyEmail });
      return { ok: false, error: error.message || JSON.stringify(error) };
    }
    if (data?.id) {
      console.log("sendAdminQuoteAcceptedEmail sent id:", data.id, "from:", from, "to:", adminNotifyEmail);
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    console.error("sendAdminQuoteAcceptedEmail failed:", e);
    return { ok: false, error: message };
  }
}
