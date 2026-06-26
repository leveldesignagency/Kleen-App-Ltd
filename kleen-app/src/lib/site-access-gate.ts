import type { NextRequest, NextResponse } from "next/server";

export const SITE_ACCESS_COOKIE = "kleen_site_access";
/** Cookie value set after successful unlock (edge-safe — no Node crypto in middleware). */
export const SITE_ACCESS_COOKIE_VALUE = "1";

/** Paths blocked server-side when gate is on (sign-in uses client modal instead). */
const MIDDLEWARE_GATED_PREFIXES = ["/dashboard", "/auth/callback", "/job-flow"];

export function isSiteAccessGateEnabled(): boolean {
  return process.env.SITE_ACCESS_GATE_ENABLED === "true";
}

export function isValidSiteAccessCookie(value: string | undefined): boolean {
  return value === SITE_ACCESS_COOKIE_VALUE;
}

export function hasSiteAccess(request: NextRequest): boolean {
  if (!isSiteAccessGateEnabled()) return true;
  return isValidSiteAccessCookie(request.cookies.get(SITE_ACCESS_COOKIE)?.value);
}

export function siteAccessGateBlocksPath(pathname: string): boolean {
  return MIDDLEWARE_GATED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Share preview gate across www + dashboard (same as auth cookie domain). */
export function getSiteAccessCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
} {
  const domain =
    process.env.SITE_ACCESS_COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim() ||
    (process.env.NODE_ENV === "production" ? ".kleenapp.co.uk" : undefined);

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    ...(domain ? { domain } : {}),
  };
}

export function setSiteAccessCookie(response: NextResponse): void {
  response.cookies.set(SITE_ACCESS_COOKIE, SITE_ACCESS_COOKIE_VALUE, getSiteAccessCookieOptions());
}

export function verifySiteAccessCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.SITE_ACCESS_USERNAME?.trim();
  const expectedPass = process.env.SITE_ACCESS_PASSWORD?.trim();
  if (!expectedUser || !expectedPass) return false;
  return username.trim() === expectedUser && password === expectedPass;
}
