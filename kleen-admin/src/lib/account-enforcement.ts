/**
 * Shared normalization for identity blocklist keys.
 * Keep in sync with migration 061 normalize_block_key().
 */
export function normalizeBlockKey(
  blockType: "email" | "phone" | "postcode_address" | "company_number" | "vat_number",
  value: string,
): string {
  const v = value.trim();
  switch (blockType) {
    case "email":
      return v.toLowerCase();
    case "phone":
      return v.replace(/\D/g, "");
    case "postcode_address":
      return v.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    case "company_number":
    case "vat_number":
      return v.replace(/\s+/g, "").toUpperCase();
    default:
      return v.toLowerCase();
  }
}

export function buildPostcodeAddressKey(postcode: string, line1: string): string {
  return normalizeBlockKey("postcode_address", `${postcode}|${line1}`);
}

export const RISK_SEVERITY_ORDER = ["info", "warning", "high", "critical"] as const;

export function highestSeverity(
  flags: Array<{ severity: string }>,
): (typeof RISK_SEVERITY_ORDER)[number] | null {
  let best: (typeof RISK_SEVERITY_ORDER)[number] | null = null;
  let bestIdx = -1;
  for (const f of flags) {
    const idx = RISK_SEVERITY_ORDER.indexOf(f.severity as (typeof RISK_SEVERITY_ORDER)[number]);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = f.severity as (typeof RISK_SEVERITY_ORDER)[number];
    }
  }
  return best;
}

export const BAN_REASON_CODES = [
  { value: "excessive_disputes", label: "Excessive disputes" },
  { value: "fraud", label: "Fraud / payment abuse" },
  { value: "safety", label: "Safety concern" },
  { value: "harassment", label: "Harassment / abuse" },
  { value: "policy_violation", label: "Policy violation" },
  { value: "no_show_pattern", label: "Repeated no-shows / reliability" },
  { value: "quality", label: "Severe quality issues" },
  { value: "other", label: "Other" },
] as const;
