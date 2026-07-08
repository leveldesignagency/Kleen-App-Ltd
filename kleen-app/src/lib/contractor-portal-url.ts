import { normalizeSiteOrigin } from "@/lib/customer-app-url";

/** Dedicated contractor app — kleen-contractor (local :3101, prod contractor.kleenapp.co.uk). */
export const DEFAULT_CONTRACTOR_PORTAL_ORIGIN =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3101"
    : "https://contractor.kleenapp.co.uk";

/** Absolute origin for the contractor portal (no trailing slash). */
export function contractorPortalOrigin(): string {
  const dedicated = normalizeSiteOrigin(process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL || "");
  if (dedicated) return dedicated.replace(/\/$/, "");
  return DEFAULT_CONTRACTOR_PORTAL_ORIGIN;
}

/** Absolute URL on the contractor portal (kleen-contractor), never the customer app host. */
export function contractorPortalHref(path: string): string {
  const base = contractorPortalOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${p}`;
}
