/** Same behaviour as kleen-app — set RESEND_FROM_VERIFIED=true when domain is verified in Resend. */
export function sanitizeEmailHeader(value: string): string {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[\u2022\u00B7\u2023\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeEmailAddress(value: string): string {
  const s = sanitizeEmailHeader(value);
  const angle = s.match(/<([^>]+)>/);
  if (angle) return sanitizeEmailHeader(angle[1]);
  const bare = s.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return bare ? bare[0] : s;
}

export function resolveResendFrom(): string {
  if (process.env.RESEND_FORCE_ONBOARDING === "true") {
    return "Kleen <onboarding@resend.dev>";
  }
  const verified = process.env.RESEND_FROM_VERIFIED === "true";
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (verified && from) {
    const clean = sanitizeEmailHeader(from);
    if (clean.includes("<")) return clean;
    const email = sanitizeEmailAddress(clean);
    return email.includes("@") ? `Kleen <${email}>` : clean;
  }
  if (from && !from.includes("kleenapp.co.uk")) {
    const clean = sanitizeEmailHeader(from);
    if (clean.includes("<")) return clean;
    const email = sanitizeEmailAddress(clean);
    return email.includes("@") ? `Kleen <${email}>` : clean;
  }
  return "Kleen <onboarding@resend.dev>";
}

export function resolveResendReplyTo(): string | undefined {
  const r = process.env.RESEND_REPLY_TO?.trim();
  if (!r) return undefined;
  return sanitizeEmailAddress(r);
}
