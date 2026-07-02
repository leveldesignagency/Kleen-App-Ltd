import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/security/ip";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { applyRateLimitHeaders, applySecurityHeaders } from "@/lib/security/headers";
import { BUCKET_CONFIG, isTestApiPath, resolveApiBucket } from "@/lib/security/route-buckets";
import { isProduction } from "@/lib/security/env";

function rateLimitJsonResponse(
  result: Extract<ReturnType<typeof checkRateLimit>, { allowed: false }>,
): NextResponse {
  const body = NextResponse.json(
    { error: "Too many requests", retryAfter: result.retryAfterSec },
    { status: 429 },
  );
  applyRateLimitHeaders(body, {
    limit: result.limit,
    remaining: 0,
    resetAt: result.resetAt,
    retryAfterSec: result.retryAfterSec,
  });
  return applySecurityHeaders(body);
}

/**
 * Enforce per-IP (+ optional per-user) sliding-window limits on /api/*.
 * Returns a 429 response when exceeded, or null to continue.
 */
export function enforceApiRateLimit(
  request: NextRequest,
  userId?: string | null,
): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return null;

  if (isProduction() && isTestApiPath(pathname)) {
    return applySecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  const bucket = resolveApiBucket(pathname);
  const config = BUCKET_CONFIG[bucket];
  const ip = getClientIp(request);

  const ipKey = `ip:${bucket}:${ip}`;
  const ipResult = checkRateLimit(ipKey, config.maxIp, config.windowMs);
  if (!ipResult.allowed) {
    return rateLimitJsonResponse(ipResult);
  }

  if (userId) {
    const userKey = `user:${bucket}:${userId}`;
    const userResult = checkRateLimit(userKey, config.maxUser, config.windowMs);
    if (!userResult.allowed) {
      return rateLimitJsonResponse(userResult);
    }
  }

  return null;
}
