/**
 * Pre-payment UI uses `platform-service-agreement` + optional short addendum only.
 * Full `contract_content` is not shown before payment (emailed after escrow instead).
 *
 * Legacy / email helpers:
 * - `getContractorAddendumPreview` — optional short text from `contract_content_preview` only.
 * - `buildCustomerContractPreview` — prefer explicit preview; else redacted full text (avoid for UI).
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
/** Max chars for pre-payment addendum (admins sometimes paste full terms into preview by mistake). */
const ADDENDUM_PREVIEW_MAX_CHARS = 900;

/** Optional contractor addendum shown under the platform agreement (short text only). */
export function getContractorAddendumPreview(explicitPreview: string | null | undefined): string | null {
  const prev = explicitPreview?.trim();
  if (!prev) return null;
  const redacted = autoRedactContactInfo(prev);
  if (redacted.length <= ADDENDUM_PREVIEW_MAX_CHARS) return redacted;
  return `${redacted.slice(0, ADDENDUM_PREVIEW_MAX_CHARS).trimEnd()}…

[Full contractor terms are emailed after your payment is authorised and held in escrow — only a short preview is shown here.]`;
}

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
