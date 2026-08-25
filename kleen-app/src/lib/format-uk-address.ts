/** UK postcode validation and normalisation (shared with job-flow). */

export const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function normalizeUkPostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export type ResolvedUkAddress = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  formatted: string;
};

export function formatUkAddressLines(parts: {
  line1?: string | null;
  line2?: string | null;
  line3?: string | null;
  line4?: string | null;
  townOrCity?: string | null;
  locality?: string | null;
}): ResolvedUkAddress {
  const line1 = (parts.line1 || "").trim();
  const line2 = [parts.line2, parts.line3, parts.line4].filter(Boolean).join(", ").trim();
  const city = (parts.townOrCity || parts.locality || "").trim();
  const formatted = [line1, line2, city].filter(Boolean).join(", ");
  return { line1, line2, city, postcode: "", formatted };
}
