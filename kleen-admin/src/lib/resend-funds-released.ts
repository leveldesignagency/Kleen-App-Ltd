import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";

function customerDashboardUrl() {
  return (
    process.env.CUSTOMER_DASHBOARD_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://dashboard.kleenapp.co.uk"
  );
}

function contractorDashboardUrl() {
  return (
    process.env.CONTRACTOR_PORTAL_BASE_URL?.replace(/\/$/, "") ||
    process.env.CUSTOMER_DASHBOARD_URL?.replace(/\/$/, "") ||
    "https://dashboard.kleenapp.co.uk"
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * After successful escrow release to contractor — notify customer and contractor.
 */
export async function sendFundsReleasedEmails(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    jobReference: string;
    customerUserId: string;
    operativeId: string;
    contractorName: string;
    contractorSharePence: number;
    transferred: boolean;
  }
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("sendFundsReleasedEmails: RESEND_API_KEY not set");
    return;
  }

  const [{ data: cust }, { data: op }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", params.customerUserId).maybeSingle(),
    supabase.from("operatives").select("email, full_name").eq("id", params.operativeId).maybeSingle(),
  ]);

  const resend = new Resend(apiKey);
  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  const share = `£${(params.contractorSharePence / 100).toFixed(2)}`;
  const custBase = customerDashboardUrl();
  const conBase = contractorDashboardUrl();
  const jobCustomerUrl = `${custBase}/dashboard/jobs/${params.jobId}`;
  const jobContractorUrl = `${conBase}/contractor/jobs/${params.jobId}`;

  const customerEmail = cust?.email?.trim();
  if (customerEmail) {
    const name = escapeHtml(cust?.full_name?.trim() || "there");
    const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:1.25rem;">Payment released</h1>
  <p style="color:#64748b;">Hi ${name},</p>
  <p>Payment for job <strong>${escapeHtml(params.jobReference)}</strong> has been released to your contractor (${share} contractor share after Kleen&apos;s fee).</p>
  <p><a href="${jobCustomerUrl}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">View job</a></p>
  <p style="color:#64748b;font-size:12px;margin-top:24px;">— Kleen</p>
</body></html>`;
    await resend.emails.send({
      from,
      to: customerEmail,
      subject: `Payment released — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
  }

  const contractorEmail = op?.email?.trim();
  if (contractorEmail) {
    const name = escapeHtml(op?.full_name?.trim() || params.contractorName);
    const payLine = params.transferred
      ? `We&apos;ve sent <strong>${share}</strong> to your connected Stripe account (after Kleen&apos;s commission).`
      : `Please contact Kleen for your payout for this job — your share is <strong>${share}</strong> (Stripe Connect was not used).`;
    const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:1.25rem;">Funds released</h1>
  <p style="color:#64748b;">Hi ${name},</p>
  <p>Job <strong>${escapeHtml(params.jobReference)}</strong> — ${payLine}</p>
  <p><a href="${jobContractorUrl}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Open job</a></p>
  <p style="color:#64748b;font-size:12px;margin-top:24px;">— Kleen</p>
</body></html>`;
    await resend.emails.send({
      from,
      to: contractorEmail,
      subject: `Funds released — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
  }

  const adminNotify = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (adminNotify) {
    await resend.emails.send({
      from,
      to: adminNotify,
      subject: `Funds released — ${params.jobReference}`,
      html: `<p>Job ${escapeHtml(params.jobReference)}: funds released. Contractor share ${share}. Transferred: ${params.transferred ? "yes (Stripe)" : "manual"}.</p>`,
      ...(replyTo ? { replyTo } : {}),
    });
  }
}
