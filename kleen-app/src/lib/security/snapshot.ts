import { getRateLimitBlockedHits } from "@/lib/security/rate-limit";
import {
  hasAdminSecret,
  hasCronSecret,
  hasShareLinkSecret,
  isDevAuthBypassEnabled,
  isHeaderEmailBypassEnabled,
  isProduction,
  isSiteAccessGateOn,
} from "@/lib/security/env";

export type SecuritySnapshot = {
  production: boolean;
  securityHeadersEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitBlockedHits: number;
  siteAccessGateEnabled: boolean;
  devAuthBypassEnabled: boolean;
  headerEmailBypassEnabled: boolean;
  cronSecretConfigured: boolean;
  adminSecretConfigured: boolean;
  shareLinkSecretConfigured: boolean;
  authProvider: "supabase";
  notes: string[];
};

export function buildSecuritySnapshot(): SecuritySnapshot {
  const notes: string[] = [];
  if (isProduction() && isSiteAccessGateOn()) {
    notes.push("Site access preview gate is ON in production — disable when launching publicly.");
  }
  if (isProduction() && isDevAuthBypassEnabled()) {
    notes.push("WARNING: Dev auth bypass flags are enabled in production.");
  }
  if (isProduction() && isHeaderEmailBypassEnabled()) {
    notes.push("WARNING: X-User-Email header bypass is enabled in production.");
  }
  if (!hasCronSecret()) {
    notes.push("CRON_SECRET is not set — cron routes will reject requests.");
  }

  return {
    production: isProduction(),
    securityHeadersEnabled: true,
    rateLimitEnabled: true,
    rateLimitBlockedHits: getRateLimitBlockedHits(),
    siteAccessGateEnabled: isSiteAccessGateOn(),
    devAuthBypassEnabled: isDevAuthBypassEnabled(),
    headerEmailBypassEnabled: isHeaderEmailBypassEnabled(),
    cronSecretConfigured: hasCronSecret(),
    adminSecretConfigured: hasAdminSecret(),
    shareLinkSecretConfigured: hasShareLinkSecret(),
    authProvider: "supabase",
    notes,
  };
}
