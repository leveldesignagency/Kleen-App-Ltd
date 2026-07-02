/** True on Vercel production or NODE_ENV production. */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.ALLOW_DEV_AUTH === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === "true" ||
    process.env.DEV_BYPASS_CONVERT_AUTH === "true"
  );
}

export function isHeaderEmailBypassEnabled(): boolean {
  return process.env.ALLOW_X_USER_EMAIL_HEADER === "true";
}

export function isSiteAccessGateOn(): boolean {
  return process.env.SITE_ACCESS_GATE_ENABLED === "true";
}

export function hasAdminSecret(): boolean {
  return Boolean(process.env.ADMIN_SECRET?.trim() || process.env.CRON_SECRET?.trim());
}

export function hasCronSecret(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

export function hasShareLinkSecret(): boolean {
  return Boolean(process.env.SHARE_LINK_SECRET?.trim());
}

export function authorizeAdminSecret(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
