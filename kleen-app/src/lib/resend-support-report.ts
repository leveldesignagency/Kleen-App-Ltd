import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";
import { getAdminNotifyEmail } from "@/lib/admin-notify-email";

export type SupportReportPayload = {
  reportId: string;
  kind: string;
  title: string;
  message: string;
  detail?: string;
  userMessage?: string;
  userEmail?: string;
  page?: string;
  context?: Record<string, unknown>;
};

export async function sendSupportReportEmail(
  payload: SupportReportPayload,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const to = getAdminNotifyEmail();
  const contextJson = payload.context
    ? `<pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:12px;overflow:auto">${escapeHtml(JSON.stringify(payload.context, null, 2))}</pre>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="font-size:1.125rem">Customer error report — ${escapeHtml(payload.reportId)}</h1>
  <p><strong>Kind:</strong> ${escapeHtml(payload.kind)}</p>
  <p><strong>Title:</strong> ${escapeHtml(payload.title)}</p>
  <p><strong>Message:</strong> ${escapeHtml(payload.message)}</p>
  ${payload.detail ? `<p><strong>Detail:</strong> ${escapeHtml(payload.detail)}</p>` : ""}
  ${payload.userMessage ? `<p><strong>Customer note:</strong> ${escapeHtml(payload.userMessage)}</p>` : ""}
  ${payload.userEmail ? `<p><strong>Customer email:</strong> ${escapeHtml(payload.userEmail)}</p>` : ""}
  ${payload.page ? `<p><strong>Page:</strong> ${escapeHtml(payload.page)}</p>` : ""}
  ${contextJson}
</body>
</html>`.trim();

  const resend = new Resend(apiKey);
  const from = resolveResendFrom();
  const replyTo = payload.userEmail || resolveResendReplyTo();

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `[Kleen report] ${payload.reportId} — ${payload.title}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      return { ok: false, error: error.message || JSON.stringify(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
