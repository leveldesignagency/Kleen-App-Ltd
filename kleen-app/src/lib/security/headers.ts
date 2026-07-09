import { NextResponse } from "next/server";
import { isMarketingPath } from "@/lib/security/route-buckets";

const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";

const DEFAULT_MARKETING_FRAME_ANCESTORS = [
  "https://leveldesignagency.com",
  "https://www.leveldesignagency.com",
  "https://leveldesignagency.co.uk",
  "https://www.leveldesignagency.co.uk",
];

function normalizeFrameAncestorOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Origins allowed to embed marketing pages (space- or comma-separated env list). */
export function getMarketingFrameAncestors(): string[] {
  const fromEnv = process.env.MARKETING_FRAME_ANCESTORS?.trim();
  const origins = fromEnv
    ? fromEnv.split(/[\s,]+/).map(normalizeFrameAncestorOrigin).filter(Boolean)
    : [...DEFAULT_MARKETING_FRAME_ANCESTORS];

  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://localhost:3100", "http://127.0.0.1:3000");
  }

  return Array.from(new Set(origins));
}

export function applySecurityHeaders(
  response: NextResponse,
  pathname?: string,
): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);

  if (pathname && isMarketingPath(pathname)) {
    const ancestors = ["'self'", ...getMarketingFrameAncestors()];
    response.headers.set("Content-Security-Policy", `frame-ancestors ${ancestors.join(" ")}`);
    response.headers.delete("X-Frame-Options");
  } else {
    response.headers.set("X-Frame-Options", "DENY");
  }

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
