import { Resend } from "resend";
import { getAdminNotifyEmail } from "@/lib/admin-notify-email";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";

export type ResendConfigMode = "force_onboarding" | "verified_domain" | "onboarding_fallback";

export type ResendConfigSummary = {
  hasApiKey: boolean;
  adminNotifyEmail: string;
  resolvedFrom: string;
  replyTo?: string;
  mode: ResendConfigMode;
  fromVerified: boolean;
  forceOnboarding: boolean;
  warnings: string[];
};

export function summarizeResendConfig(): ResendConfigSummary {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const adminNotifyEmail = getAdminNotifyEmail();
  const resolvedFrom = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  const fromVerified = process.env.RESEND_FROM_VERIFIED === "true";
  const forceOnboarding = process.env.RESEND_FORCE_ONBOARDING === "true";
  const warnings: string[] = [];

  let mode: ResendConfigMode = "onboarding_fallback";
  if (forceOnboarding) {
    mode = "force_onboarding";
    warnings.push(
      "RESEND_FORCE_ONBOARDING=true — emails send from onboarding@resend.dev. Resend only delivers to the email address on your Resend account, not arbitrary inboxes like info@kleenapp.co.uk.",
    );
  } else if (fromVerified && resolvedFrom.includes("kleenapp.co.uk")) {
    mode = "verified_domain";
    warnings.push(
      "RESEND_FROM_VERIFIED=true — kleenapp.co.uk must show as Verified in the Resend Domains dashboard or sends will fail with a 403.",
    );
  } else if (resolvedFrom.includes("resend.dev")) {
    mode = "onboarding_fallback";
    warnings.push(
      "Sending from onboarding@resend.dev (domain not verified). Resend only allows delivery to your Resend account email until kleenapp.co.uk is verified.",
    );
  }

  if (!hasApiKey) {
    warnings.unshift("RESEND_API_KEY is not set on this deployment.");
  }
  if (!process.env.ADMIN_NOTIFY_EMAIL?.trim()) {
    warnings.push("ADMIN_NOTIFY_EMAIL is not set — defaulting to info@kleenapp.co.uk.");
  }

  return {
    hasApiKey,
    adminNotifyEmail,
    resolvedFrom,
    replyTo,
    mode,
    fromVerified,
    forceOnboarding,
    warnings,
  };
}

export function hintForResendError(message: string): string | undefined {
  const m = message.toLowerCase();
  if (m.includes("only send testing emails to your own email")) {
    return "Use RESEND_FORCE_ONBOARDING=true and set ADMIN_NOTIFY_EMAIL to your Resend login email until kleenapp.co.uk is verified — or verify the domain and use RESEND_FROM_VERIFIED=true.";
  }
  if (m.includes("domain") && (m.includes("verify") || m.includes("verified") || m.includes("403"))) {
    return "Verify kleenapp.co.uk in Resend (Domains → add DNS records in Wix/Cloudflare). Then set RESEND_FROM_VERIFIED=true and RESEND_FROM_EMAIL=Kleen <info@kleenapp.co.uk>, and redeploy.";
  }
  if (m.includes("invalid api key") || m.includes("api key")) {
    return "Check RESEND_API_KEY on the kleen-dashboard Vercel project (Production) and redeploy after changing it.";
  }
  return undefined;
}

export async function testResendSend(): Promise<{
  ok: boolean;
  error?: string;
  hint?: string;
  resendEmailId?: string;
}> {
  const config = summarizeResendConfig();
  if (!config.hasApiKey) {
    return { ok: false, error: "RESEND_API_KEY not set", hint: config.warnings[0] };
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const html = `<p>Kleen email diagnostic — ${new Date().toISOString()}</p><p>If you received this, Resend is configured correctly for <strong>${config.adminNotifyEmail}</strong>.</p>`;

  try {
    const { data, error } = await resend.emails.send({
      from: config.resolvedFrom,
      to: config.adminNotifyEmail,
      subject: `[Kleen diagnostic] Email test ${new Date().toISOString().slice(0, 16)}`,
      html,
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    });

    if (error) {
      const msg = error.message || JSON.stringify(error);
      return { ok: false, error: msg, hint: hintForResendError(msg) };
    }
    return { ok: true, resendEmailId: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return { ok: false, error: msg, hint: hintForResendError(msg) };
  }
}
