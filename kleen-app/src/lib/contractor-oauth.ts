import { contractorPortalHref } from "@/lib/contractor-portal-url";

/**
 * OAuth redirect for contractor join / sign-in (Google) on the contractor portal host.
 * Never use the marketing/dashboard origin — session cookies must be set on contractor.kleenapp.co.uk.
 */
export function getContractorGoogleRedirectTo(): string {
  const callback = contractorPortalHref("/auth/callback");
  const next = encodeURIComponent("/contractor");
  const intent = encodeURIComponent("contractor");
  return `${callback}?next=${next}&intent=${intent}`;
}
