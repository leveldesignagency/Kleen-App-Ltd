import { customerAppHref, normalizeSiteOrigin } from "@/lib/customer-app-url";

/** Absolute origin for the contractor portal (no trailing slash). */
export function contractorPortalOrigin(): string {
  const dedicated = normalizeSiteOrigin(process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL || "");
  if (dedicated) return dedicated.replace(/\/$/, "");
  const fallback = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");
  return (fallback || "https://dashboard.kleenapp.co.uk").replace(/\/$/, "");
}

/**
 * Absolute or same-host URL for the contractor portal (dedicated deployment).
 * When unset, falls back to the customer app so local/dev keeps working until cutover.
 */
export function contractorPortalHref(path: string): string {
  const base = normalizeSiteOrigin(process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL || "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base) return `${base.replace(/\/$/, "")}${p}`;
  return customerAppHref(path);
}
