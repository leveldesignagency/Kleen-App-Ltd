/**
 * Vercel env values are sometimes stored without a scheme (e.g. `www.example.com`).
 * Browsers treat those as paths, not hosts — normalize to https://...
 */
export function normalizeSiteOrigin(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Canonical URL for customer booking + dashboard (e.g. https://dashboard.kleenapp.co.uk).
 * When marketing is served from www and the app is on dashboard, set NEXT_PUBLIC_SITE_URL
 * so "Get Started" / sign-in links jump to the dashboard host — same session as /dashboard.
 */
export function getCustomerAppOrigin(): string {
  return normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");
}

/** Path must start with /. Returns absolute URL when origin is configured, else same-host path. */
export function customerAppHref(path: string): string {
  const o = getCustomerAppOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return o ? `${o}${p}` : p;
}
