import type { SupabaseClient } from "@supabase/supabase-js";
import { contractorPortalUrl, customerDashboardUrl, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendKleenEmail } from "@/lib/email/send";

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
  const [{ data: cust }, { data: op }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", params.customerUserId).maybeSingle(),
    supabase.from("operatives").select("email, full_name").eq("id", params.operativeId).maybeSingle(),
  ]);

  const share = `£${(params.contractorSharePence / 100).toFixed(2)}`;
  const jobCustomerUrl = customerDashboardUrl(`/dashboard/jobs/${params.jobId}`);
  const jobContractorUrl = contractorPortalUrl(`/contractor/jobs/${params.jobId}`);

  const customerEmail = cust?.email?.trim();
  if (customerEmail) {
    const name = cust?.full_name?.trim() || "there";
    const html = emailLayout({
      title: `Payment released — ${params.jobReference}`,
      heading: "Payment released",
      introHtml: `<p>Hi ${escapeHtml(name)}, payment for job <strong>${escapeHtml(params.jobReference)}</strong> has been released to your contractor (${share} contractor share after Kleen&apos;s fee).</p>`,
      cta: { href: jobCustomerUrl, label: "View job" },
    });
    await sendKleenEmail({
      to: customerEmail,
      subject: `Payment released — ${params.jobReference}`,
      html,
    });
  }

  const contractorEmail = op?.email?.trim();
  if (contractorEmail) {
    const name = op?.full_name?.trim() || params.contractorName;
    const payLine = params.transferred
      ? `We&apos;ve sent <strong>${share}</strong> to your connected Stripe account (after Kleen&apos;s commission).`
      : `Please contact Kleen for your payout for this job — your share is <strong>${share}</strong> (Stripe Connect was not used).`;
    const html = emailLayout({
      title: `Funds released — ${params.jobReference}`,
      heading: "Funds released",
      introHtml: `<p>Hi ${escapeHtml(name)}, job <strong>${escapeHtml(params.jobReference)}</strong> — ${payLine}</p>`,
      cta: { href: jobContractorUrl, label: "Open job" },
    });
    await sendKleenEmail({
      to: contractorEmail,
      subject: `Funds released — ${params.jobReference}`,
      html,
    });
  }

  const adminNotify = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (adminNotify) {
    const html = emailLayout({
      title: `Funds released — ${params.jobReference}`,
      heading: "Funds released (admin)",
      introHtml: `<p>Job <strong>${escapeHtml(params.jobReference)}</strong>: funds released. Contractor share ${share}. Transferred: ${params.transferred ? "yes (Stripe)" : "manual"}.</p>`,
    });
    await sendKleenEmail({
      to: adminNotify,
      subject: `Funds released — ${params.jobReference}`,
      html,
    });
  }
}
