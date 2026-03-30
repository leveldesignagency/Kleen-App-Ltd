import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email the customer the full contractor agreement after payment is authorised (escrow).
 */
export async function sendCustomerFullContractEmail(params: {
  toEmail: string;
  customerName: string;
  jobReference: string;
  contractTitle: string | null;
  contractContent: string | null;
  contractFileUrl: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("sendCustomerFullContractEmail: RESEND_API_KEY not set");
    return { ok: false, error: "no_api_key" };
  }

  const resend = new Resend(apiKey);
  const replyTo = resolveResendReplyTo();
  const title = params.contractTitle?.trim() || "Service agreement";

  const bodyHtml = params.contractContent
    ? `<div style="white-space: pre-wrap; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; color: #1e293b;">${escapeHtml(params.contractContent)}</div>`
    : "<p>No text content was on file; see the link below if a PDF is available.</p>";

  const fileBlock = params.contractFileUrl
    ? `<p style="margin-top:16px;"><a href="${escapeHtml(params.contractFileUrl)}" style="color: #0891b2; font-weight: 600;">Download PDF agreement →</a></p>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your agreement — ${escapeHtml(params.jobReference)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.125rem; margin-bottom: 8px;">Your full service agreement</h1>
  <p style="color: #64748b; margin-bottom: 16px;">Hi ${escapeHtml(params.customerName)},</p>
  <p style="color: #64748b; margin-bottom: 16px;">
    Your payment has been authorised and held securely for job <strong>${escapeHtml(params.jobReference)}</strong>.
    Below is the complete agreement for your records.
  </p>
  <h2 style="font-size: 1rem; margin: 20px 0 8px;">${escapeHtml(title)}</h2>
  ${bodyHtml}
  ${fileBlock}
  <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Kleen — connecting you with independent contractors.</p>
</body>
</html>
`.trim();

  try {
    const { error } = await resend.emails.send({
      from: resolveResendFrom(),
      to: params.toEmail,
      subject: `Your full agreement — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendCustomerFullContractEmail Resend error:", error);
      return { ok: false, error: JSON.stringify(error) };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendCustomerFullContractEmail failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
