import { NextResponse } from "next/server";

const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  return response;
}

/** Token / portal link responses — no caching, no indexing. */
export function applyPrivateResourceHeaders(response: NextResponse): NextResponse {
  applySecurityHeaders(response);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function applyRateLimitHeaders(
  response: NextResponse,
  info: { limit: number; remaining: number; resetAt: number; retryAfterSec?: number },
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(info.limit));
  response.headers.set("X-RateLimit-Remaining", String(info.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(info.resetAt / 1000)));
  if (info.retryAfterSec != null) {
    response.headers.set("Retry-After", String(info.retryAfterSec));
  }
  return response;
}
