import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getClientIp } from "@/lib/security/ip";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  applyPrivateResourceHeaders,
  applyRateLimitHeaders,
  applySecurityHeaders,
} from "@/lib/security/headers";
import { BUCKET_CONFIG, type RateLimitBucket } from "@/lib/security/route-buckets";

type SecureHandler = (
  request: NextRequest,
  context?: unknown,
) => Promise<NextResponse> | NextResponse;

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function handlerRateLimitResponse(
  result: Extract<ReturnType<typeof checkRateLimit>, { allowed: false }>,
): NextResponse {
  const res = NextResponse.json(
    { error: "Too many requests", retryAfter: result.retryAfterSec },
    { status: 429 },
  );
  applyRateLimitHeaders(res, {
    limit: result.limit,
    remaining: 0,
    resetAt: result.resetAt,
    retryAfterSec: result.retryAfterSec,
  });
  return applySecurityHeaders(res);
}

/**
 * Wrap expensive API handlers: stricter handler-level rate limit + security headers.
 * Middleware already applies IP/user limits; this adds a second check on the bucket.
 */
export function withSecureApiRoute(
  bucket: RateLimitBucket,
  handler: SecureHandler,
  options?: { private?: boolean },
) {
  return async (request: NextRequest, context?: unknown) => {
    const config = BUCKET_CONFIG[bucket];
    const ip = getClientIp(request);
    const ipResult = checkRateLimit(`h:ip:${bucket}:${ip}`, config.maxIp, config.windowMs);
    if (!ipResult.allowed) {
      return handlerRateLimitResponse(ipResult);
    }

    const userId = await resolveUserId(request);
    if (userId) {
      const userResult = checkRateLimit(`h:user:${bucket}:${userId}`, config.maxUser, config.windowMs);
      if (!userResult.allowed) {
        return handlerRateLimitResponse(userResult);
      }
    }

    let response = await handler(request, context);

    if (options?.private) {
      response = applyPrivateResourceHeaders(response);
    } else {
      response = applySecurityHeaders(response);
    }

    return response;
  };
}
