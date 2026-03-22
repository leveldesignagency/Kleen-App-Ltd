/**
 * Resend "from" address. Set RESEND_FROM_VERIFIED=true and RESEND_FROM_EMAIL
 * (e.g. Kleen <info@kleenapp.co.uk>) once the domain is verified in Resend.
 */
export function resolveResendFrom(): string {
  const verified = process.env.RESEND_FROM_VERIFIED === "true";
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (verified && from) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  // Legacy: avoid unverified kleenapp domain bounces
  if (from && !from.includes("kleenapp.co.uk")) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  return "Kleen <onboarding@resend.dev>";
}
