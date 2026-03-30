/**
 * Pre-payment contract display: avoid leaking contractor contact details before escrow.
 * - Prefer admin-authored `contract_content_preview` (operative_services).
 * - Else strip common contact patterns from full `contract_content` (best-effort).
 */

/** Redact emails, URLs, and typical UK phone patterns */
export function autoRedactContactInfo(text: string): string {
  let t = text;
  t = t.replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[contact redacted until booking confirmed]");
  t = t.replace(/\bhttps?:\/\/[^\s)]+/gi, "[link redacted until booking confirmed]");
  t = t.replace(/\b(?:\+44\s?|0)[\d\s\-()]{10,}\b/g, "[phone redacted until booking confirmed]");
  return t;
}

/**
 * Text shown during e-sign before payment.
 * @param full - operative_services.contract_content (full legal text)
 * @param explicitPreview - operative_services.contract_content_preview (optional)
 */
export function buildCustomerContractPreview(
  full: string | null | undefined,
  explicitPreview: string | null | undefined,
): string | null {
  const prev = explicitPreview?.trim();
  if (prev) return prev;
  const f = full?.trim();
  if (!f) return null;
  return autoRedactContactInfo(f);
}
