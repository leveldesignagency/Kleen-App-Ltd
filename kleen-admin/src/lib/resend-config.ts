/** Same behaviour as kleen-app — set RESEND_FROM_VERIFIED=true when domain is verified in Resend. */
export function resolveResendFrom(): string {
  const verified = process.env.RESEND_FROM_VERIFIED === "true";
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (verified && from) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  if (from && !from.includes("kleenapp.co.uk")) {
    return from.includes("<") ? from : `Kleen <${from}>`;
  }
  return "Kleen <onboarding@resend.dev>";
}
