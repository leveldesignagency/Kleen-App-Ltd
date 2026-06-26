import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SITE_ACCESS_COOKIE = "kleen_site_access";

const GATE_PATH_PREFIXES = ["/sign-in", "/job-flow", "/dashboard", "/auth/callback"];

export function isSiteAccessGateEnabled(): boolean {
  return process.env.SITE_ACCESS_GATE_ENABLED === "true";
}

/** Client-safe flag — use site-access-gate-public.ts on the client. */
export function isSiteAccessGateEnabledPublic(): boolean {
  return process.env.NEXT_PUBLIC_SITE_ACCESS_GATE_ENABLED === "true";
}

function gateSecret(): string | null {
  return (
    process.env.SITE_ACCESS_GATE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export function createSiteAccessToken(): string | null {
  const secret = gateSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update("kleen-site-access-v1").digest("base64url");
}

export function isValidSiteAccessCookie(value: string | undefined): boolean {
  const expected = createSiteAccessToken();
  if (!expected || !value) return false;
  try {
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function hasSiteAccess(request: NextRequest): boolean {
  if (!isSiteAccessGateEnabled()) return true;
  return isValidSiteAccessCookie(request.cookies.get(SITE_ACCESS_COOKIE)?.value);
}

export function siteAccessGateBlocksPath(pathname: string): boolean {
  return GATE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function setSiteAccessCookie(response: NextResponse): boolean {
  const token = createSiteAccessToken();
  if (!token) return false;
  response.cookies.set(SITE_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return true;
}

export function verifySiteAccessCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.SITE_ACCESS_USERNAME?.trim();
  const expectedPass = process.env.SITE_ACCESS_PASSWORD?.trim();
  if (!expectedUser || !expectedPass) return false;
  return safeStringEqual(username.trim(), expectedUser) && safeStringEqual(password, expectedPass);
}

function safeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
